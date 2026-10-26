"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useDB } from "@/lib/store";
import { pushRecent } from "@/lib/recent";
import {
  companyById, currentAffiliation, dealsForPerson, lastTouchAt, notesMentioning, personById, relationshipStrength, userById,
} from "@/lib/selectors";
import { fmtDate, fmtUsdM, titleCase } from "@/lib/format";
import { Avatar, Card, Chip, EmptyState, KV, Label, PageHeader, Section, TabNav, Table, TD, TH, THead, TR, TextLink } from "@/components/ui/primitives";
import { DealStatusChip, StrengthChip } from "@/components/ui/chips";
import { NotesPanel } from "@/components/common/notes-panel";
import { ActivityFeed, type FeedItem } from "@/components/common/timeline";

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
  useEffect(() => { if (personId) pushRecent({ type: "person", id: personId }); }, [personId]);
  if (!p) return <div className="p-6"><EmptyState title="Person not found" /></div>;

  const aff = currentAffiliation(db, p.id);
  const company = companyById(db, aff?.companyId);
  const deals = dealsForPerson(db, p.id);
  const history = db.affiliations.filter((a) => a.personId === p.id).sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  const owner = userById(db, p.relationshipOwnerId);
  const mentions = notesMentioning(db, "person", p.id);

  // Who at Fernhill knows them best: the relationship owner, then note authors by count.
  const counts = new Map<string, number>();
  for (const n of mentions) counts.set(n.authorId, (counts.get(n.authorId) ?? 0) + 1);
  for (const { deal } of deals) for (const u of deal.teamUserIds) counts.set(u, (counts.get(u) ?? 0) + 0.5);
  const knows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  const feed: FeedItem[] = [
    ...mentions.map((n) => ({ at: n.createdAt, actorId: n.authorId, tag: n.noteType === "meeting" ? "Meeting" : n.noteType === "call" ? "Call" : "Note", title: <span className="font-medium">{n.subject.type === "deal" ? db.deals.find((d) => d.id === n.subject.id)?.name : "Note"}</span>, body: n.body })),
    ...deals.map(({ deal, role }) => ({ at: deal.createdAt, actorId: deal.leadUserId, tag: "Deal role", title: <span>{role} on <span className="font-medium">{deal.name}</span></span>, href: `/deals/${deal.id}/stakeholders` })),
  ];

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
          <div className="space-y-6">
            <Section title="About"><p className="prose-serif">{p.bio ?? `${aff?.title ?? ""}${company ? ` at ${company.name}` : ""}.`}</p></Section>
            {history.length > 1 && (
              <Section title="Career">
                <p className="text-[13px] text-text-2">{history.map((a) => `${a.title}, ${companyById(db, a.companyId)?.name} (${a.startDate?.slice(0, 4) ?? "?"}–${a.endDate?.slice(0, 4) ?? "now"})`).join(" → ")}</p>
              </Section>
            )}
            {deals.length > 0 && (
              <Section title="On deals">
                <ul className="space-y-1.5 text-[13px]">
                  {deals.map(({ deal, role }) => <li key={deal.id + role} className="flex flex-wrap items-center gap-2"><TextLink href={`/deals/${deal.id}/overview`} className="font-medium">{deal.name}</TextLink><span className="text-text-2">{role}</span><DealStatusChip deal={deal} /></li>)}
                </ul>
              </Section>
            )}
          </div>
          <aside className="space-y-4">
            <Card className="grid grid-cols-2 gap-4 p-4">
              <KV label="Email">{p.email ?? "—"}</KV>
              <KV label="Phone">{p.phone ?? "—"}</KV>
              <KV label="Type">{titleCase(p.personType)}</KV>
              <KV label="Last touch">{fmtDate(lastTouchAt(db, p.id))}</KV>
            </Card>
            <Card className="space-y-2.5 p-4">
              <Label>Who at Fernhill knows them best</Label>
              {owner && (
                <div className="flex items-center gap-2.5"><Avatar initials={owner.initials} size={26} /><div className="leading-tight"><div>{owner.name}</div><div className="text-[12px] text-text-3">Relationship owner</div></div></div>
              )}
              {knows.filter(([id]) => id !== owner?.id).slice(0, 3).map(([id, n]) => { const u = userById(db, id)!; return (
                <div key={id} className="flex items-center gap-2.5"><Avatar initials={u.initials} size={26} /><div className="leading-tight"><div>{u.name}</div><div className="text-[12px] text-text-3">{Math.floor(n)} note{Math.floor(n) === 1 ? "" : "s"}{n % 1 ? " · shared deal team" : ""}</div></div></div>
              ); })}
            </Card>
          </aside>
        </div>
      )}

      {tab === "activity" && <ActivityFeed db={db} items={feed} empty="No notes, meetings or deal roles involving this person yet." />}

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
              const dealsThere = db.deals.filter((d) => d.borrowerCompanyId === c.id || d.sponsorCompanyId === c.id);
              return (
                <li key={a.id} className="relative">
                  <span className={`absolute top-1.5 -left-[29px] size-2.5 rounded-full ${a.isCurrent ? "bg-accent" : "bg-border-strong"}`} />
                  <div className="font-medium">{a.title} · <TextLink href={`/companies/${c.id}/overview`}>{c.name}</TextLink></div>
                  <div className="text-[13px] text-text-3">{fmtDate(a.startDate)} – {a.endDate ? fmtDate(a.endDate) : "Present"} {a.isCurrent && <Chip tone="success" className="ml-1">Current</Chip>}</div>
                  {dealsThere.length > 0 && <div className="mt-1 flex flex-wrap gap-1.5">{dealsThere.map((d) => <TextLink key={d.id} href={`/deals/${d.id}/overview`}><DealStatusChip deal={d} /> <span className="text-[12px]">{d.name}</span></TextLink>)}</div>}
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {tab === "notes" && <NotesPanel db={db} subject={{ type: "person", id: p.id }} notes={db.notes.filter((n) => n.subject.type === "person" && n.subject.id === p.id)} />}
    </div>
  );
}
