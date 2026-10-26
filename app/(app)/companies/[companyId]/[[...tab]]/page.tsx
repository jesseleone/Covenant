"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { PASS_REASON_LABELS } from "@/lib/schema";
import { useDB } from "@/lib/store";
import { pushRecent } from "@/lib/recent";
import {
  activeTermSet, approvedTermSet, companyById, dealsForCompany, fieldValue, leadTranche, notesMentioning, personById, relationshipStrength, userById,
} from "@/lib/selectors";
import { companyTypeLabel, fmtDate, fmtSpread, fmtUsdM } from "@/lib/format";
import { Card, Chip, EmptyState, KV, Label, PageHeader, Section, TabNav, Table, TD, TH, THead, TR, TextLink } from "@/components/ui/primitives";
import { DealStatusChip, StrengthChip } from "@/components/ui/chips";
import { NotesPanel } from "@/components/common/notes-panel";
import { ActivityFeed, type FeedItem } from "@/components/common/timeline";

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
  useEffect(() => { if (companyId) pushRecent({ type: "company", id: companyId }); }, [companyId]);
  if (!c) return <div className="p-6"><EmptyState title="Company not found" /></div>;

  const deals = dealsForCompany(db, c.id);
  const affiliations = db.affiliations.filter((a) => a.companyId === c.id);
  const current = affiliations.filter((a) => a.isCurrent);
  const owner = userById(db, c.ownerUserId);
  const isSponsor = c.types.includes("sponsor");
  const isBorrower = c.types.includes("borrower");
  const pricing = (dealId: string) => leadTranche(db, (approvedTermSet(db, dealId) ?? activeTermSet(db, dealId))?.id)?.spreadBps ?? null;

  // Exposure: approved holds on deals that are closed or approved and in documentation.
  const exposure = db.icEvents
    .filter((e) => e.status === "decided" && e.approvedHold && (e.decision === "approve" || e.decision === "approve_with_conditions"))
    .filter((e) => deals.some(({ deal, role }) => deal.id === e.dealId && role === "Borrower"))
    .reduce((s, e) => s + (e.approvedHold ?? 0), 0);

  const closed = deals.filter((d) => d.deal.status === "closed");
  const avgSpread = closed.length ? Math.round(closed.reduce((s, d) => s + (pricing(d.deal.id) ?? 0), 0) / closed.length) : null;

  const feed: FeedItem[] = [
    ...notesMentioning(db, "company", c.id).map((n) => ({ at: n.createdAt, actorId: n.authorId, tag: "Note", title: <span className="font-medium">{n.noteType === "meeting" ? "Meeting" : n.noteType === "call" ? "Call" : "Note"}</span>, body: n.body })),
    ...affiliations.flatMap((a) => notesMentioning(db, "person", a.personId).filter((n) => !n.mentions.some((m) => m.id === c.id) && n.subject.id !== c.id).map((n) => ({
      at: n.createdAt, actorId: n.authorId, tag: "Note", title: <span>Note mentioning <span className="font-medium">{personById(db, a.personId)?.fullName}</span></span>, body: n.body,
    }))),
    ...db.auditEvents.filter((e) => deals.some((d) => d.deal.id === e.dealId) && /^(stage\.|ic\.decide|deal\.)/.test(e.action)).map((e) => ({
      at: e.at, actorId: e.actorId, tag: "Deal", title: <span><span className="font-medium">{db.deals.find((d) => d.id === e.dealId)?.name}</span>: {e.summary}</span>, href: `/deals/${e.dealId}/history`,
    })),
  ];

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
            <Section title="About"><p className="prose-serif">{c.description ?? "No description yet."}</p></Section>
            {isSponsor && (
              <Section title="Track record with Fernhill">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {([
                    ["Deals shown", deals.length],
                    ["Closed", closed.length],
                    ["Active", deals.filter((d) => d.deal.status === "active").length],
                    ["Passed / lost", deals.filter((d) => d.deal.status === "passed" || d.deal.status === "lost").length],
                    ["Avg spread (closed)", avgSpread ? fmtSpread(avgSpread) : "—"],
                  ] as const).map(([k, v]) => <Card key={k} className="p-3"><Label>{k}</Label><div className="text-[20px] font-medium tabular-nums">{v}</div></Card>)}
                </div>
                <ul className="space-y-1.5 text-[13px]">
                  {deals.map(({ deal }) => (
                    <li key={deal.id} className="flex flex-wrap items-center gap-2">
                      <TextLink href={`/deals/${deal.id}/overview`} className="font-medium">{deal.name}</TextLink><DealStatusChip deal={deal} />
                      {deal.passReason && <span className="text-text-2">{PASS_REASON_LABELS[deal.passReason]}: {deal.passNote}</span>}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {isBorrower && deals[0] && (() => {
              const d = deals.find((x) => x.role === "Borrower")?.deal ?? deals[0].deal;
              const rev = fieldValue(db, d.id, "revenue_ltm");
              const ebitda = fieldValue(db, d.id, "adj_ebitda_ltm");
              return (
                <Section title="Latest financials and exposure">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Card className="p-3"><Label>Revenue ({rev?.field.period ?? "LTM"})</Label><div className="text-[20px] font-medium">{rev ? fmtUsdM(Number(rev.value)) : "—"}</div></Card>
                    <Card className="p-3"><Label>Adj. EBITDA</Label><div className="text-[20px] font-medium">{ebitda ? fmtUsdM(Number(ebitda.value)) : "—"}</div>{ebitda && <div className="text-[12px] text-text-3">{ebitda.field.status === "corrected" ? "Corrected (QoE)" : ebitda.unconfirmed ? "Proposed, unreviewed" : "Confirmed"}</div>}</Card>
                    <Card className="p-3"><Label>Fernhill exposure</Label><div className="text-[20px] font-medium">{exposure ? fmtUsdM(exposure) : "—"}</div><div className="text-[12px] text-text-3">{exposure ? "IC-approved hold" : "No approved facility"}</div></Card>
                    <Card className="p-3"><Label>Source</Label><div className="mt-1"><TextLink href={`/deals/${d.id}/financials`}>{d.name}</TextLink></div></Card>
                  </div>
                </Section>
              );
            })()}
          </div>
          <aside className="space-y-4">
            <Card className="grid grid-cols-2 gap-4 p-4">
              <KV label="Headquarters">{c.hqCity ?? "—"}</KV>
              <KV label="Country">{c.hqCountry ?? "—"}</KV>
              <KV label="Domain">{c.domain ?? "—"}</KV>
              <KV label="Owner">{owner?.name ?? "—"}</KV>
              <div className="col-span-2"><KV label="Also known as">{c.aliases.join(", ") || "—"}</KV></div>
            </Card>
            {current.length > 0 && (
              <Card className="space-y-2.5 p-4">
                <Label>People</Label>
                {current.map((a) => { const p = personById(db, a.personId)!; return (
                  <div key={a.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 leading-tight"><TextLink href={`/people/${p.id}/overview`} className="font-medium">{p.fullName}</TextLink><div className="truncate text-[12px] text-text-3">{a.title}</div></div>
                    <StrengthChip strength={relationshipStrength(db, p.id)} />
                  </div>
                ); })}
              </Card>
            )}
          </aside>
        </div>
      )}

      {tab === "deals" && (
        deals.length === 0 ? <EmptyState title="No related deals" /> : (
          <Table>
            <THead><tr><TH>Deal</TH><TH>Role</TH><TH>Status</TH><TH className="text-right">Size</TH><TH>Spread</TH><TH>Created</TH></tr></THead>
            <tbody>{deals.map(({ deal, role }) => (
              <TR key={deal.id}>
                <TD className="font-medium"><TextLink href={`/deals/${deal.id}/overview`}>{deal.name}</TextLink></TD>
                <TD>{role}</TD>
                <TD><DealStatusChip deal={deal} /></TD>
                <TD className="text-right tabular-nums">{fmtUsdM(deal.requestedSize)}</TD>
                <TD>{fmtSpread(pricing(deal.id))}</TD>
                <TD className="text-text-2">{fmtDate(deal.createdAt)}</TD>
              </TR>
            ))}</tbody>
          </Table>
        )
      )}

      {tab === "people" && (
        affiliations.length === 0 ? <EmptyState title="No people linked" /> : (
          <Table>
            <THead><tr><TH>Name</TH><TH>Title</TH><TH>From</TH><TH>To</TH><TH>Status</TH><TH>Relationship</TH></tr></THead>
            <tbody>{[...affiliations].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent)).map((a) => {
              const p = personById(db, a.personId)!;
              return (
                <TR key={a.id}>
                  <TD className="font-medium"><TextLink href={`/people/${p.id}/overview`}>{p.fullName}</TextLink></TD>
                  <TD>{a.title}</TD>
                  <TD className="text-text-2">{fmtDate(a.startDate)}</TD>
                  <TD className="text-text-2">{a.endDate ? fmtDate(a.endDate) : "Present"}</TD>
                  <TD>{a.isCurrent ? <Chip tone="success">Current</Chip> : <Chip>Former</Chip>}</TD>
                  <TD><StrengthChip strength={relationshipStrength(db, p.id)} /></TD>
                </TR>
              );
            })}</tbody>
          </Table>
        )
      )}

      {tab === "notes" && <NotesPanel db={db} subject={{ type: "company", id: c.id }} notes={db.notes.filter((n) => n.subject.type === "company" && n.subject.id === c.id)} />}
      {tab === "activity" && <ActivityFeed db={db} items={feed} empty="No activity involving this company yet." />}
    </div>
  );
}
