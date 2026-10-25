"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { STAGES } from "@/lib/schema";
import { useDB } from "@/lib/store";
import { companyById, daysInStage, dealMetrics, userById } from "@/lib/selectors";
import { fmtDateShort, fmtPct, fmtSpread, fmtUsdM, fmtX } from "@/lib/format";
import { Avatar, Chip, Table, TD, TH, THead, TR, TextLink, cn } from "@/components/ui/primitives";
import { DealStatusChip, StrategyChip } from "@/components/ui/chips";

export function DealsTable() {
  const db = useDB();
  const router = useRouter();

  const rows = useMemo(() => {
    const order = (s: string) => STAGES.indexOf(s as (typeof STAGES)[number]);
    return [...db.deals]
      .map((d) => ({ d, m: dealMetrics(db, d.id) }))
      .sort((a, b) => {
        // Active deals first, by stage (latest first); then closed; then passed/lost.
        const rank = (x: typeof a) => (x.d.status === "active" ? 0 : x.d.status === "closed" ? 1 : 2);
        return rank(a) - rank(b) || order(b.d.stage) - order(a.d.stage) || a.d.name.localeCompare(b.d.name);
      });
  }, [db]);

  return (
    <Table>
      <THead>
        <tr>
          <TH>Deal</TH><TH>Borrower</TH><TH>Sponsor</TH><TH>Stage</TH><TH className="text-right">Days</TH><TH>Strategy</TH>
          <TH className="text-right">Size</TH><TH className="text-right">Hold</TH><TH className="text-right">Leverage</TH><TH>Spread</TH>
          <TH className="text-right">Cushion</TH><TH>Risk</TH><TH>Lead</TH><TH>Next IC</TH>
        </tr>
      </THead>
      <tbody>
        {rows.map(({ d, m }) => {
          const lead = userById(db, d.leadUserId);
          const days = daysInStage(db, d);
          return (
            <TR key={d.id} onClick={() => router.push(`/deals/${d.id}/overview`)}>
              <TD className="font-medium whitespace-nowrap"><TextLink href={`/deals/${d.id}/overview`}>{d.name}</TextLink></TD>
              <TD className="max-w-[200px] truncate text-text-2">{companyById(db, d.borrowerCompanyId)?.name}</TD>
              <TD className="whitespace-nowrap text-text-2">{companyById(db, d.sponsorCompanyId)?.name ?? "—"}</TD>
              <TD><DealStatusChip deal={d} /></TD>
              <TD className={cn("text-right tabular-nums", d.status === "active" && days > 30 ? "text-warn" : "text-text-2")}>{d.status === "active" ? days : "—"}</TD>
              <TD><StrategyChip strategy={d.strategy} /></TD>
              <TD className="text-right tabular-nums">{fmtUsdM(m.facilitySize)}</TD>
              <TD className="text-right tabular-nums text-text-2">{fmtUsdM(m.fundHold)}</TD>
              <TD className="text-right tabular-nums">
                {fmtX(m.leverage)}
                {m.unconfirmed && <span title="Relies on an unconfirmed value" className="ml-1 inline-block size-1.5 rounded-full bg-warn align-middle" />}
              </TD>
              <TD className="tabular-nums">{fmtSpread(m.spreadBps)}</TD>
              <TD className={cn("text-right tabular-nums", m.cushionWarn ? "text-warn" : "text-text-2")}>{fmtPct(m.cushion)}</TD>
              <TD>{d.riskRating ? <Chip tone="outline">{d.riskRating.value} / 5</Chip> : <span className="text-text-3">—</span>}</TD>
              <TD>{lead && <Avatar initials={lead.initials} title={lead.name} />}</TD>
              <TD className="whitespace-nowrap text-text-2">{fmtDateShort(m.nextIcDate)}</TD>
            </TR>
          );
        })}
      </tbody>
    </Table>
  );
}
