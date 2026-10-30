"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, FileText, Gavel, Lock, MessageSquarePlus, Pencil, Plus, Scale, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PASS_REASON_LABELS, type DB, type Deal, type ICCondition, type ICEvent } from "@/lib/schema";
import {
  addIcCondition, answerIcQuestion, askIcQuestion, decideIc, recordVote, removeIcCondition, satisfyCondition, updateIcCondition,
} from "@/lib/client/actions";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/store";
import { activeTermSet, dealMetrics, fieldValue, sectionIsStale, userById } from "@/lib/selectors";
import { findPrecedents, type Precedent } from "@/lib/queries";
import { fmtDate, fmtPct, fmtSpread, fmtUsdM, fmtX, titleCase, termSetLabel } from "@/lib/format";
import { Avatar, Button, Card, Chip, EmptyState, Label, Section, TextLink, cn } from "@/components/ui/primitives";
import { DealStatusChip, DecisionChip } from "@/components/ui/chips";
import { Dialog } from "@/components/ui/menu";

const VOTES = [
  { key: "approve", label: "Approve" },
  { key: "approve_with_conditions", label: "Approve w/ conditions" },
  { key: "decline", label: "Decline" },
  { key: "abstain", label: "Abstain" },
] as const;

const input = "h-9 w-full rounded-[10px] border border-border-strong bg-surface px-3 outline-none focus:border-focus";
const textarea = "w-full rounded-[12px] border border-border-strong bg-surface px-3 py-2 outline-none focus:border-focus";

