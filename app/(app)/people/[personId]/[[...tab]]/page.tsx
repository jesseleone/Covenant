"use client";

import { useParams } from "next/navigation";
import { useDB } from "@/lib/store";
import {
  companyById, currentAffiliation, dealsForPerson, lastTouchAt, notesMentioning, personById, relationshipStrength, userById,
} from "@/lib/selectors";
import { fmtDate, fmtUsdM, titleCase } from "@/lib/format";
import { Card, Chip, EmptyState, KV, PageHeader, Section, TabNav, Table, TD, TH, THead, TR, TextLink } from "@/components/ui/primitives";
import { DealStatusChip, StrengthChip } from "@/components/ui/chips";
import { NoteList } from "@/components/common/timeline";

const TABS = [
  { slug: "overview", label: "Overview" },
  { slug: "activity", label: "Activity" },
  { slug: "related-deals", label: "Related Deals" },
  { slug: "related-companies", label: "Related Companies" },
  { slug: "notes", label: "Notes" },
];

export default function PersonPage() {
  const { personId, tab: tabParam } = useParams<{ personId: string; tab?: string[] }>();
  const db = useDB();
  const p = personById(db, personId);
  const tab = tabParam?.[0] ?? "overview";
  if (!p) return <div className="p-6"><EmptyState title="Person not found" /></div>;

  const aff = currentAffiliation(db, p.id);
  const company = companyById(db, aff?.companyId);
  const deals = dealsForPerson(db, p.id);
  const history = db.affiliations.filter((a) => a.personId === p.id).sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  const owner = userById(db, p.relationshipOwnerId);

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-6 py-6">
      <PageHeader
        breadcrumb={<><TextLink href="/people" className="text-text-3">People</TextLink> / {p.fullName}</>}
        title={p.fullName}
        subtitle={<span className="flex flex-wrap items-center gap-2">{aff?.title}{company && <> @ <TextLink href={`/companies/${company.id}/overview`}>{company.name}</TextLink></>}<StrengthChip strength={relationshipStrength(db, p.id)} /></span>}
      />
      <TabNav tabs={TABS} active={tab} base={`/people/${p.id}`} />

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Section title="About"><p className="prose-serif">{p.bio ?? `${aff?.title ?? ""}${company ? ` at ${company.name}` : ""}.`}</p></Section>
          <Card className="grid h-fit grid-cols-2 gap-4 p-4">
            <KV label="Email">{p.email ?? "—"}</KV>
            <KV label="Phone">{p.phone ?? "—"}</KV>
            <KV label="Type">{titleCase(p.personType)}</KV>
            <KV label="Relationship owner">{owner?.name ?? "—"}</KV>
            <KV label="Last touch">{fmtDate(lastTouchAt(db, p.id))}</KV>
            <KV label="Related deals">{deals.length}</KV>
          </Card>
        </div>
      )}

      {tab === "activity" && <NoteList db={db} notes={notesMentioning(db, "person", p.id)} empty="No notes or meetings involving this person yet." />}

      {tab === "related-deals" && (
        deals.length === 0 ? <EmptyState title="No related deals" /> : (
          <Table>
            <THead><tr><TH>Deal</TH><TH>Role</TH><TH>Outcome</TH><TH className="text-right">Size</TH><TH>Created</TH></tr></THead>
            <tbody>{deals.map(({ deal, role }) => (
              <TR key={deal.id + role}>
                <TD className="font-medium"><TextLink href={`/deals/${deal.id}/overview`}>{deal.name}</TextLink></TD>
                <TD>{role}</TD>
                <TD><DealStatusChip deal={deal} /></TD>
                <TD className="text-right tabular-nums">{fmtUsdM(deal.requestedSize)}</TD>
                <TD className="text-text-2">{fmtDate(deal.createdAt)}</TD>
              </TR>
            ))}</tbody>
          </Table>
        )
      )}

      {tab === "related-companies" && (
        <Section title="Role history">
          <ol className="relative ml-2 space-y-5 border-l border-border pl-6">
            {history.map((a) => {
              const c = companyById(db, a.companyId)!;
              return (
                <li key={a.id} className="relative">
                  <span className={`absolute top-1.5 -left-[29px] size-2.5 rounded-full ${a.isCurrent ? "bg-accent" : "bg-border-strong"}`} />
                  <div className="font-medium">{a.title} · <TextLink href={`/companies/${c.id}/overview`}>{c.name}</TextLink></div>
                  <div className="text-[13px] text-text-3">{fmtDate(a.startDate)} – {a.endDate ? fmtDate(a.endDate) : "Present"} {a.isCurrent && <Chip tone="success" className="ml-1">Current</Chip>}</div>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {tab === "notes" && <NoteList db={db} notes={db.notes.filter((n) => n.subject.type === "person" && n.subject.id === p.id)} />}
    </div>
  );
}
