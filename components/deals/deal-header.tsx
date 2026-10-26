"use client";

import Link from "next/link";
import { ArrowRight, Check, MoreHorizontal } from "lucide-react";
import { STAGES, STAGE_LABELS, PASS_REASON_LABELS, type Deal } from "@/lib/schema";
import { nextStage } from "@/lib/gates";
import { useCurrentUser, useDB } from "@/lib/store";
import { canMoveStage } from "@/lib/permissions";
import { companyById, dealMetrics } from "@/lib/selectors";
import { fmtBps, fmtDate, fmtPct, fmtSpread, fmtUsdM, fmtX } from "@/lib/format";
import { Button, Chip, TextLink, cn } from "@/components/ui/primitives";
import { DealStatusChip, StrategyChip } from "@/components/ui/chips";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useStageMover } from "./stage-move";

export function DealHeader({ deal }: { deal: Deal }) {
  const db = useDB();
  const mover = useStageMover();
  const user = useCurrentUser();
  const m = dealMetrics(db, deal.id);
  const borrower = companyById(db, deal.borrowerCompanyId);
  const sponsor = companyById(db, deal.sponsorCompanyId);
  const stageIdx = STAGES.indexOf(deal.stage);
  const active = deal.status === "active";
  const out = deal.status === "passed" || deal.status === "lost" || deal.status === "on_hold";
  const next = nextStage(deal.stage);

  return (
    <header className="space-y-4">
      <div className="text-[13px] text-text-3">
        <Link href="/deals" className="hover:text-text">Deals</Link> <span className="mx-1">/</span> {deal.name}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <h1 className="font-serif text-[30px] leading-tight font-medium">{deal.name}</h1>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-text-2">
            {borrower && <TextLink href={`/companies/${borrower.id}/overview`}>{borrower.name}</TextLink>}
            {sponsor && <><span className="text-text-3">·</span><span className="text-text-3">Sponsor</span><TextLink href={`/companies/${sponsor.id}/overview`}>{sponsor.name}</TextLink></>}
            <span className="text-text-3">·</span>
            <StrategyChip strategy={deal.strategy} />
            <DealStatusChip deal={deal} />
            {deal.passReason && <Chip tone="outline">{PASS_REASON_LABELS[deal.passReason]}</Chip>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {active && next && user && canMoveStage(user.role, next) && (
            <Button variant="primary" onClick={() => mover.request(deal, next)}>
              {next === "ic" ? "Submit to IC" : `Advance to ${STAGE_LABELS[next]}`}<ArrowRight size={15} />
            </Button>
          )}
          {out && <Button variant="primary" onClick={() => mover.reopen(deal)}>Reopen deal</Button>}
          <Menu>
            <MenuTrigger asChild>
              <button className="flex size-9 items-center justify-center rounded-[8px] border border-border bg-surface text-text-2 hover:bg-surface-2 hover:text-text" aria-label="More actions">
                <MoreHorizontal size={17} />
              </button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem disabled={!active} onSelect={() => mover.requestOutcome(deal, "passed")}>Pass on deal…</MenuItem>
              <MenuItem disabled={!active} onSelect={() => mover.requestOutcome(deal, "lost")}>Mark lost…</MenuItem>
              <MenuItem disabled={!active} onSelect={() => mover.requestOutcome(deal, "on_hold")}>Put on hold…</MenuItem>
              {out && <><MenuSeparator /><MenuItem onSelect={() => mover.reopen(deal)}>Reopen</MenuItem></>}
            </MenuContent>
          </Menu>
        </div>
      </div>

      {out && deal.passNote && (
        <div className="rounded-[12px] border border-danger/25 bg-danger-soft/50 px-4 py-2.5 text-[13px]">
          <span className="font-medium">{deal.status === "on_hold" ? "On hold" : deal.status === "lost" ? "Lost" : "Passed"} at {STAGE_LABELS[deal.stage]}:</span> {deal.passNote}
        </div>
      )}

      {/* Stage stepper: click a stage to move there (same gates as the pipeline) */}
      <ol className="flex overflow-x-auto rounded-[12px] border border-border bg-surface p-1" aria-label="Stage">
        {STAGES.map((s, i) => {
          const done = i < stageIdx || deal.status === "closed";
          const current = i === stageIdx && deal.status !== "closed";
          const clickable = (active || out) && !current;
          return (
            <li key={s} className="flex flex-1">
              <button
                disabled={!clickable}
                onClick={() => mover.request(deal, s)}
                aria-current={current ? "step" : undefined}
                title={clickable ? `Move to ${STAGE_LABELS[s]}` : undefined}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[12px] whitespace-nowrap transition-colors",
                  current ? (out ? "bg-surface-2 font-medium text-text-2" : "bg-accent-soft font-medium text-accent") : done ? "text-text-2" : "text-text-3",
                  clickable && "hover:bg-surface-2 hover:text-text",
                )}
              >
                {done ? <Check size={12} className="text-text-3" /> : <span className={cn("size-1.5 rounded-full", current ? "bg-accent" : "bg-border-strong")} />}
                {STAGE_LABELS[s]}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Facility" value={fmtUsdM(m.facilitySize)} note={`Fernhill hold ${fmtUsdM(m.fundHold)}`} />
        <Metric label="Total leverage at close" value={fmtX(m.leverage)} warn={m.unconfirmed} note={m.unconfirmed ? "EBITDA not yet confirmed" : `Funded debt ${fmtUsdM(m.fundedDebt)}`} />
        <Metric label="Spread / floor" value={`${fmtSpread(m.spreadBps)} / ${fmtBps(m.floorBps)}`} />
        <Metric label="Covenant cushion" value={fmtPct(m.cushion)} warn={m.cushionWarn || m.unconfirmed} note={m.cushionWarn ? `Below ${db.settings.coverageCushionGuidelinePct}% guideline` : m.unconfirmed ? "EBITDA not yet confirmed" : m.covenantLevel ? `vs ${fmtX(m.covenantLevel)} covenant` : undefined} />
        <Metric label="Risk rating" value={deal.riskRating ? `${deal.riskRating.value} of 5` : "—"} note={deal.riskRating ? "1 = best" : undefined} />
        <Metric label="Next IC" value={m.nextIcDate ? fmtDate(m.nextIcDate) : "—"} />
      </div>
      {mover.ui}
    </header>
  );
}

function Metric({ label, value, warn, note }: { label: string; value: string; warn?: boolean; note?: string }) {
  return (
    <div className="rounded-[12px] border border-border bg-surface px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[12px] text-text-3">
        {label}
        {warn && <span className="size-1.5 rounded-full bg-warn" aria-label="Needs attention" />}
      </div>
      <div className={cn("mt-0.5 text-[18px] font-medium tabular-nums", warn && "text-warn")}>{value}</div>
      {note && <div className="truncate text-[12px] text-text-3">{note}</div>}
    </div>
  );
}
