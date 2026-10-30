"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Building2, Plus, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { STAKEHOLDER_SIDES, type DB, type Deal, type Stakeholder } from "@/lib/schema";
import { addStakeholder, removeStakeholder } from "@/lib/client/actions";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/store";
import { openNew } from "@/lib/ui";
import { companyById, currentAffiliation, lastTouchAt, personById, relationshipStrength, userById } from "@/lib/selectors";
import { fmtDate, titleCase } from "@/lib/format";
import { Avatar, Button, Card, Section, TextLink, cn } from "@/components/ui/primitives";
import { StrengthChip } from "@/components/ui/chips";
import { Dialog } from "@/components/ui/menu";

const SIDE_LABEL: Record<Stakeholder["side"], string> = { borrower: "Borrower", sponsor: "Sponsor", advisor: "Advisors & counsel", lender: "Lenders & agent", internal: "Internal" };
const ROLE_SUGGESTIONS: Record<Stakeholder["side"], string[]> = {
  borrower: ["Borrower CEO", "Borrower CFO", "Borrower COO"],
  sponsor: ["Sponsor deal lead", "Sponsor VP", "Sponsor operating partner"],
  advisor: ["Banker – sell-side", "QoE provider", "Lender counsel", "Borrower counsel", "Commercial diligence"],
  lender: ["Co-lender", "Administrative agent"],
  internal: ["Deal team"],
};

