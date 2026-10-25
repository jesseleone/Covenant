"use client";

// Step 1: every deal tab exists and shows its records plainly. Later steps
// replace these with the full interactive views.

import { useMemo } from "react";
import { WORKSTREAMS, type DB, type Deal } from "@/lib/schema";
import { useDB } from "@/lib/store";
import {
  companyById, currentAffiliation, personById, relationshipStrength, sectionIsStale,
  userById, lastTouchAt,
} from "@/lib/selectors";
import { findPrecedents } from "@/lib/queries";
import { renderMarkdown } from "@/lib/render/tokens";
import { fmtDate, fmtSpread, fmtUsdM, fmtX, titleCase } from "@/lib/format";
import { Avatar, Card, Chip, EmptyState, Label, Section, Table, TD, TH, THead, TR, TextLink } from "@/components/ui/primitives";
import { DecisionChip, SeverityChip, StrengthChip, DealStatusChip } from "@/components/ui/chips";
import { Markdown } from "@/components/common/markdown";
import { AuditList, NoteList } from "@/components/common/timeline";
import { OverviewTab } from "./overview-tab";
import { FinancialsTab } from "./financials-tab";
import { DocumentsTab } from "./documents-tab";
import { SecuritiesTab } from "./securities-tab";

export const DEAL_TABS = [
  { slug: "overview", label: "Overview" },
  { slug: "financials", label: "Financials" },
  { slug: "securities", label: "Securities" },
  { slug: "diligence", label: "Due Diligence" },
  { slug: "memo", label: "IC Memo" },
  { slug: "ic", label: "IC & Approvals" },
  { slug: "stakeholders", label: "Stakeholders" },
  { slug: "documents", label: "Documents" },
  { slug: "notes", label: "Notes" },
  { slug: "history", label: "History" },
];

export function DealTab({ tab, deal }: { tab: string; deal: Deal }) {
  const db = useDB();
  switch (tab) {
    case "overview": return <OverviewTab db={db} deal={deal} />;
    case "financials": return <FinancialsTab db={db} deal={deal} />;
    case "securities": return <SecuritiesTab db={db} deal={deal} />;
    case "diligence": return <Diligence db={db} deal={deal} />;
    case "memo": return <MemoTab db={db} deal={deal} />;
    case "ic": return <IC db={db} deal={deal} />;
    case "stakeholders": return <Stakeholders db={db} deal={deal} />;
    case "documents": return <DocumentsTab db={db} deal={deal} />;
    case "notes": return <NoteList db={db} notes={db.notes.filter((n) => n.subject.type === "deal" && n.subject.id === deal.id)} />;
    case "history": return <History db={db} deal={deal} />;
    default: return <EmptyState title="Unknown tab" />;
  }
}

type P = { db: DB; deal: Deal };

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

function Diligence({ db, deal }: P) {
  const items = db.ddItems.filter((d) => d.dealId === deal.id);
  if (items.length === 0) return <EmptyState title="No diligence items yet" />;
  const groups = WORKSTREAMS.map((w) => [w, items.filter((i) => i.workstream === w)] as const).filter(([, xs]) => xs.length);
  return (
    <Table>
      <THead><tr><TH>Workstream</TH><TH>Item</TH><TH>Kind</TH><TH>Severity</TH><TH>Status</TH><TH>Mitigant</TH><TH>Owner</TH><TH>Due</TH></tr></THead>
      <tbody>
        {groups.flatMap(([w, xs]) => xs.map((d, i) => (
          <TR key={d.id}>
            <TD className="text-text-2">{i === 0 ? (w === "qoe" ? "QoE" : w === "kyc" ? "KYC" : w === "it" ? "IT" : titleCase(w)) : ""}</TD>
            <TD className="max-w-[360px]"><div className="font-medium">{d.title}</div><div className="text-[12px] text-text-3">{d.detail}</div></TD>
            <TD className="text-text-2">{titleCase(d.kind)}</TD>
            <TD><SeverityChip severity={d.severity} /></TD>
            <TD><Chip tone={d.status === "open" ? "warn" : d.status === "closed" ? "success" : "neutral"}>{titleCase(d.status)}</Chip></TD>
            <TD className="max-w-[260px] text-text-2">{d.mitigant ?? "—"}</TD>
            <TD>{d.ownerUserId ? userById(db, d.ownerUserId)?.name : "—"}</TD>
            <TD className="whitespace-nowrap text-text-2">{fmtDate(d.dueDate)}</TD>
          </TR>
        )))}
      </tbody>
    </Table>
  );
}