export function IcTab({ db, deal }: { db: DB; deal: Deal }) {
  const events = db.icEvents.filter((e) => e.dealId === deal.id).sort((a, b) => b.date.localeCompare(a.date));
  const [selectedId, setSelectedId] = useState(events.find((e) => e.status === "pending")?.id ?? events[0]?.id);
  const ev = events.find((e) => e.id === selectedId) ?? events[0];
  const precedents = useMemo(() => findPrecedents(db, deal.id), [db, deal.id]);
  const da = db.devilsAdvocate.filter((d) => d.dealId === deal.id);

  return (
    <div className="space-y-5">
      {events.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {events.map((e) => (
            <button key={e.id} onClick={() => setSelectedId(e.id)}
              className={cn("flex h-8 items-center gap-2 rounded-[10px] border px-2.5 text-[13px]", e.id === ev?.id ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:text-text")}>
              <Gavel size={13} />{e.stage === "final" ? "Final IC" : "Screening IC"} · {fmtDate(e.date)}
              <span className="text-[11px] opacity-80">{e.status === "pending" ? "pending" : (e.decision ?? "").replace(/_/g, " ")}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {!ev ? (
            <EmptyState title="No IC scheduled">Submitting the deal to IC schedules the final committee.</EmptyState>
          ) : ev.status === "pending" ? (
            <PendingEvent db={db} deal={deal} ev={ev} />
          ) : (
            <DecidedEvent db={db} deal={deal} ev={ev} />
          )}
        </div>
        <aside className="space-y-6">
          {da.length > 0 && <DevilsAdvocate db={db} deal={deal} ev={ev} />}
          <Precedents db={db} precedents={precedents} />
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending committee
// ---------------------------------------------------------------------------

function PendingEvent({ db, deal, ev }: { db: DB; deal: Deal; ev: ICEvent }) {
  const user = useCurrentUser();
  const isIc = !!user && can(user.role, "decide_ic");
  return (
    <>
      <Packet db={db} deal={deal} ev={ev} />
      <Conditions db={db} deal={deal} editable={isIc} />
      <Votes db={db} ev={ev} />
      <QA db={db} ev={ev} />
      {isIc ? <DecisionPanel db={db} deal={deal} ev={ev} /> : (
        <Card className="p-4 text-[13px] text-text-2">The committee records votes and the decision. Switch to an IC persona (Robert Hale) to decide.</Card>
      )}
    </>
  );
}

function Packet({ db, deal, ev }: { db: DB; deal: Deal; ev: ICEvent }) {
  const memo = db.memos.find((m) => m.id === ev.memoId) ?? db.memos.find((m) => m.dealId === deal.id && m.memoType === (ev.stage === "final" ? "final" : "screening"));
  const ts = ev.status === "decided" ? db.termSets.find((t) => t.id === ev.termSetId) : activeTermSet(db, deal.id);
  const m = dealMetrics(db, deal.id, ts?.id);
  const stale = memo ? db.memoSections.filter((s) => s.memoId === memo.id && sectionIsStale(db, s)).length : 0;
  const warnings = [
    memo && memo.status === "draft" && "The memo is still a draft",
    stale > 0 && `${stale} memo section${stale === 1 ? " is" : "s are"} stale`,
    ts?.status === "draft" && `Term set v${ts.version} is a draft`,
    m.unconfirmed && "Adjusted EBITDA is not yet confirmed",
  ].filter(Boolean) as string[];
  return (
    <Section title={`${ev.stage === "final" ? "Final" : "Screening"} IC · ${fmtDate(ev.date)}`} actions={<DecisionChip decision={ev.decision} />}>
      <Card className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href={`/deals/${deal.id}/memo`} className="flex items-center gap-3 rounded-[10px] border border-border p-3 hover:border-border-strong">
            <FileText size={18} className="text-text-3" />
            <div className="min-w-0"><div className="font-medium">{memo ? `${titleCase(memo.memoType)} memo v${memo.version}` : "No memo"}</div>
              <div className="text-[12px] text-text-3">{memo ? (memo.status === "ready_for_ic" ? "Ready for IC" : titleCase(memo.status)) : "—"}</div></div>
          </Link>
          <Link href={`/deals/${deal.id}/securities${ts ? `?v=${ts.version}` : ""}`} className="flex items-center gap-3 rounded-[10px] border border-border p-3 hover:border-border-strong">
            {ts?.status === "locked" ? <Lock size={18} className="text-success" /> : <Scale size={18} className="text-text-3" />}
            <div className="min-w-0"><div className="font-medium">Term set v{ts?.version}</div>
              <div className="text-[12px] text-text-3">{ts ? `${termSetLabel(ts.label)} · ${ts.status}` : "—"}</div></div>
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
          {[["Facility", fmtUsdM(m.facilitySize)], ["Leverage", fmtX(m.leverage)], ["Cushion", fmtPct(m.cushion)], ["Spread", fmtSpread(m.spreadBps)]].map(([k, v]) => (
            <div key={k}><Label>{k}</Label><div className="font-medium tabular-nums">{v}</div></div>
          ))}
        </div>
        {warnings.length > 0 && ev.status === "pending" && (
          <div className="rounded-[10px] bg-warn-soft px-3 py-2 text-[13px] text-warn">{warnings.join(" · ")}</div>
        )}
      </Card>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function Conditions({ db, deal, editable, canSatisfy }: { db: DB; deal: Deal; editable: boolean; canSatisfy?: boolean }) {
  const conditions = db.icConditions.filter((c) => c.dealId === deal.id);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ICCondition | null>(null);
  return (
    <Section title="Conditions" actions={editable && <Button size="sm" variant="ghost" onClick={() => setAdding(true)}><Plus size={13} />Add condition</Button>}>
      {conditions.length === 0 ? <p className="text-[13px] text-text-3">No conditions proposed. Findings on Due Diligence can be turned into conditions.</p> : (
        <div className="space-y-2">
          {conditions.map((c) => {
            const owner = userById(db, c.ownerUserId);
            const source = db.ddItems.find((d) => d.id === c.sourceDdItemId);
            return (
              <div key={c.id} className="flex flex-wrap items-start justify-between gap-3 rounded-[12px] border border-border bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={c.status === "satisfied" ? "success" : c.status === "open" ? "warn" : "accent"}>{titleCase(c.status)}</Chip>
                    <Chip tone="outline">{c.type === "pre_close" ? "Pre-close" : c.type === "post_close" ? "Post-close" : "Terms"}</Chip>
                    <span>{c.description}</span>
                  </div>
                  <div className="mt-1 text-[12px] text-text-3">
                    {owner?.name}{c.dueDate && ` · due ${fmtDate(c.dueDate)}`}
                    {source && <> · from finding <Link href={`/deals/${deal.id}/diligence`} className="underline-offset-2 hover:underline">{source.title}</Link></>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {editable && c.status !== "satisfied" && <button onClick={() => setEditing(c)} className="rounded p-1.5 text-text-3 hover:bg-surface-2 hover:text-text" aria-label="Edit condition"><Pencil size={14} /></button>}
                  {editable && c.status === "proposed" && (
                    <button onClick={async () => { const r = await removeIcCondition(c.id); if (!r.ok) toast.error(r.error); else toast("Condition removed", { description: source ? "Its finding is unmitigated again." : undefined }); }}
                      className="rounded p-1.5 text-text-3 hover:bg-danger-soft hover:text-danger" aria-label="Remove condition"><Trash2 size={14} /></button>
                  )}
                  {canSatisfy && c.status === "open" && (
                    <Button size="sm" variant="outline" onClick={async () => { const r = await satisfyCondition(c.id); if (!r.ok) toast.error(r.error); else toast.success("Condition satisfied"); }}><Check size={13} />Mark satisfied</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {(adding || editing) && <ConditionDialog db={db} deal={deal} c={editing} onClose={() => { setAdding(false); setEditing(null); }} />}
    </Section>
  );
}

function ConditionDialog({ db, deal, c, onClose }: { db: DB; deal: Deal; c: ICCondition | null; onClose: () => void }) {
  const team = deal.teamUserIds.map((id) => userById(db, id)!).filter(Boolean);
  const [text, setText] = useState(c?.description ?? "");
  const [type, setType] = useState<ICCondition["type"]>(c?.type ?? "pre_close");
  const [owner, setOwner] = useState(c?.ownerUserId ?? deal.leadUserId);
  const [due, setDue] = useState(c?.dueDate ?? deal.expectedClose ?? "");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await (c ? updateIcCondition(c.id, { description: text, type, ownerUserId: owner, dueDate: due || undefined }) : addIcCondition(deal.id, text, type, owner, due || undefined));
    if (!r.ok) return toast.error(r.error);
    toast.success(c ? "Condition updated" : "Condition added");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={c ? "Edit condition" : "Add an IC condition"}>
      <form onSubmit={submit} className="space-y-3">
        <textarea autoFocus rows={3} className={textarea} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Quarterly customer concentration reporting for the first eight quarters" />
        <div className="grid grid-cols-3 gap-3">
          <select className={input} value={type} onChange={(e) => setType(e.target.value as ICCondition["type"])}><option value="pre_close">Pre-close</option><option value="post_close">Post-close</option><option value="terms">Terms</option></select>
          <select className={input} value={owner} onChange={(e) => setOwner(e.target.value)}>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          <input type="date" className={input} value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={!text.trim()}>Save</Button></div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function Votes({ db, ev }: { db: DB; ev: ICEvent }) {
  const user = useCurrentUser();
  const members = db.users.filter((u) => u.role === "ic_member");
  const [comment, setComment] = useState("");
  const mine = ev.votes.find((v) => v.userId === user?.id);
  const canVote = !!user && can(user.role, "record_vote") && ev.status === "pending";
  const vote = async (v: (typeof VOTES)[number]["key"]) => {
    const r = await recordVote(ev.id, v, comment);
    if (!r.ok) return toast.error(r.error);
    toast.success("Vote recorded");
    setComment("");
  };
  return (
    <Section title="Votes" actions={<span className="text-[12px] text-text-3">{ev.votes.length} of {members.length} voted</span>}>
      <Card className="divide-y divide-border">
        {members.map((u) => {
          const v = ev.votes.find((x) => x.userId === u.id);
          return (
            <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar initials={u.initials} size={28} />
              <div className="min-w-0 flex-1 leading-tight"><div>{u.name}</div><div className="text-[12px] text-text-3">{u.title}</div></div>
              <div className="text-right">
                {v ? <DecisionChip decision={v.vote} /> : <Chip tone="outline">Not voted</Chip>}
                {v?.comment && <div className="mt-0.5 max-w-[260px] text-[12px] text-text-3">“{v.comment}”</div>}
              </div>
            </div>
          );
        })}
        {canVote && (
          <div className="space-y-2 px-4 py-3">
            <div className="text-[12px] text-text-3">{mine ? "Change your vote" : "Your vote"}</div>
            <input className={input} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" />
            <div className="flex flex-wrap gap-2">
              {VOTES.map((o) => <Button key={o.key} size="sm" variant={mine?.vote === o.key ? "secondary" : "outline"} onClick={() => vote(o.key)}>{o.label}</Button>)}
            </div>
          </div>
        )}
      </Card>
    </Section>
  );
}

function QA({ db, ev }: { db: DB; ev: ICEvent }) {
  const user = useCurrentUser();
  const [q, setQ] = useState("");
  const [answering, setAnswering] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const canAsk = !!user && can(user.role, "add_note") && ev.status === "pending";
  const canAnswer = !!user && can(user.role, "edit_memo");
  return (
    <Section title="Q&A" actions={<span className="text-[12px] text-text-3">{ev.qa.length} question{ev.qa.length === 1 ? "" : "s"}</span>}>
      <div className="space-y-2">
        {ev.qa.length === 0 && <p className="text-[13px] text-text-3">No questions yet.</p>}
        {ev.qa.map((x, i) => (
          <Card key={i} className="space-y-1.5 p-3 text-[13px]">
            <div><span className="text-text-3">{userById(db, x.askedBy)?.name}:</span> <span className="font-medium">{x.question}</span></div>
            {x.answer ? <div className="text-text-2">→ {x.answer}</div> : answering === i ? (
              <div className="flex gap-2">
                <input autoFocus className={input} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Deal team answer" />
                <Button size="sm" variant="primary" onClick={async () => { const r = await answerIcQuestion(ev.id, i, answer); if (!r.ok) return toast.error(r.error); setAnswering(null); setAnswer(""); }}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setAnswering(null)}><X size={13} /></Button>
              </div>
            ) : canAnswer ? <button onClick={() => setAnswering(i)} className="text-[12px] text-accent hover:underline">Answer</button> : <div className="text-[12px] text-text-3">Awaiting the deal team&apos;s answer</div>}
          </Card>
        ))}
        {canAsk && (
          <form onSubmit={async (e) => { e.preventDefault(); const r = await askIcQuestion(ev.id, q); if (!r.ok) return toast.error(r.error); setQ(""); }} className="flex gap-2">
            <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask the deal team a question" />
            <Button type="submit" size="md" variant="outline" disabled={!q.trim()}><MessageSquarePlus size={14} />Ask</Button>
          </form>
        )}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------

function DecisionPanel({ db, deal, ev }: { db: DB; deal: Deal; ev: ICEvent }) {
  const [choice, setChoice] = useState<NonNullable<ICEvent["decision"]> | null>(null);
  const ts = activeTermSet(db, deal.id);
  const m = dealMetrics(db, deal.id);
  const [hold, setHold] = useState(String(m.fundHold));
  const [note, setNote] = useState("");
  const proposed = db.icConditions.filter((c) => c.dealId === deal.id && c.status === "proposed");
  const members = db.users.filter((u) => u.role === "ic_member");
  const effects: Record<string, string[]> = {
    approve: [`Locks term set v${ts?.version} as IC-approved (read-only)`, "Marks the memo final", `Approved hold ${fmtUsdM(Number(hold) || 0)}`, ...(proposed.length ? [`Opens ${proposed.length} proposed condition${proposed.length === 1 ? "" : "s"}`] : []), "Unlocks the move to Documentation"],
    approve_with_conditions: [`Locks term set v${ts?.version} as IC-approved (read-only)`, `Opens ${proposed.length} condition${proposed.length === 1 ? "" : "s"} for the deal team`, "Marks the memo final", `Approved hold ${fmtUsdM(Number(hold) || 0)}`, "Unlocks the move to Documentation"],
    defer: ["Records the deferral; the deal stays at IC and a new committee can be scheduled"],
    decline: ["Marks the deal passed (credit quality) with your note", "It stays searchable as a precedent"],
  };
  const submit = async () => {
    if (!choice) return;
    const r = await decideIc(ev.id, choice, choice.startsWith("approve") ? Number(hold) : undefined, note);
    if (!r.ok) return toast.error(r.error);
    toast.success(`IC decision recorded: ${choice.replace(/_/g, " ")}`, { description: choice.startsWith("approve") ? `Term set v${ts?.version} is locked.` : undefined });
    setChoice(null);
  };
  return (
    <Section title="Decision">
      <Card className="space-y-3 p-4">
        {ev.votes.length < members.length && <p className="text-[13px] text-text-3">{members.length - ev.votes.length} member{members.length - ev.votes.length === 1 ? " has" : "s have"} not voted.</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setChoice("approve_with_conditions")} disabled={proposed.length === 0} title={proposed.length === 0 ? "No proposed conditions" : undefined}><Gavel size={14} />Approve with conditions</Button>
          <Button variant="outline" onClick={() => setChoice("approve")}>Approve</Button>
          <Button variant="outline" onClick={() => setChoice("defer")}>Defer</Button>
          <Button variant="outline" onClick={() => setChoice("decline")} className="text-danger">Decline</Button>
        </div>
      </Card>
      {choice && (
        <Dialog open onOpenChange={(v) => !v && setChoice(null)} title={`Record: ${choice.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}`} description={`${deal.name} · final IC ${fmtDate(ev.date)}`}>
          <div className="space-y-4">
            <ul className="space-y-1.5 rounded-[10px] bg-surface-2/60 p-3 text-[13px]">
              {effects[choice].map((e) => <li key={e} className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-text-3" />{e}</li>)}
            </ul>
            {choice.startsWith("approve") && (
              <label className="block"><span className="mb-1 block text-[12px] text-text-3">Approved Fernhill hold ($M)</span><input className={input} inputMode="decimal" value={hold} onChange={(e) => setHold(e.target.value)} /></label>
            )}
            <label className="block"><span className="mb-1 block text-[12px] text-text-3">Note (optional)</span><input className={input} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setChoice(null)}>Cancel</Button><Button variant={choice === "decline" ? "danger" : "primary"} onClick={submit}>Record decision</Button></div>
          </div>
        </Dialog>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Decided committee
// ---------------------------------------------------------------------------

function DecidedEvent({ db, deal, ev }: { db: DB; deal: Deal; ev: ICEvent }) {
  const user = useCurrentUser();
  const ts = db.termSets.find((t) => t.id === ev.termSetId);
  const approved = ev.decision === "approve" || ev.decision === "approve_with_conditions";
  return (
    <>
      <Section title={`${ev.stage === "final" ? "Final" : "Screening"} IC · ${fmtDate(ev.date)}`} actions={<DecisionChip decision={ev.decision} />}>
        <Card className={cn("space-y-3 p-4", approved ? "border-success/30" : ev.decision === "decline" ? "border-danger/30" : "")}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
            <span>Decided {fmtDate(ev.decidedAt)}</span>
            {ev.approvedHold && <span>Approved hold <span className="font-medium">{fmtUsdM(ev.approvedHold)}</span></span>}
            {ts && approved && ev.stage === "final" && (
              <TextLink href={`/deals/${deal.id}/securities?v=${ts.version}`} className="flex items-center gap-1"><Lock size={13} className="text-success" />Term set v{ts.version} locked</TextLink>
            )}
          </div>
        </Card>
      </Section>
      {ev.stage === "final" && <Conditions db={db} deal={deal} editable={false} canSatisfy={!!user && can(user.role, "edit_dd")} />}
      <Votes db={db} ev={ev} />
      <QA db={db} ev={ev} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Devil's advocate and precedents (the firm's own history)
// ---------------------------------------------------------------------------

function DevilsAdvocate({ db, deal, ev }: { db: DB; deal: Deal; ev?: ICEvent }) {
  const user = useCurrentUser();
  const qs = db.devilsAdvocate.filter((d) => d.dealId === deal.id);
  const canAsk = !!user && can(user.role, "add_note") && ev?.status === "pending";
  return (
    <Section title="Devil's advocate">
      <p className="-mt-1 text-[12px] text-text-3">Questions this committee tends to ask, drawn from comparable past deals.</p>
      <div className="space-y-2">
        {qs.map((q) => {
          const asked = ev?.qa.some((x) => x.question === q.question);
          return (
            <Card key={q.id} className="space-y-2 p-3.5">
              <div className="font-medium leading-snug">{q.question}</div>
              <div className="text-[13px] text-text-2">{q.rationale}</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {q.precedentDealIds.map((id) => { const d = db.deals.find((x) => x.id === id); return d && <Link key={id} href={`/deals/${id}/ic`}><Chip tone="outline">↳ {d.name}</Chip></Link>; })}
                {canAsk && (asked ? <Chip tone="success"><Check size={11} />In Q&A</Chip> : (
                  <button className="ml-auto text-[12px] text-accent hover:underline" onClick={async () => { const r = await askIcQuestion(ev!.id, q.question); if (!r.ok) toast.error(r.error); else toast.success("Added to the Q&A"); }}>Ask at IC</button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

function Precedents({ db, precedents }: { db: DB; precedents: Precedent[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (precedents.length === 0) return null;
  return (
    <Section title="Precedents">
      <p className="-mt-1 text-[12px] text-text-3">Closed and passed deals with overlapping sector, size within ±50% and leverage within ±1.0x.</p>
      <div className="space-y-2">
        {precedents.map((p) => {
          const top = fieldValue(db, p.deal.id, "top_customer_pct");
          const qa = p.icEvents.flatMap((e) => e.qa.map((q) => ({ ...q, ev: e })));
          const final = [...p.icEvents].reverse().find((e) => e.decision);
          return (
            <Card key={p.deal.id} className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <TextLink href={`/deals/${p.deal.id}/overview`} className="font-medium">{p.deal.name}</TextLink>
                  <div className="text-[12px] text-text-3">{p.deal.sector}</div>
                </div>
                <DealStatusChip deal={p.deal} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[12px] tabular-nums">
                <div><Label>Leverage</Label>{fmtX(p.leverage)}</div>
                <div><Label>Spread</Label>{fmtSpread(p.spreadBps)}</div>
                <div><Label>Size</Label>{fmtUsdM(p.deal.requestedSize)}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {final && <DecisionChip decision={final.decision} />}
                {p.deal.passReason && <Chip tone="outline">{PASS_REASON_LABELS[p.deal.passReason]}</Chip>}
                {top && <Chip tone={Number(top.value) >= 25 ? "danger" : "outline"}>Top customer {String(top.value)}%</Chip>}
                {p.deal.tags.map((t) => <Chip key={t} tone="warn">{t}</Chip>)}
              </div>
              {p.deal.passNote && <p className="mt-2 text-[12px] text-text-2">{p.deal.passNote}</p>}
              <div className="mt-2 flex items-center gap-2 text-[11px] text-text-3">
                <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-accent" style={{ width: `${Math.round(p.score * 100)}%` }} /></div>
                {Math.round(p.score * 100)}% match · {p.sharedTags.map((t) => t.replace(/_/g, " ")).join(", ")}
              </div>
              {qa.length > 0 && (
                <div className="mt-2 border-t border-border pt-2">
                  <button onClick={() => setOpen(open === p.deal.id ? null : p.deal.id)} className="flex items-center gap-1 text-[12px] text-text-2 hover:text-text">
                    <ChevronDown size={13} className={cn("transition-transform", open === p.deal.id && "rotate-180")} />What IC asked ({qa.length})
                  </button>
                  {open === p.deal.id && (
                    <ul className="mt-2 space-y-2 text-[12px]">
                      {qa.map((q, i) => (
                        <li key={i}><div className="font-medium">{q.question}</div>{q.answer && <div className="text-text-2">→ {q.answer}</div>}<div className="text-text-3">{userById(db, q.askedBy)?.name} · {fmtDate(q.ev.date)}</div></li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