export function StakeholdersTab({ db, deal }: { db: DB; deal: Deal }) {
  const user = useCurrentUser();
  const canEdit = !!user && can(user.role, "edit_deal");
  const [adding, setAdding] = useState(false);
  const rows = db.stakeholders.filter((s) => s.dealId === deal.id);
  const sides = STAKEHOLDER_SIDES.filter((s) => s !== "internal" && rows.some((r) => r.side === s));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-text-2">{rows.length} people and companies on this deal, by side.</p>
        {canEdit && <Button size="sm" variant="primary" onClick={() => setAdding(true)}><Plus size={14} />Add stakeholder</Button>}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {sides.map((side) => (
          <Section key={side} title={SIDE_LABEL[side]}>
            <Card className="divide-y divide-border">
              {rows.filter((r) => r.side === side).map((s) => {
                const person = personById(db, s.personId);
                const company = person ? companyById(db, currentAffiliation(db, person.id)?.companyId) : companyById(db, s.companyId);
                return (
                  <div key={s.id} className="group flex items-center gap-3 px-4 py-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-3">{person ? <User size={15} /> : <Building2 size={15} />}</span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="font-medium">{person ? <TextLink href={`/people/${person.id}/overview`}>{person.fullName}</TextLink> : company && <TextLink href={`/companies/${company.id}/overview`}>{company.name}</TextLink>}</div>
                      <div className="truncate text-[12px] text-text-3">{s.role}{person && company && <> · <TextLink href={`/companies/${company.id}/overview`} className="text-text-3">{company.name}</TextLink></>}</div>
                    </div>
                    {person && (
                      <div className="text-right text-[12px] text-text-3">
                        <StrengthChip strength={relationshipStrength(db, person.id)} />
                        <div className="mt-0.5">{lastTouchAt(db, person.id) ? `Last touch ${fmtDate(lastTouchAt(db, person.id))}` : "No touchpoints"}</div>
                      </div>
                    )}
                    {canEdit && (
                      <button onClick={async () => { const r = await removeStakeholder(s.id); if (!r.ok) toast.error(r.error); }} aria-label="Remove" className="rounded p-1 text-text-3 opacity-0 group-hover:opacity-100 hover:text-danger"><Trash2 size={14} /></button>
                    )}
                  </div>
                );
              })}
            </Card>
          </Section>
        ))}
        <Section title="Fernhill deal team">
          <Card className="divide-y divide-border">
            {deal.teamUserIds.map((id) => {
              const u = userById(db, id)!;
              return (
                <div key={id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar initials={u.initials} size={32} />
                  <div className="leading-tight"><div className="font-medium">{u.name}</div><div className="text-[12px] text-text-3">{u.title}{id === deal.leadUserId ? " · Deal lead" : ""}</div></div>
                </div>
              );
            })}
          </Card>
        </Section>
      </div>
      {adding && <AddStakeholderDialog db={db} deal={deal} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddStakeholderDialog({ db, deal, onClose }: { db: DB; deal: Deal; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<{ type: "person" | "company"; id: string; name: string } | null>(null);
  const [side, setSide] = useState<Stakeholder["side"]>("advisor");
  const [role, setRole] = useState("");
  const pool = useMemo(() => [
    ...db.people.map((p) => { const a = currentAffiliation(db, p.id); return { type: "person" as const, id: p.id, name: p.fullName, detail: `${a?.title ?? ""} @ ${companyById(db, a?.companyId)?.name ?? ""}`, keys: [p.fullName] }; }),
    ...db.companies.map((c) => ({ type: "company" as const, id: c.id, name: c.name, detail: c.types.map(titleCase).join(", "), keys: [c.name, ...c.aliases] })),
  ], [db]);
  const fuse = useMemo(() => new Fuse(pool, { keys: ["keys"], threshold: 0.35, ignoreLocation: true }), [pool]);
  const results = q.trim() ? fuse.search(q).slice(0, 6).map((r) => r.item) : [];

  const choose = (r: (typeof pool)[number]) => {
    setPick(r);
    const p = db.people.find((x) => x.id === r.id);
    const s: Stakeholder["side"] = p ? (p.personType === "management" ? "borrower" : p.personType === "sponsor" ? "sponsor" : p.personType === "lender" ? "lender" : "advisor") : "advisor";
    setSide(s);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pick) return;
    const r = await addStakeholder(deal.id, { personId: pick.type === "person" ? pick.id : undefined, companyId: pick.type === "company" ? pick.id : undefined, role, side });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Added ${pick.name}`);
    onClose();
  };
  const input = "h-9 w-full rounded-[10px] border border-border-strong bg-surface px-3 outline-none focus:border-focus";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="Add stakeholder" description={`Someone involved in ${deal.name}`}>
      <form onSubmit={submit} className="space-y-3.5">
        {pick ? (
          <div className="flex items-center justify-between rounded-[10px] border border-border bg-surface-2/50 px-3 py-2">
            <span className="font-medium">{pick.name}</span><button type="button" onClick={() => setPick(null)} className="text-[12px] text-text-3 hover:text-text">Change</button>
          </div>
        ) : (
          <div>
            <input autoFocus className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people and companies" />
            <div className="mt-1 space-y-0.5">
              {results.map((r) => (
                <button type="button" key={r.id} onClick={() => choose(r)} className="flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-2">
                  <span className="flex items-center gap-2">{r.type === "person" ? <User size={13} className="text-text-3" /> : <Building2 size={13} className="text-text-3" />}{r.name}</span>
                  <span className="truncate text-[11px] text-text-3">{r.detail}</span>
                </button>
              ))}
              {q.trim() && (
                <button type="button" onClick={() => { onClose(); openNew("person"); }} className="flex w-full items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-left text-[13px] text-accent hover:bg-surface-2"><Plus size={13} />Create a new person</button>
              )}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-[12px] text-text-3">Side</span>
            <select className={input} value={side} onChange={(e) => setSide(e.target.value as Stakeholder["side"])}>{STAKEHOLDER_SIDES.filter((s) => s !== "internal").map((s) => <option key={s} value={s}>{SIDE_LABEL[s]}</option>)}</select>
          </label>
          <label className="block"><span className="mb-1 block text-[12px] text-text-3">Role</span><input className={input} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Lender counsel" /></label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ROLE_SUGGESTIONS[side].map((r) => <button type="button" key={r} onClick={() => setRole(r)} className={cn("h-6 rounded-full border px-2 text-[11px]", role === r ? "border-accent bg-accent-soft text-accent" : "border-border text-text-3 hover:text-text")}>{r}</button>)}
        </div>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={!pick || !role.trim()}>Add</Button></div>
      </form>
    </Dialog>
  );
}
