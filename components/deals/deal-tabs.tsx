"use client";

// Deal tab router. Stakeholders and Notes are still the plain step-1 views;
// every other tab lives in its own file.

import type { DB, Deal } from "@/lib/schema";
import { useDB } from "@/lib/store";
import { companyById, currentAffiliation, lastTouchAt, personById, relationshipStrength, userById } from "@/lib/selectors";
import { fmtDate, titleCase } from "@/lib/format";
import { Avatar, Card, EmptyState, Label, Table, TD, TH, THead, TR, TextLink } from "@/components/ui/primitives";
import { StrengthChip } from "@/components/ui/chips";
import { NoteList } from "@/components/common/timeline";
import { OverviewTab } from "./overview-tab";
import { FinancialsTab } from "./financials-tab";
import { DocumentsTab } from "./documents-tab";
import { SecuritiesTab } from "./securities-tab";
import { DiligenceTab } from "./diligence-tab";
import { MemoTab } from "./memo-tab";
import { IcTab } from "./ic-tab";
import { HistoryTab } from "./history-tab";

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
    case "diligence": return <DiligenceTab db={db} deal={deal} />;
    case "memo": return <MemoTab db={db} deal={deal} />;
    case "ic": return <IcTab db={db} deal={deal} />;
    case "stakeholders": return <Stakeholders db={db} deal={deal} />;
    case "documents": return <DocumentsTab db={db} deal={deal} />;
    case "notes": return <NoteList db={db} notes={db.notes.filter((n) => n.subject.type === "deal" && n.subject.id === deal.id)} />;
    case "history": return <HistoryTab db={db} deal={deal} />;
    default: return <EmptyState title="Unknown tab" />;
  }
}

function Stakeholders({ db, deal }: { db: DB; deal: Deal }) {
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
