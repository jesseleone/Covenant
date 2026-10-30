"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Gavel, Plus } from "lucide-react";
import { toast } from "sonner";
import { DD_STATUSES, SEVERITIES, WORKSTREAMS, type DB, type DDItem, type Deal, type ICCondition } from "@/lib/schema";
import { addDDItem, proposeIcCondition, updateDDItem, type NewDDItem } from "@/lib/client/actions";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/store";
import { userById } from "@/lib/selectors";
import { fmtDate, titleCase } from "@/lib/format";
import { Avatar, Button, Chip, EmptyState, cn } from "@/components/ui/primitives";
import { SeverityChip } from "@/components/ui/chips";
import { Dialog, Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";

const WS_LABEL = (w: string) => (w === "qoe" ? "Quality of earnings" : w === "kyc" ? "KYC / AML" : w === "it" ? "IT" : w === "collateral" ? "Collateral & liens" : titleCase(w));
const statusTone = (s: DDItem["status"]) => (s === "open" ? "warn" : s === "closed" || s === "accepted" || s === "mitigated" ? "success" : "neutral");
const input = "h-9 w-full rounded-[10px] border border-border-strong bg-surface px-3 outline-none focus:border-focus";

type Filter = "all" | "findings" | "requests" | "open";

export function DiligenceTab({ db, deal }: { db: DB; deal: Deal }) {
  const user = useCurrentUser();
  const canEdit = !!user && can(user.role, "edit_dd");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [proposing, setProposing] = useState<DDItem | null>(null);
  const [mitigating, setMitigating] = useState<DDItem | null>(null);

  const all = db.ddItems.filter((d) => d.dealId === deal.id);
  const items = all.filter((d) =>
    filter === "findings" ? d.kind === "finding" : filter === "requests" ? d.kind === "request" : filter === "open" ? d.status === "open" || d.status === "received" : true);
  const redFlags = all.filter((d) => d.severity === "red_flag");
  const unresolved = redFlags.filter((d) => !d.mitigant && !d.icConditionId);
  const groups = WORKSTREAMS.map((w) => [w, items.filter((i) => i.workstream === w)] as const).filter(([, xs]) => xs.length);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={unresolved.length ? "danger" : "success"}>{redFlags.length} red flag{redFlags.length === 1 ? "" : "s"}{unresolved.length ? ` · ${unresolved.length} unresolved` : " · all addressed"}</Chip>
          <Chip tone="neutral">{all.filter((d) => d.status === "open").length} open</Chip>
          <Chip tone="outline">{all.filter((d) => d.status === "closed" || d.status === "accepted").length} of {all.length} closed</Chip>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-[10px] border border-border bg-surface p-0.5 text-[12px]">
            {(["all", "findings", "requests", "open"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("h-7 rounded-[8px] px-2.5", filter === f ? "bg-surface-2 font-medium" : "text-text-2 hover:text-text")}>{titleCase(f)}</button>
            ))}
          </div>
          {canEdit && <Button size="sm" variant="primary" onClick={() => setAdding(true)}><Plus size={14} />Add item</Button>}
        </div>
      </div>
      {unresolved.length > 0 && (
        <p className="text-[13px] text-text-2">Each red-flag finding needs a mitigant or an IC condition before the deal can go to final IC.</p>
      )}

      {groups.length === 0 ? <EmptyState title="No items">Nothing matches this filter.</EmptyState> : groups.map(([w, xs]) => (
        <section key={w} className="space-y-2">
          <h3 className="text-[13px] font-medium text-text-2">{WS_LABEL(w)} <span className="font-normal text-text-3">{xs.length}</span></h3>
          <div className="space-y-2">
            {[...xs].sort((a, b) => sevRank(a) - sevRank(b)).map((d) => (
              <ItemCard key={d.id} db={db} deal={deal} d={d} canEdit={canEdit} onPropose={() => setProposing(d)} onMitigate={() => setMitigating(d)} />
            ))}
          </div>
        </section>
      ))}

      {adding && <AddItemDialog db={db} deal={deal} onClose={() => setAdding(false)} />}
      {proposing && <ProposeDialog db={db} deal={deal} d={proposing} onClose={() => setProposing(null)} />}
      {mitigating && <MitigantDialog d={mitigating} onClose={() => setMitigating(null)} />}
    </div>
  );
}