// ---------------------------------------------------------------------------

function MemoTab({ db, deal }: P) {
  const memos = db.memos.filter((m) => m.dealId === deal.id);
  if (memos.length === 0) return <EmptyState title="No memo yet">Memo generation arrives in a later build step.</EmptyState>;
  return (
    <div className="space-y-6">
      {memos.map((memo) => {
        const sections = db.memoSections.filter((s) => s.memoId === memo.id).sort((a, b) => a.order - b.order);
        return (
          <div key={memo.id} className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-text-2">
              <span className="font-serif text-[18px] text-text">{titleCase(memo.memoType)} memo · v{memo.version}</span>
              <Chip tone={memo.status === "draft" ? "neutral" : "accent"}>{titleCase(memo.status)}</Chip>
              <span className="text-[12px] text-text-3">Based on term set v{db.termSets.find((t) => t.id === memo.termSetId)?.version}</span>
            </div>
            <Card className="mx-auto max-w-[820px] space-y-8 px-8 py-8">
              {sections.map((s) => {
                const stale = sectionIsStale(db, s);
                const reviewer = userById(db, s.reviewedBy);
                return (
                  <section key={s.id}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="font-serif text-[20px] font-medium">{s.title}</h3>
                      <Chip tone="outline">{s.generatedBy === "human" ? "Human" : s.generatedBy === "ai" ? "AI" : "AI (offline)"}</Chip>
                      {stale && <Chip tone="warn">Stale</Chip>}
                      {reviewer ? <Chip tone="success">Reviewed · {reviewer.name}</Chip> : <Chip>Not reviewed</Chip>}
                    </div>
                    <Markdown>{renderMarkdown(db, deal.id, s.content)}</Markdown>
                  </section>
                );
              })}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

function IC({ db, deal }: P) {
  const events = db.icEvents.filter((e) => e.dealId === deal.id).sort((a, b) => b.date.localeCompare(a.date));
  const conditions = db.icConditions.filter((c) => c.dealId === deal.id);
  const da = db.devilsAdvocate.filter((d) => d.dealId === deal.id);
  const precedents = useMemo(() => (deal.status === "active" ? findPrecedents(db, deal.id) : []), [db, deal]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Section title="IC events">
          {events.length === 0 ? <p className="text-text-3">No IC events yet.</p> : events.map((e) => (
            <Card key={e.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{e.stage === "final" ? "Final IC" : "Screening IC"}</span>
                <span className="text-text-3">· {fmtDate(e.date)}</span>
                <DecisionChip decision={e.decision} />
                {e.approvedHold && <span className="text-[12px] text-text-3">Approved hold {fmtUsdM(e.approvedHold)}</span>}
              </div>
              {e.votes.length > 0 && (
                <div className="flex flex-wrap gap-3 text-[13px]">
                  {e.votes.map((v) => <span key={v.userId} className="flex items-center gap-1.5"><Avatar initials={userById(db, v.userId)!.initials} size={20} />{userById(db, v.userId)!.name}: <DecisionChip decision={v.vote} /></span>)}
                </div>
              )}
              {e.qa.length > 0 && (
                <ul className="space-y-2 border-t border-border pt-3">
                  {e.qa.map((q, i) => (
                    <li key={i}>
                      <div><span className="text-text-3">{userById(db, q.askedBy)?.name}:</span> {q.question}</div>
                      {q.answer && <div className="text-text-2">→ {q.answer}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </Section>
        {conditions.length > 0 && (
          <Section title="Conditions">
            <Table>
              <THead><tr><TH>Condition</TH><TH>Type</TH><TH>Owner</TH><TH>Due</TH><TH>Status</TH></tr></THead>
              <tbody>{conditions.map((c) => (
                <TR key={c.id}><TD>{c.description}</TD><TD className="text-text-2">{titleCase(c.type)}</TD><TD>{userById(db, c.ownerUserId)?.name}</TD><TD>{fmtDate(c.dueDate)}</TD><TD><Chip tone={c.status === "satisfied" ? "success" : "warn"}>{titleCase(c.status)}</Chip></TD></TR>
              ))}</tbody>
            </Table>
          </Section>
        )}
      </div>
      <aside className="space-y-6">
        {da.length > 0 && (
          <Section title="Devil's advocate">
            <div className="space-y-3">{da.map((q) => (
              <Card key={q.id} className="p-4">
                <div className="font-medium">{q.question}</div>
                <div className="mt-1 text-[13px] text-text-2">{q.rationale}</div>
              </Card>
            ))}</div>
          </Section>
        )}
        {precedents.length > 0 && (
          <Section title="Precedents">
            <div className="space-y-2">{precedents.map((p) => (
              <Card key={p.deal.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <TextLink href={`/deals/${p.deal.id}/overview`} className="font-medium">{p.deal.name}</TextLink>
                  <DealStatusChip deal={p.deal} />
                </div>
                <div className="mt-1 text-[12px] text-text-3">{fmtX(p.leverage)} · {fmtSpread(p.spreadBps)} · {fmtUsdM(p.deal.requestedSize)} · match {Math.round(p.score * 100)}</div>
              </Card>
            ))}</div>
          </Section>
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Stakeholders({ db, deal }: P) {
  const rows = db.stakeholders.filter((s) => s.dealId === deal.id);
  return (
    <div className="space-y-6">
      <Table>
        <THead><tr><TH>Name</TH><TH>Role</TH><TH>Side</TH><TH>Company</TH><TH>Relationship</TH><TH>Last touch</TH></tr></THead>
        <tbody>
          {rows.map((s) => {
            const person = personById(db, s.personId);
            const company = person ? companyById(db, currentAffiliation(db, person.id)?.companyId) : companyById(db, s.companyId);
            return (
              <TR key={s.id}>
                <TD className="font-medium">
                  {person ? <TextLink href={`/people/${person.id}/overview`}>{person.fullName}</TextLink> : company && <TextLink href={`/companies/${company.id}/overview`}>{company.name}</TextLink>}
                </TD>
                <TD>{s.role}</TD>
                <TD className="text-text-2">{titleCase(s.side)}</TD>
                <TD className="text-text-2">{person && company ? <TextLink href={`/companies/${company.id}/overview`}>{company.name}</TextLink> : "—"}</TD>
                <TD>{person ? <StrengthChip strength={relationshipStrength(db, person.id)} /> : "—"}</TD>
                <TD className="text-text-2">{person ? fmtDate(lastTouchAt(db, person.id)) : "—"}</TD>
              </TR>
            );
          })}
        </tbody>
      </Table>
      <Card className="space-y-2 p-4">
        <Label>Internal deal team</Label>
        <div className="flex flex-wrap gap-4">
          {deal.teamUserIds.map((id) => { const u = userById(db, id)!; return <span key={id} className="flex items-center gap-2"><Avatar initials={u.initials} size={22} />{u.name} <span className="text-text-3">{u.title}</span></span>; })}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

function History({ db, deal }: P) {
  const events = db.auditEvents.filter((e) => e.dealId === deal.id).sort((a, b) => b.at.localeCompare(a.at));
  return <Card className="px-4 py-1"><AuditList db={db} events={events} /></Card>;
}
