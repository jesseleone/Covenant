"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, FileText, Gavel, MessageSquare, PenLine, Scale, Search, Table2 } from "lucide-react";
import type { AuditEvent, DB, Deal } from "@/lib/schema";
import { userById } from "@/lib/selectors";
import { fmtDate } from "@/lib/format";
import { Avatar, Card, EmptyState, cn } from "@/components/ui/primitives";

type Cat = { key: string; label: string; icon: typeof Gavel; prefixes: string[]; tab: string };

const CATS: Cat[] = [
  { key: "stage", label: "Stage", icon: ArrowRightLeft, prefixes: ["stage.", "deal."], tab: "overview" },
  { key: "financials", label: "Financials", icon: Table2, prefixes: ["field."], tab: "financials" },
  { key: "terms", label: "Terms", icon: Scale, prefixes: ["termset."], tab: "securities" },
  { key: "diligence", label: "Diligence", icon: Search, prefixes: ["dd."], tab: "diligence" },
  { key: "memo", label: "Memo", icon: PenLine, prefixes: ["memo."], tab: "memo" },
  { key: "ic", label: "IC", icon: Gavel, prefixes: ["ic."], tab: "ic" },
  { key: "notes", label: "Notes & docs", icon: MessageSquare, prefixes: ["note.", "document."], tab: "notes" },
];

const catOf = (e: AuditEvent) => CATS.find((c) => c.prefixes.some((p) => e.action.startsWith(p))) ?? { key: "other", label: "Other", icon: FileText, prefixes: [], tab: "overview" };

export function HistoryTab({ db, deal }: { db: DB; deal: Deal }) {
  const all = useMemo(() => db.auditEvents.filter((e) => e.dealId === deal.id).sort((a, b) => b.at.localeCompare(a.at)), [db, deal.id]);
  const lastIc = db.icEvents.filter((e) => e.dealId === deal.id && e.status === "decided" && e.decidedAt).sort((a, b) => b.decidedAt!.localeCompare(a.decidedAt!))[0];
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [actor, setActor] = useState<string>("");
  const [sinceIc, setSinceIc] = useState(false);

  const shown = all.filter((e) =>
    (cats.size === 0 || cats.has(catOf(e).key)) && (!actor || e.actorId === actor) && (!sinceIc || !lastIc || e.at > lastIc.decidedAt!));
  const actors = [...new Set(all.map((e) => e.actorId))].map((id) => userById(db, id)).filter(Boolean);

  const days = new Map<string, AuditEvent[]>();
  for (const e of shown) {
    const d = e.at.slice(0, 10);
    days.set(d, [...(days.get(d) ?? []), e]);
  }

  const toggle = (k: string) => setCats((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {CATS.map((c) => {
            const n = all.filter((e) => catOf(e).key === c.key).length;
            if (!n) return null;
            return (
              <button key={c.key} onClick={() => toggle(c.key)}
                className={cn("flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px]", cats.has(c.key) ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:text-text")}>
                <c.icon size={12} />{c.label} <span className="opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <select value={actor} onChange={(e) => setActor(e.target.value)} className="h-8 rounded-[8px] border border-border-strong bg-surface px-2 text-[13px]">
            <option value="">Everyone</option>
            {actors.map((u) => <option key={u!.id} value={u!.id}>{u!.name}</option>)}
          </select>
          {lastIc && (
            <button onClick={() => setSinceIc((v) => !v)}
              className={cn("flex h-8 items-center gap-1.5 rounded-[8px] border px-2.5 text-[13px]", sinceIc ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:text-text")}>
              <Gavel size={13} />Since last IC
            </button>
          )}
        </div>
      </div>

      {sinceIc && lastIc && (
        <p className="text-[13px] text-text-2">
          {shown.length} change{shown.length === 1 ? "" : "s"} since the {lastIc.stage === "final" ? "final" : "screening"} IC decision on {fmtDate(lastIc.decidedAt)} ({lastIc.decision?.replace(/_/g, " ")}).
        </p>
      )}

      {shown.length === 0 ? <EmptyState title="Nothing matches these filters" /> : (
        <Card className="px-5 py-2">
          {[...days].map(([day, events]) => (
            <div key={day} className="py-3">
              <div className="mb-2 text-[12px] font-medium text-text-3">{fmtDate(day)}</div>
              <ol className="relative space-y-3 border-l border-border pl-5">
                {events.map((e) => {
                  const c = catOf(e);
                  const u = userById(db, e.actorId);
                  return (
                    <li key={e.id} className="relative">
                      <span className="absolute top-0.5 -left-[31px] flex size-5 items-center justify-center rounded-full border border-border bg-surface text-text-3"><c.icon size={11} /></span>
                      <div className="flex flex-wrap items-start justify-between gap-x-4">
                        <Link href={`/deals/${deal.id}/${c.tab}`} className="min-w-0 flex-1 hover:text-accent">{e.summary}</Link>
                        <span className="shrink-0 text-[12px] text-text-3">{e.at.slice(11, 16)}</span>
                      </div>
                      {e.field && (e.before || e.after) && !e.summary.includes("→") && (
                        <div className="mt-0.5 font-mono text-[11.5px] text-text-3">{e.field}: {e.before ?? "—"} → {e.after ?? "—"}</div>
                      )}
                      <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-text-3"><Avatar initials={u?.initials ?? "?"} size={16} />{u?.name} · {c.label}</div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