const sevRank = (d: DDItem) => (d.kind === "finding" ? SEVERITIES.indexOf(d.severity ?? "low") : 10);

function ItemCard({ db, deal, d, canEdit, onPropose, onMitigate }: { db: DB; deal: Deal; d: DDItem; canEdit: boolean; onPropose: () => void; onMitigate: () => void }) {
  const owner = userById(db, d.ownerUserId);
  const cond = db.icConditions.find((c) => c.id === d.icConditionId);
  const needsAction = d.kind === "finding" && d.severity === "red_flag" && !d.mitigant && !d.icConditionId;
  return (
    <div className={cn("rounded-[12px] border bg-surface p-3.5", needsAction ? "border-danger/40" : "border-border")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {d.kind === "finding" ? <SeverityChip severity={d.severity} /> : <Chip tone="outline">Request</Chip>}
            <span className="font-medium">{d.title}</span>
          </div>
          <p className="mt-1 text-[13px] text-text-2">{d.detail}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[12px] text-text-3">
          {d.dueDate && <span>Due {fmtDate(d.dueDate)}</span>}
          {owner && <Avatar initials={owner.initials} title={owner.name} size={22} />}
          {canEdit ? (
            <Menu>
              <MenuTrigger asChild>
                <button className="flex items-center gap-1"><Chip tone={statusTone(d.status)}>{titleCase(d.status)}<ChevronDown size={11} /></Chip></button>
              </MenuTrigger>
              <MenuContent align="end">
                {DD_STATUSES.map((st) => (
                  <MenuItem key={st} onSelect={async () => { const r = await updateDDItem(d.id, { status: st }); if (!r.ok) toast.error(r.error); }}>{titleCase(st)}</MenuItem>
                ))}
              </MenuContent>
            </Menu>
          ) : <Chip tone={statusTone(d.status)}>{titleCase(d.status)}</Chip>}
        </div>
      </div>

      {(d.mitigant || cond) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-[10px] bg-surface-2/60 px-3 py-2 text-[13px]">
          {cond ? (
            <>
              <Gavel size={14} className="text-accent" />
              <span>IC condition ({cond.type === "pre_close" ? "pre-close" : cond.type === "post_close" ? "post-close" : "terms"}): {cond.description}</span>
              <Link href={`/deals/${deal.id}/ic`}><Chip tone={cond.status === "satisfied" ? "success" : cond.status === "open" ? "warn" : "accent"}>{titleCase(cond.status)}</Chip></Link>
            </>
          ) : (
            <><span className="text-text-3">Mitigant:</span><span>{d.mitigant}</span></>
          )}
        </div>
      )}

      {canEdit && d.kind === "finding" && !cond && (
        <div className="mt-2.5 flex gap-2">
          <Button size="sm" variant={needsAction ? "primary" : "outline"} onClick={onPropose}><Gavel size={13} />Propose IC condition</Button>
          <Button size="sm" variant="ghost" onClick={onMitigate}>{d.mitigant ? "Edit mitigant" : "Add mitigant"}</Button>
        </div>
      )}
    </div>
  );
}

/** A sensible first draft of the condition, which the user edits. */
function draftCondition(d: DDItem) {
  const t = d.title.toLowerCase();
  if (t.includes("customer")) return "Customer reference call with the top customer and review of MSA renewal terms prior to close";
  if (t.includes("add-back") || t.includes("qoe")) return "Underwriting EBITDA to follow the QoE; bring-down of QoE before funding";
  return `Resolve before close: ${d.title}`;
}

