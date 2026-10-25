"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDB } from "@/lib/store";
import { approvedTermSet, dealsForCompany, facilitySize, userById } from "@/lib/selectors";
import { companyTypeLabel, fmtUsdM } from "@/lib/format";
import type { Company } from "@/lib/schema";
import { Avatar, Chip, PageHeader, Table, TD, TH, THead, TR, TextLink, cn } from "@/components/ui/primitives";

const FILTERS: { key: string; label: string; match: (c: Company) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "borrower", label: "Borrowers", match: (c) => c.types.includes("borrower") },
  { key: "sponsor", label: "Sponsors", match: (c) => c.types.includes("sponsor") },
  { key: "advisor", label: "Advisors", match: (c) => c.types.some((t) => ["advisor", "law_firm", "qoe_provider", "agent"].includes(t)) },
  { key: "lender", label: "Lenders", match: (c) => c.types.includes("lender") },
];

export default function CompaniesPage() {
  const db = useDB();
  const router = useRouter();
  const [filter, setFilter] = useState("all");

  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    return db.companies.filter(f.match).map((c) => {
      const deals = dealsForCompany(db, c.id).map((x) => x.deal);
      const committed = deals.filter((d) => d.status === "closed").reduce((s, d) => s + facilitySize(db, approvedTermSet(db, d.id)?.id), 0);
      const last = db.auditEvents.filter((e) => deals.some((d) => d.id === e.dealId)).map((e) => e.at).sort().at(-1);
      return {
        c, committed, last,
        active: deals.filter((d) => d.status === "active").length,
        closed: deals.filter((d) => d.status === "closed").length,
        passed: deals.filter((d) => d.status === "passed" || d.status === "lost").length,
      };
    }).sort((a, b) => a.c.name.localeCompare(b.c.name));
  }, [db, filter]);

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-6 py-6">
      <PageHeader title="Companies" subtitle="Borrowers, sponsors, lenders and advisors." />
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn("h-8 rounded-full border px-3 text-[13px]", filter === f.key ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:text-text")}>
            {f.label}
          </button>
        ))}
      </div>
      <Table>
        <THead><tr><TH>Name</TH><TH>Type</TH><TH>Sector</TH><TH>HQ</TH><TH className="text-right">Active</TH><TH className="text-right">Closed</TH><TH className="text-right">Passed</TH><TH className="text-right">Committed</TH><TH>Owner</TH></tr></THead>
        <tbody>
          {rows.map(({ c, active, closed, passed, committed }) => {
            const owner = userById(db, c.ownerUserId);
            return (
              <TR key={c.id} onClick={() => router.push(`/companies/${c.id}/overview`)}>
                <TD className="font-medium"><TextLink href={`/companies/${c.id}/overview`}>{c.name}</TextLink></TD>
                <TD><div className="flex flex-wrap gap-1">{c.types.map((t) => <Chip key={t} tone="outline">{companyTypeLabel(t)}</Chip>)}</div></TD>
                <TD className="max-w-[220px] truncate text-text-2">{c.sector}</TD>
                <TD className="whitespace-nowrap text-text-2">{c.hqCity}</TD>
                <TD className="text-right tabular-nums">{active || "—"}</TD>
                <TD className="text-right tabular-nums">{closed || "—"}</TD>
                <TD className="text-right tabular-nums">{passed || "—"}</TD>
                <TD className="text-right tabular-nums">{committed ? fmtUsdM(committed) : "—"}</TD>
                <TD>{owner && <Avatar initials={owner.initials} title={owner.name} />}</TD>
              </TR>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
