"use client";

import Link from "next/link";
import { STAGES, STAGE_LABELS, PASS_REASON_LABELS, type DB, type Deal } from "@/lib/schema";
import { useDB } from "@/lib/store";
import { companyById, daysInStage, dealMetrics, userById } from "@/lib/selectors";
import { fmtUsdM } from "@/lib/format";
import { Avatar, Chip } from "@/components/ui/primitives";

export function PipelineBoard() {
  const db = useDB();
  const active = (s: string) => db.deals.filter((d) => d.status === "active" && d.stage === s);
  const closed = db.deals.filter((d) => d.status === "closed");
  const out = db.deals.filter((d) => d.status === "passed" || d.status === "lost" || d.status === "on_hold");

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STAGES.map((s) => {
        const deals = s === "closed" ? closed : active(s);
        const total = deals.reduce((sum, d) => sum + d.requestedSize, 0);
        return (
          <Column key={s} title={STAGE_LABELS[s]} count={deals.length} total={total}>
            {deals.map((d) => <DealCard key={d.id} db={db} deal={d} />)}
          </Column>
        );
      })}
      <Column title="Passed / Lost" count={out.length} total={out.reduce((s, d) => s + d.requestedSize, 0)} muted>
        {out.map((d) => <DealCard key={d.id} db={db} deal={d} />)}
      </Column>
    </div>
  );

}

function DealCard({ db, deal: d }: { db: DB; deal: Deal }) {
  const m = dealMetrics(db, d.id);
  const lead = userById(db, d.leadUserId);
  const days = daysInStage(db, d);
  const redFlags = db.ddItems.filter((x) => x.dealId === d.id && x.severity === "red_flag" && x.status === "open").length;
  return (
    <Link href={`/deals/${d.id}/overview`} className="block rounded-[12px] border border-border bg-surface p-3 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{d.codename}</div>
          <div className="truncate text-[12px] text-text-3">{companyById(db, d.borrowerCompanyId)?.name}</div>
        </div>
        {lead && <Avatar initials={lead.initials} title={lead.name} size={22} />}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] tabular-nums">{fmtUsdM(m.facilitySize)}</span>
        {d.status === "active" && <Chip tone={days > 30 ? "warn" : "neutral"}>{days}d</Chip>}
        {redFlags > 0 && <Chip tone="danger">{redFlags} red flag</Chip>}
        {(d.status === "passed" || d.status === "lost") && d.passReason && <Chip tone="outline">{PASS_REASON_LABELS[d.passReason]}</Chip>}
      </div>
    </Link>
  );
}

function Column({ title, count, total, muted, children }: { title: string; count: number; total: number; muted?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex w-[210px] shrink-0 flex-col rounded-[12px] ${muted ? "bg-surface-2/40" : "bg-sidebar"} p-2`}>
      <div className="flex items-baseline justify-between px-1.5 pt-1 pb-2">
        <span className="text-[13px] font-medium">{title} <span className="text-text-3">{count}</span></span>
        <span className="text-[12px] text-text-3 tabular-nums">{fmtUsdM(total, 0)}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
