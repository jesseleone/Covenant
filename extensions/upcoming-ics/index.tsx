import { EmptyState, StageChip, Table, TD, TH, THead, TR, TextLink, formatDate, formatMoney, useCovenant } from "@/lib/sdk";

export default function UpcomingICs() {
  const data = useCovenant();

  // One row per active deal, using its soonest meeting that is today or later and not yet decided.
  const rows = data.deals
    .filter((d) => d.status === "active")
    .flatMap((deal) => {
      const dates = data.icEvents
        .filter((e) => e.dealId === deal.id && e.status === "pending" && e.date.slice(0, 10) >= data.today)
        .map((e) => e.date.slice(0, 10))
        .sort();
      return dates.length ? [{ deal, date: dates[0] }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.deal.name.localeCompare(b.deal.name));

  if (rows.length === 0) return <EmptyState title="No upcoming IC meetings">No active deal has an IC meeting coming up.</EmptyState>;

  return (
    <Table>
      <THead>
        <tr><TH>IC date</TH><TH>Deal</TH><TH>Stage</TH><TH>Deal lead</TH><TH className="text-right">Facility size</TH></tr>
      </THead>
      <tbody>
        {rows.map(({ deal, date }) => (
          <TR key={deal.id}>
            <TD>{formatDate(date)}</TD>
            <TD><TextLink href={`/deals/${deal.id}/overview`}>{deal.name}</TextLink></TD>
            <TD><StageChip stage={deal.stage} /></TD>
            <TD>{data.userName(deal.leadUserId)}</TD>
            <TD className="text-right font-mono tabular-nums">{formatMoney(data.metrics(deal.id).facilitySize)}</TD>
          </TR>
        ))}
      </tbody>
    </Table>
  );
}
