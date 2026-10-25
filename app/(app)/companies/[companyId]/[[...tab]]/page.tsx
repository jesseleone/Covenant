"use client";

import { useParams } from "next/navigation";
import { PASS_REASON_LABELS } from "@/lib/schema";
import { useDB } from "@/lib/store";
import {
  approvedTermSet, activeTermSet, companyById, dealsForCompany, fieldValue, leadTranche, notesMentioning, personById, userById,
} from "@/lib/selectors";
import { companyTypeLabel, fmtDate, fmtSpread, fmtUsdM } from "@/lib/format";
import { Card, Chip, EmptyState, KV, PageHeader, Section, TabNav, Table, TD, TH, THead, TR, TextLink } from "@/components/ui/primitives";
import { DealStatusChip } from "@/components/ui/chips";
import { NoteList } from "@/components/common/timeline";

const TABS = [
  { slug: "overview", label: "Overview" },
  { slug: "deals", label: "Related Deals" },
  { slug: "people", label: "People" },
  { slug: "notes", label: "Notes" },
  { slug: "activity", label: "Activity" },
];

export default function CompanyPage() {
  const { companyId, tab: tabParam } = useParams<{ companyId: string; tab?: string[] }>();
  const db = useDB();
  const c = companyById(db, companyId);
  const tab = tabParam?.[0] ?? "overview";
  if (!c) return <div className="p-6"><EmptyState title="Company not found" /></div>;

  const deals = dealsForCompany(db, c.id);
  const affiliations = db.affiliations.filter((a) => a.companyId === c.id);
  const owner = userById(db, c.ownerUserId);
  const isSponsor = c.types.includes("sponsor");
  const isBorrower = c.types.includes("borrower");

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-6 py-6">
      <PageHeader
        breadcrumb={<><TextLink href="/companies" className="text-text-3">Companies</TextLink> / {c.name}</>}
        title={c.name}
        subtitle={<span className="flex flex-wrap items-center gap-2">{c.types.map((t) => <Chip key={t} tone="outline">{companyTypeLabel(t)}</Chip>)}<span>{c.sector}</span>{c.domain && <span className="text-text-3">· {c.domain}</span>}</span>}
      />
      <TabNav tabs={TABS} active={tab} base={`/companies/${c.id}`} />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Section title="About"><p className="prose-serif">{c.description ?? "—"}</p></Section>
            {isSponsor && (
              <Section title="Track record with Fernhill">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Deals shown", deals.length],
                    ["Closed", deals.filter((d) => d.deal.status === "closed").length],
                    ["Active", deals.filter((d) => d.deal.status === "active").length],
                    ["Passed / lost", deals.filter((d) => d.deal.status === "passed" || d.deal.status === "lost").length],
                  ].map(([k, v]) => <Card key={k} className="p-3"><div className="text-[12px] text-text-3">{k}</div><div className="text-[20px] font-medium">{v}</div></Card>)}
                </div>
                <ul className="space-y-1.5">
                  {deals.filter((d) => d.deal.passReason).map(({ deal }) => (
                    <li key={deal.id} className="text-text-2"><TextLink href={`/deals/${deal.id}/overview`}>{deal.name}</TextLink> — {PASS_REASON_LABELS[deal.passReason!]}: {deal.passNote}</li>
                  ))}
                </ul>
              </Section>
            )}
            {isBorrower && deals[0] && (() => {
              const d = deals[0].deal;
              const rev = fieldValue(db, d.id, "revenue_ltm");
              const ebitda = fieldValue(db, d.id, "adj_ebitda_ltm");
              return (
                <Section title="Latest financials">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Card className="p-3"><div className="text-[12px] text-text-3">Revenue ({rev?.field.period})</div><div className="text-[20px] font-medium">{rev ? fmtUsdM(Number(rev.value)) : "—"}</div></Card>
                    <Card className="p-3"><div className="text-[12px] text-text-3">Adj. EBITDA</div><div className="text-[20px] font-medium">{ebitda ? fmtUsdM(Number(ebitda.value)) : "—"}{ebitda?.unconfirmed && <Chip tone="warn" className="ml-2 align-middle">Proposed</Chip>}</div></Card>
                    <Card className="p-3"><div className="text-[12px] text-text-3">Source</div><div className="mt-1"><TextLink href={`/deals/${d.id}/financials`}>{d.name}</TextLink></div></Card>
                  </div>
                </Section>
              );
            })()}
          </div>
          <Card className="grid h-fit grid-cols-2 gap-4 p-4">
            <KV label="Headquarters">{c.hqCity ?? "—"}</KV>
            <KV label="Country">{c.hqCountry ?? "—"}</KV>
            <KV label="Domain">{c.domain ?? "—"}</KV>
            <KV label="Owner">{owner?.name ?? "—"}</KV>
            <div className="col-span-2"><KV label="Aliases">{c.aliases.join(", ") || "—"}</KV></div>
          </Card>
        </div>
      )}

      {tab === "deals" && (
        deals.length === 0 ? <EmptyState title="No related deals" /> : (
          <Table>
            <THead><tr><TH>Deal</TH><TH>Role</TH><TH>Status</TH><TH className="text-right">Size</TH><TH>Spread</TH><TH>Created</TH></tr></THead>
            <tbody>{deals.map(({ deal, role }) => {
              const ts = approvedTermSet(db, deal.id) ?? activeTermSet(db, deal.id);
              return (
                <TR key={deal.id}>
                  <TD className="font-medium"><TextLink href={`/deals/${deal.id}/overview`}>{deal.name}</TextLink></TD>
                  <TD>{role}</TD>
                  <TD><DealStatusChip deal={deal} /></TD>
                  <TD className="text-right tabular-nums">{fmtUsdM(deal.requestedSize)}</TD>
                  <TD>{fmtSpread(leadTranche(db, ts?.id)?.spreadBps)}</TD>
                  <TD className="text-text-2">{fmtDate(deal.createdAt)}</TD>
                </TR>
              );
            })}</tbody>
          </Table>
        )
      )}

      {tab === "people" && (
        affiliations.length === 0 ? <EmptyState title="No people linked" /> : (
          <Table>
            <THead><tr><TH>Name</TH><TH>Title</TH><TH>From</TH><TH>To</TH><TH>Status</TH></tr></THead>
            <tbody>{affiliations.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent)).map((a) => {
              const p = personById(db, a.personId)!;
              return (
                <TR key={a.id}>
                  <TD className="font-medium"><TextLink href={`/people/${p.id}/overview`}>{p.fullName}</TextLink></TD>
                  <TD>{a.title}</TD>
                  <TD className="text-text-2">{fmtDate(a.startDate)}</TD>
                  <TD className="text-text-2">{a.endDate ? fmtDate(a.endDate) : "Present"}</TD>
                  <TD>{a.isCurrent ? <Chip tone="success">Current</Chip> : <Chip>Former</Chip>}</TD>
                </TR>
              );
            })}</tbody>
          </Table>
        )
      )}

      {tab === "notes" && <NoteList db={db} notes={db.notes.filter((n) => n.subject.type === "company" && n.subject.id === c.id)} />}
      {tab === "activity" && <NoteList db={db} notes={notesMentioning(db, "company", c.id)} empty="No activity involving this company yet." />}
    </div>
  );
}
