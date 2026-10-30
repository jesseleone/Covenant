import { useState } from "react";
import {
  BarChart, Button, Card, Chip, EmptyState, Section, Table, TD, TH, THead, TR, TextLink, formatMoney, formatMultiple, formatPercent, titleCase,
  useCovenant, type Deal,
} from "@/lib/sdk";

type Show = "closed" | "active" | "both";

const SHOW_LABELS: Record<Show, string> = { both: "Both", closed: "Closed book", active: "Active pipeline" };

/** Names for sector tags that don't read well title-cased; others are title-cased. */
const NAMES: Record<string, string> = {
  healthcare_it: "Healthcare IT", testing_inspection: "Testing & inspection", supply_chain: "Supply chain",
  business_services: "Business services", facility_services: "Facility services", fleet_services: "Fleet services",
  industrial_services: "Industrial services", physician_services: "Physician services",
};
const sectorName = (tag: string) => NAMES[tag] ?? titleCase(tag);

/** More than this share of the total in one sector is flagged. */
const CONCENTRATION = 0.5;

export default function SectorExposure() {
  const data = useCovenant();
  const [show, setShow] = useState<Show>("both");

  const deals = data.deals.filter((d) => (show === "both" ? d.status === "active" || d.status === "closed" : d.status === show));
  const hold = (d: Deal) => data.metrics(d.id).fundHold;
  const total = deals.reduce((s, d) => s + hold(d), 0);

  // Broad sector = the deal's first sector tag; sub-sector = its second.
  const sectors = groupBy(deals, (d) => d.sectorTags[0] ?? "other")
    .map(([sector, list]) => ({
      sector,
      hold: list.reduce((s, d) => s + hold(d), 0),
      subSectors: groupBy(list, (d) => d.sectorTags[1] ?? "other").map(([sub, subDeals]) => ({ sub, deals: subDeals })),
    }))
    .sort((a, b) => b.hold - a.hold);

  const avgLeverage = (list: Deal[]) => {
    const values = list.map((d) => data.metrics(d.id).leverage).filter((v): v is number => v !== null);
    return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Which deals to include">
        {(Object.keys(SHOW_LABELS) as Show[]).map((k) => (
          <Button key={k} size="sm" variant={show === k ? "primary" : "secondary"} aria-pressed={show === k} onClick={() => setShow(k)}>
            {SHOW_LABELS[k]}
          </Button>
        ))}
        <span className="ml-auto text-[13px] text-text-3">
          {deals.length} deal{deals.length === 1 ? "" : "s"} · fund hold {formatMoney(total)}
        </span>
      </div>

      {deals.length === 0 ? (
        <EmptyState title="No deals to show">Try another filter.</EmptyState>
      ) : (
        <>
          <Card className="p-4">
            <div className="mb-2 text-[13px] font-medium">Fund hold by sector ($M)</div>
            <BarChart
              labelHeading="Sector"
              valueLabel="Fund hold"
              format={(v) => formatMoney(v)}
              bars={sectors.map((s) => ({
                label: sectorName(s.sector),
                value: s.hold,
                detail: `${formatPercent(total ? s.hold / total : 0, 0)} of total, ${s.subSectors.reduce((n, x) => n + x.deals.length, 0)} deals`,
              }))}
            />
          </Card>

          {sectors.map((s) => {
            const share = total ? s.hold / total : 0;
            return (
              <Section
                key={s.sector}
                title={sectorName(s.sector)}
                actions={
                  <div className="flex items-center gap-2 text-[13px] text-text-2">
                    {formatMoney(s.hold)} · {formatPercent(share, 0)}
                    {share > CONCENTRATION && <Chip tone="warn">Concentration: over {formatPercent(CONCENTRATION, 0)}</Chip>}
                  </div>
                }
              >
                <Table>
                  <THead>
                    <tr><TH>Sub-sector</TH><TH>Deals</TH><TH className="text-right">Fund hold</TH><TH className="text-right">Avg leverage</TH></tr>
                  </THead>
                  <tbody>
                    {s.subSectors.map(({ sub, deals: list }) => (
                      <TR key={sub}>
                        <TD>{sectorName(sub)}</TD>
                        <TD>
                          {list.map((d, i) => (
                            <span key={d.id}>
                              {i > 0 && ", "}
                              <TextLink href={`/deals/${d.id}/overview`}>{d.name}</TextLink>
                              <span className="text-text-3"> ({data.statusLabel(d).toLowerCase()})</span>
                            </span>
                          ))}
                        </TD>
                        <TD className="text-right font-mono tabular-nums">{formatMoney(list.reduce((n, d) => n + hold(d), 0))}</TD>
                        <TD className="text-right font-mono tabular-nums">{formatMultiple(avgLeverage(list))}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </Section>
            );
          })}
        </>
      )}
    </div>
  );
}

function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return [...map.entries()];
}
