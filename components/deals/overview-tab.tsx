"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CircleDashed, Lock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { STAGE_LABELS, STRATEGY_LABELS, type DB, type Deal } from "@/lib/schema";
import { HARD_GATES, checklistFor, nextStage } from "@/lib/gates";
import { updateDealText } from "@/lib/actions";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/store";
import { activeTermSet, userById } from "@/lib/selectors";
import { fmtDate, fmtUsdM, titleCase } from "@/lib/format";
import { Avatar, Button, Card, Chip, KV, Label, Section } from "@/components/ui/primitives";
import { SeverityChip } from "@/components/ui/chips";
import { AuditList } from "@/components/common/timeline";

export function OverviewTab({ db, deal }: { db: DB; deal: Deal }) {
  const redFlags = db.ddItems.filter((d) => d.dealId === deal.id && d.severity === "red_flag" && d.status !== "closed");
  const conditions = db.icConditions.filter((c) => c.dealId === deal.id);
  const recent = db.auditEvents.filter((e) => e.dealId === deal.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <EditableText deal={deal} field="summary" title="Summary" />
        <EditableText deal={deal} field="thesis" title="Thesis" />
        <Section title="Open red flags">
          {redFlags.length === 0 ? <p className="text-text-3">None.</p> : (
            <ul className="space-y-2">{redFlags.map((d) => (
              <li key={d.id} className="flex items-start gap-2">
                <SeverityChip severity={d.severity} />
                <Link href={`/deals/${deal.id}/diligence`} className="hover:text-accent">{d.title}</Link>
                {(d.mitigant || d.icConditionId) && <Chip tone="success">Mitigated</Chip>}
              </li>
            ))}</ul>
          )}
        </Section>
        {conditions.length > 0 && (
          <Section title="IC conditions">
            <ul className="space-y-2">{conditions.map((c) => (
              <li key={c.id} className="flex items-start gap-2"><Chip tone={c.status === "satisfied" ? "success" : "warn"}>{titleCase(c.status)}</Chip><span>{c.description}</span></li>
            ))}</ul>
          </Section>
        )}
        <Section title="Recent activity"><AuditList db={db} events={recent} /></Section>
      </div>

      <aside className="space-y-4">
        <NextStageCard db={db} deal={deal} />
        <CompleteRecordCard db={db} deal={deal} />
        <Card className="grid grid-cols-2 gap-4 p-4">
          <KV label="Strategy">{STRATEGY_LABELS[deal.strategy]}</KV>
          <KV label="Deal type">{deal.dealType.toUpperCase().replace("_", "-")}</KV>
          <KV label="Requested size">{fmtUsdM(deal.requestedSize)}</KV>
          <KV label="Fund hold target">{fmtUsdM(deal.fundHoldTarget)}</KV>
          <KV label="Expected close">{fmtDate(deal.expectedClose)}</KV>
          <KV label="Sector">{deal.sector}</KV>
        </Card>
        <Card className="space-y-2.5 p-4">
          <Label>Deal team</Label>
          {deal.teamUserIds.map((id) => {
            const u = userById(db, id)!;
            return (
              <div key={id} className="flex items-center gap-2.5">
                <Avatar initials={u.initials} size={26} />
                <div className="leading-tight"><div>{u.name}</div><div className="text-[12px] text-text-3">{u.title}{id === deal.leadUserId ? " · Lead" : ""}</div></div>
              </div>
            );
          })}
        </Card>
      </aside>
    </div>
  );
}

/** "What's needed for the next gate", computed from the same rules the pipeline enforces. */
function NextStageCard({ db, deal }: { db: DB; deal: Deal }) {
  const next = deal.status === "active" ? nextStage(deal.stage) : null;
  if (!next) return null;
  const items = checklistFor(db, deal, next);
  const met = items.filter((i) => i.met).length;
  const hard = HARD_GATES.includes(next);
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Label className="text-text-2">Next: {STAGE_LABELS[next]}</Label>
        {items.length > 0 && <Chip tone={met === items.length ? "success" : hard ? "danger" : "warn"}>{met} of {items.length} ready</Chip>}
      </div>
      {items.length === 0 ? <p className="text-[13px] text-text-3">No requirements.</p> : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.label}>
              <Link href={i.href} className="flex items-start gap-2 text-[13px] hover:text-accent">
                {i.met ? <Check size={15} className="mt-0.5 shrink-0 text-success" /> : hard ? <Lock size={15} className="mt-0.5 shrink-0 text-danger" /> : <CircleDashed size={15} className="mt-0.5 shrink-0 text-warn" />}
                <span className={i.met ? "text-text-2" : undefined}>{i.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hard && met < items.length && <p className="mt-3 text-[12px] text-text-3">This requirement can&apos;t be overridden.</p>}
    </Card>
  );
}

/** Prompts for fields a new deal still needs; hidden once the record is complete. */
function CompleteRecordCard({ db, deal }: { db: DB; deal: Deal }) {
  const ts = activeTermSet(db, deal.id);
  const missing = [
    !deal.sponsorCompanyId && "Sponsor",
    !deal.expectedClose && deal.status === "active" && "Expected close",
    !deal.riskRating && "Risk rating",
    !deal.summary && "Summary",
    !deal.thesis && "Thesis",
    (!ts || db.tranches.every((t) => t.termSetId !== ts.id)) && "Proposed terms",
  ].filter(Boolean) as string[];
  if (missing.length === 0 || deal.status !== "active") return null;
  return (
    <Card className="border-dashed p-4">
      <Label className="mb-2 text-text-2">Complete this record</Label>
      <div className="flex flex-wrap gap-1.5">{missing.map((m) => <Chip key={m} tone="outline">{m}</Chip>)}</div>
    </Card>
  );
}

function EditableText({ deal, field, title }: { deal: Deal; field: "summary" | "thesis"; title: string }) {
  const user = useCurrentUser();
  const [draft, setDraft] = useState<string | null>(null);
  const canEdit = !!user && can(user.role, "edit_deal");
  const save = () => {
    const r = updateDealText(deal.id, field, draft!.trim());
    if (!r.ok) return toast.error(r.error);
    setDraft(null);
    toast.success(`${title} saved`);
  };
  return (
    <Section
      title={title}
      actions={canEdit && draft === null ? (
        <button onClick={() => setDraft(deal[field] ?? "")} className="flex items-center gap-1 rounded-[8px] px-2 py-1 text-[12px] text-text-3 hover:bg-surface-2 hover:text-text"><Pencil size={13} />Edit</button>
      ) : undefined}
    >
      {draft === null ? (
        <p className="prose-serif">{deal[field] || <span className="text-text-3">Not written yet.</span>}</p>
      ) : (
        <div className="space-y-2">
          <textarea
            autoFocus rows={4} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setDraft(null); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }}
            className="prose-serif w-full rounded-[12px] border border-border-strong bg-surface px-3 py-2 outline-none focus:border-focus"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={save}>Save</Button>
          </div>
        </div>
      )}
    </Section>
  );
}
