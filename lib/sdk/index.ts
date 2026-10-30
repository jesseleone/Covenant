"use client";

// The Covenant extension SDK: the only module code in extensions/ may import
// (besides React). It exposes read-only data, a few calculations, a short
// list of allowed writes, and the shared UI components. Everything a citizen
// developer can build goes through here, so the core stays protected.
// See lib/sdk/README.md for the full list in plain English.

import { useMemo } from "react";
import type { Company, DB, Deal, DDItem, FinancialPeriod, ICCondition, ICEvent, Note, Person, TermSet, Tranche } from "@/lib/schema";
import { useCurrentUser, useDB } from "@/lib/store";
import { activeTermSet, dealMetrics, daysInStage, outcomeLabel, tranchesFor, type DealMetrics } from "@/lib/selectors";
import { addDDItem as addDDItemAction, addNote as addNoteAction, type NewDDItem } from "@/lib/client/actions";
import type { ActionResult } from "@/lib/core/commit";

// ---------------------------------------------------------------------------
// Types and labels
// ---------------------------------------------------------------------------

export type { Company, Deal, DDItem, FinancialPeriod, ICCondition, ICEvent, Note, Person, TermSet, Tranche, DealMetrics, ActionResult };
export type { Stage, Strategy } from "@/lib/schema";
export { STAGE_LABELS, STRATEGY_LABELS, PASS_REASON_LABELS } from "@/lib/schema";

/** Props a deal-tab extension receives. */
export type DealTabProps = { deal: Deal };

// ---------------------------------------------------------------------------
// Reading data
// ---------------------------------------------------------------------------

export type CovenantData = {
  /** Every deal, including passed, lost and closed ones (check `status`). */
  deals: readonly Deal[];
  companies: readonly Company[];
  people: readonly Person[];
  ddItems: readonly DDItem[];
  notes: readonly Note[];
  termSets: readonly TermSet[];
  financialPeriods: readonly FinancialPeriod[];
  icEvents: readonly ICEvent[];
  icConditions: readonly ICCondition[];
  /** The demo's "today" (YYYY-MM-DD). */
  today: string;
  /** The signed-in person. */
  me: { id: string; name: string; role: string } | null;

  deal: (id: string) => Deal | undefined;
  company: (id?: string) => Company | undefined;
  person: (id?: string) => Person | undefined;
  /** Display name of an internal user (deal lead, note author). */
  userName: (id?: string) => string;
  /** Size, hold, leverage, spread, covenant level and cushion for a deal's current terms. */
  metrics: (dealId: string) => DealMetrics;
  /** The term set the numbers are based on (latest issued or approved version). */
  currentTerms: (dealId: string) => TermSet | undefined;
  /** Tranches (loans) in a term set. */
  tranches: (termSetId?: string) => readonly Tranche[];
  /** Diligence findings and requests on a deal. */
  diligenceFor: (dealId: string) => readonly DDItem[];
  /** Notes written about a deal, company or person. */
  notesAbout: (type: "deal" | "company" | "person", id: string) => readonly Note[];
  daysInStage: (deal: Deal) => number;
  /** "Active", "Passed", "Lost", "On hold" or "Closed". */
  statusLabel: (deal: Deal) => string;
};

function view(db: DB, me: CovenantData["me"]): CovenantData {
  return {
    deals: db.deals, companies: db.companies, people: db.people, ddItems: db.ddItems, notes: db.notes, termSets: db.termSets,
    financialPeriods: db.financialPeriods, icEvents: db.icEvents, icConditions: db.icConditions, today: db.settings.today, me,
    deal: (id) => db.deals.find((d) => d.id === id),
    company: (id) => db.companies.find((c) => c.id === id),
    person: (id) => db.people.find((p) => p.id === id),
    userName: (id) => db.users.find((u) => u.id === id)?.name ?? "—",
    metrics: (dealId) => dealMetrics(db, dealId),
    currentTerms: (dealId) => activeTermSet(db, dealId),
    tranches: (termSetId) => tranchesFor(db, termSetId),
    diligenceFor: (dealId) => db.ddItems.filter((d) => d.dealId === dealId),
    notesAbout: (type, id) => db.notes.filter((n) => n.subject.type === type && n.subject.id === id),
    daysInStage: (deal) => daysInStage(db, deal),
    statusLabel: (deal) => outcomeLabel(deal),
  };
}

/** Read-only access to the fund's data. Re-renders when the data changes. */
export function useCovenant(): CovenantData {
  const db = useDB();
  const user = useCurrentUser();
  return useMemo(() => view(db, user ? { id: user.id, name: user.name, role: user.role } : null), [db, user]);
}

// ---------------------------------------------------------------------------
// Writing data: only these actions. Each runs on the server, checks the
// person's permissions and is recorded in the deal's History.
// ---------------------------------------------------------------------------

/** Add a note to a deal, company or person. */
export function addNote(subject: { type: "deal" | "company" | "person"; id: string }, text: string, kind: Note["noteType"] = "general"): Promise<ActionResult> {
  return addNoteAction(subject, text, kind);
}

/** Add a diligence request or finding to a deal. */
export function addDiligenceItem(dealId: string, item: NewDDItem): Promise<ActionResult> {
  return addDDItemAction(dealId, item);
}
export type NewDiligenceItem = NewDDItem;

/** The writes extensions may use, for documentation and checks. */
export const ALLOWED_WRITES = ["addNote", "addDiligenceItem"] as const;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export {
  fmtUsdM as formatMoney, fmtX as formatMultiple, fmtPct as formatPercent, fmtSpread as formatSpread,
  fmtDate as formatDate, fmtMonthYear as formatMonth, titleCase,
} from "@/lib/format";

// ---------------------------------------------------------------------------
// Shared UI components
// ---------------------------------------------------------------------------

export {
  Avatar, Button, Card, Chip, EmptyState, KV, Label, PageHeader, Section, Table, TD, TH, THead, TR, TextLink,
} from "@/components/ui/primitives";
export { DealStatusChip, SeverityChip, StageChip, StrategyChip } from "@/components/ui/chips";
export { BarChart, type Bar } from "@/components/ui/bar-chart";