function ProposeDialog({ db, deal, d, onClose }: { db: DB; deal: Deal; d: DDItem; onClose: () => void }) {
  const team = deal.teamUserIds.map((id) => userById(db, id)!).filter(Boolean);
  const [text, setText] = useState(draftCondition(d));
  const [type, setType] = useState<ICCondition["type"]>("pre_close");
  const [owner, setOwner] = useState(d.ownerUserId ?? deal.leadUserId);
  const [due, setDue] = useState(deal.expectedClose ?? "");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await proposeIcCondition(d.id, text, type, owner, due || undefined);
    if (!r.ok) return toast.error(r.error);
    toast.success("IC condition proposed", { description: "It appears on IC & Approvals for the committee to accept, and the finding counts as mitigated." });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="Propose an IC condition" description={`From finding: ${d.title}`}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block"><span className="mb-1 block text-[12px] text-text-3">Condition</span>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-[12px] border border-border-strong bg-surface px-3 py-2 outline-none focus:border-focus" autoFocus />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block"><span className="mb-1 block text-[12px] text-text-3">Type</span>
            <select className={input} value={type} onChange={(e) => setType(e.target.value as ICCondition["type"])}>
              <option value="pre_close">Pre-close</option><option value="post_close">Post-close</option><option value="terms">Terms</option>
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-[12px] text-text-3">Owner</span>
            <select className={input} value={owner} onChange={(e) => setOwner(e.target.value)}>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          </label>
          <label className="block"><span className="mb-1 block text-[12px] text-text-3">Due</span>
            <input type="date" className={input} value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={!text.trim()}>Propose condition</Button></div>
      </form>
    </Dialog>
  );
}

function MitigantDialog({ d, onClose }: { d: DDItem; onClose: () => void }) {
  const [text, setText] = useState(d.mitigant ?? "");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await updateDDItem(d.id, { mitigant: text, status: text.trim() ? "mitigated" : d.status });
    if (!r.ok) return toast.error(r.error);
    toast.success("Mitigant saved");
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="Mitigant" description={d.title}>
      <form onSubmit={submit} className="space-y-3">
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus className="w-full rounded-[12px] border border-border-strong bg-surface px-3 py-2 outline-none focus:border-focus" placeholder="How is this risk addressed?" />
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary">Save</Button></div>
      </form>
    </Dialog>
  );
}

function AddItemDialog({ db, deal, onClose }: { db: DB; deal: Deal; onClose: () => void }) {
  const team = deal.teamUserIds.map((id) => userById(db, id)!).filter(Boolean);
  const [v, setV] = useState<NewDDItem>({ workstream: "commercial", kind: "finding", title: "", detail: "", severity: "medium", ownerUserId: team[0]?.id });
  const set = (p: Partial<NewDDItem>) => setV((x) => ({ ...x, ...p }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await addDDItem(deal.id, v);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Added ${v.kind}`);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Add diligence item">
      <form onSubmit={submit} className="space-y-3">
        <div className="flex rounded-[10px] border border-border bg-surface-2/50 p-0.5">
          {(["finding", "request"] as const).map((k) => (
            <button type="button" key={k} onClick={() => set({ kind: k })} className={cn("h-8 flex-1 rounded-[8px] text-[13px]", v.kind === k ? "bg-surface font-medium shadow-sm" : "text-text-2")}>{titleCase(k)}</button>
          ))}
        </div>
        <label className="block"><span className="mb-1 block text-[12px] text-text-3">Title</span><input autoFocus className={input} value={v.title} onChange={(e) => set({ title: e.target.value })} /></label>
        <label className="block"><span className="mb-1 block text-[12px] text-text-3">Detail</span><textarea rows={2} className="w-full rounded-[12px] border border-border-strong bg-surface px-3 py-2 outline-none focus:border-focus" value={v.detail} onChange={(e) => set({ detail: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-[12px] text-text-3">Workstream</span>
            <select className={input} value={v.workstream} onChange={(e) => set({ workstream: e.target.value as DDItem["workstream"] })}>{WORKSTREAMS.map((w) => <option key={w} value={w}>{WS_LABEL(w)}</option>)}</select>
          </label>
          {v.kind === "finding" ? (
            <label className="block"><span className="mb-1 block text-[12px] text-text-3">Severity</span>
              <select className={input} value={v.severity} onChange={(e) => set({ severity: e.target.value as DDItem["severity"] })}>{SEVERITIES.map((s) => <option key={s} value={s}>{s === "red_flag" ? "Red flag" : titleCase(s)}</option>)}</select>
            </label>
          ) : (
            <label className="block"><span className="mb-1 block text-[12px] text-text-3">Due</span><input type="date" className={input} value={v.dueDate ?? ""} onChange={(e) => set({ dueDate: e.target.value || undefined })} /></label>
          )}
          <label className="col-span-2 block"><span className="mb-1 block text-[12px] text-text-3">Owner</span>
            <select className={input} value={v.ownerUserId} onChange={(e) => set({ ownerUserId: e.target.value })}>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={!v.title.trim()}>Add</Button></div>
      </form>
    </Dialog>
  );
}
