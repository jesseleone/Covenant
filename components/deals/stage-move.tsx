"use client";

// One flow for every stage change (pipeline drag, stage stepper, Advance
// button): permission check → gate check → move, or a dialog listing what's
// missing (with an override for soft gates), or the pass/lost/on-hold dialog.

import { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowRight, CircleAlert, Lock } from "lucide-react";
import { toast } from "sonner";
import { PASS_REASONS, PASS_REASON_LABELS, ROLE_LABELS, STAGE_LABELS, type Deal, type PassReason, type Stage } from "@/lib/schema";
import { evaluateGate, type GateResult } from "@/lib/gates";
import { canMoveStage } from "@/lib/permissions";
import { moveStage, nextIcMeeting, reopenDeal, setDealOutcome, type Outcome } from "@/lib/actions";
import { useCurrentUser, useDB, useDBStore } from "@/lib/store";
import { Dialog } from "@/components/ui/menu";
import { Button, cn } from "@/components/ui/primitives";

const textarea = "w-full rounded-[12px] border border-border-strong bg-surface px-3 py-2 outline-none focus:border-focus";

export function useStageMover() {
  const db = useDB();
  const user = useCurrentUser();
  const [gate, setGate] = useState<{ deal: Deal; to: Stage; result: GateResult } | null>(null);
  const [outcome, setOutcome] = useState<{ deal: Deal; initial: Outcome } | null>(null);

  const isOut = (d: Deal) => d.status === "passed" || d.status === "lost" || d.status === "on_hold";

  function doMove(deal: Deal, to: Stage, reason?: string) {
    const r = moveStage(deal.id, to, reason);
    if (!r.ok) return toast.error(r.error);
    const after = useDBStore.getState().db;
    toast.success(`${deal.name} moved to ${STAGE_LABELS[to]}`, {
      description: to === "ic" ? `Final IC scheduled for ${format(parseISO(nextIcMeeting(after)), "EEEE d MMM")}` : reason ? "Override recorded in History" : undefined,
    });
  }

  function request(deal: Deal, to: Stage) {
    if (!user) return;
    if (deal.stage === to && !isOut(deal)) return;
    if (deal.status === "closed") return toast("Closed deals can't change stage.");
    if (!canMoveStage(user.role, to)) {
      return toast.error(`${ROLE_LABELS[user.role]}s can't move deals into ${STAGE_LABELS[to]}`, {
        description: to === "ic" ? "Switch to a VP or MD persona to submit to IC." : to === "documentation" ? "A VP, MD or IC member can move an approved deal to Documentation." : undefined,
      });
    }
    const result = evaluateGate(db, deal, to);
    if (result.ok) doMove(deal, to);
    else setGate({ deal, to, result });
  }

  function requestOutcome(deal: Deal, initial: Outcome = "passed") {
    if (!user || !canMoveStage(user.role, "screening")) return toast.error("Your role can't change a deal's status.");
    setOutcome({ deal, initial });
  }

  function reopen(deal: Deal) {
    const r = reopenDeal(deal.id);
    if (!r.ok) toast.error(r.error);
    else toast.success(`${deal.name} reopened at ${STAGE_LABELS[deal.stage]}`);
  }

  const ui = (
    <>
      {gate && (
        <GateDialog
          key={gate.deal.id + gate.to}
          {...gate}
          onClose={() => setGate(null)}
          onOverride={(reason) => { doMove(gate.deal, gate.to, reason); setGate(null); }}
        />
      )}
      {outcome && <OutcomeDialog key={outcome.deal.id} {...outcome} onClose={() => setOutcome(null)} />}
    </>
  );

  return { request, requestOutcome, reopen, ui };
}

// ---------------------------------------------------------------------------

function GateDialog({ deal, to, result, onClose, onOverride }: { deal: Deal; to: Stage; result: GateResult; onClose: () => void; onOverride: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`Before ${deal.codename} moves to ${STAGE_LABELS[to]}`}
      description={result.hard ? "This stage can't be entered until the requirement below is met." : "These requirements aren't met yet."}
    >
      <ul className="mb-5 space-y-2">
        {result.unmet.map((u) => (
          <li key={u.label}>
            <Link href={u.href} onClick={onClose} className="group flex items-start gap-2.5 rounded-[10px] border border-border px-3 py-2.5 hover:border-border-strong hover:bg-surface-2/60">
              {result.hard ? <Lock size={16} className="mt-0.5 shrink-0 text-danger" /> : <CircleAlert size={16} className="mt-0.5 shrink-0 text-warn" />}
              <span className="flex-1">{u.label}</span>
              <ArrowRight size={15} className="mt-0.5 shrink-0 text-text-3 group-hover:text-text" />
            </Link>
          </li>
        ))}
      </ul>
      {result.hard ? (
        <div className="flex justify-end"><Button variant="secondary" onClick={onClose}>Close</Button></div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (reason.trim()) onOverride(reason.trim()); }} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[12px] text-text-3">Reason for moving anyway (saved to the audit trail)</span>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={textarea} placeholder="Why move before these are done?" autoFocus />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!reason.trim()}>Move anyway</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

const OUTCOMES: { key: Outcome; label: string }[] = [
  { key: "passed", label: "Passed" },
  { key: "lost", label: "Lost" },
  { key: "on_hold", label: "On hold" },
];

function OutcomeDialog({ deal, initial, onClose }: { deal: Deal; initial: Outcome; onClose: () => void }) {
  const [kind, setKind] = useState<Outcome>(initial);
  const [reason, setReason] = useState<PassReason | undefined>(initial === "lost" ? "lost_to_competitor" : undefined);
  const [note, setNote] = useState("");
  const needsReason = kind !== "on_hold";
  const valid = note.trim() && (!needsReason || reason);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const r = setDealOutcome(deal.id, kind, note, needsReason ? reason : undefined);
    if (!r.ok) return toast.error(r.error);
    toast.success(`${deal.name} marked ${kind === "on_hold" ? "on hold" : kind}`, { description: "Kept with its reason so it can be found as a precedent." });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={`Take ${deal.codename} off the board`} description="Passed deals stay searchable for precedents, so record why.">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex rounded-[10px] border border-border bg-surface-2/50 p-0.5">
          {OUTCOMES.map((o) => (
            <button key={o.key} type="button" onClick={() => { setKind(o.key); if (o.key === "lost") setReason("lost_to_competitor"); }}
              className={cn("h-8 flex-1 rounded-[8px] text-[13px]", kind === o.key ? "bg-surface font-medium shadow-sm" : "text-text-2 hover:text-text")}>
              {o.label}
            </button>
          ))}
        </div>
        {needsReason && (
          <div>
            <div className="mb-1.5 text-[12px] text-text-3">Reason code</div>
            <div className="flex flex-wrap gap-1.5">
              {PASS_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)}
                  className={cn("h-7 rounded-full border px-2.5 text-[12px]", reason === r ? "border-accent bg-accent-soft text-accent" : "border-border text-text-2 hover:text-text")}>
                  {PASS_REASON_LABELS[r]}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="block">
          <span className="mb-1 block text-[12px] text-text-3">Note</span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={textarea}
            placeholder={kind === "lost" ? "Who won it, and at what terms?" : kind === "on_hold" ? "Why is the process paused?" : "What drove the decision?"} />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!valid}>Confirm</Button>
        </div>
      </form>
    </Dialog>
  );
}
