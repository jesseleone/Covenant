// Derived values. Everything here is a pure function of the DB, so the same
// numbers appear in the header, the memo, chat and the tests.

import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Covenant, DB, Deal, ExtractedField, MemoSection, TermSet, Tranche } from "@/lib/schema";

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export const dealById = (db: DB, id: string) => db.deals.find((d) => d.id === id);
export const companyById = (db: DB, id?: string) => (id ? db.companies.find((c) => c.id === id) : undefined);
export const personById = (db: DB, id?: string) => (id ? db.people.find((p) => p.id === id) : undefined);
export const userById = (db: DB, id?: string) => (id ? db.users.find((u) => u.id === id) : undefined);
export const documentById = (db: DB, id?: string) => (id ? db.documents.find((d) => d.id === id) : undefined);

// ---------------------------------------------------------------------------
// Extracted fields
// ---------------------------------------------------------------------------

export const fieldFor = (db: DB, dealId: string, key: string): ExtractedField | undefined =>
  db.extractedFields.find((f) => f.dealId === dealId && f.fieldKey === key);

export type FieldValue = { value: number | string; field: ExtractedField; unconfirmed: boolean };

/** The confirmed or corrected value; a proposed value is returned with `unconfirmed: true`. */
export function fieldValue(db: DB, dealId: string, key: string): FieldValue | null {
  const field = fieldFor(db, dealId, key);
  if (!field) return null;
  return { value: field.value, field, unconfirmed: field.status === "proposed" };
}

export function numField(db: DB, dealId: string, key: string): number | null {
  const v = fieldValue(db, dealId, key);
  return v && typeof v.value === "number" ? v.value : null;
}

// ---------------------------------------------------------------------------
// Term sets
// ---------------------------------------------------------------------------

export const termSetsFor = (db: DB, dealId: string): TermSet[] =>
  db.termSets.filter((t) => t.dealId === dealId).sort((a, b) => a.version - b.version);

/** The highest version. */
export function activeTermSet(db: DB, dealId: string): TermSet | undefined {
  const sets = termSetsFor(db, dealId);
  return sets[sets.length - 1];
}

/** The term set locked by an IC approval. */
export const approvedTermSet = (db: DB, dealId: string): TermSet | undefined =>
  termSetsFor(db, dealId).find((t) => t.status === "locked" && t.label === "ic_approved");

export const tranchesFor = (db: DB, termSetId?: string): Tranche[] =>
  termSetId ? db.tranches.filter((t) => t.termSetId === termSetId) : [];

export const covenantFor = (db: DB, termSetId?: string, metric: Covenant["metric"] = "total_leverage"): Covenant | undefined =>
  termSetId ? db.covenants.find((c) => c.termSetId === termSetId && c.metric === metric) : undefined;

const resolveTermSetId = (db: DB, dealId: string, termSetId?: string) => termSetId ?? activeTermSet(db, dealId)?.id;

export const fundedDebt = (db: DB, termSetId?: string) => tranchesFor(db, termSetId).reduce((s, t) => s + t.fundedAtClose, 0);
export const facilitySize = (db: DB, termSetId?: string) => tranchesFor(db, termSetId).reduce((s, t) => s + t.commitment, 0);
export const fundHold = (db: DB, termSetId?: string) => tranchesFor(db, termSetId).reduce((s, t) => s + t.fundHold, 0);

/** The lead tranche: the term loan if there is one, else the first. */
export function leadTranche(db: DB, termSetId?: string): Tranche | undefined {
  const ts = tranchesFor(db, termSetId);
  return ts.find((t) => t.key === "tl") ?? ts[0];
}

// ---------------------------------------------------------------------------
// Leverage and covenant cushion
// ---------------------------------------------------------------------------

/** Σ funded-at-close debt ÷ LTM adjusted EBITDA. */
export function totalLeverage(db: DB, dealId: string, termSetId?: string): number | null {
  const ebitda = numField(db, dealId, "adj_ebitda_ltm");
  const tsId = resolveTermSetId(db, dealId, termSetId);
  if (!ebitda || !tsId || tranchesFor(db, tsId).length === 0) return null;
  return fundedDebt(db, tsId) / ebitda;
}

/** The covenant level in force on `asOf`; before the first test date, the first level. */
export function currentCovenantLevel(cov: Covenant | undefined, asOf: string): number | null {
  if (!cov || cov.levels.length === 0) return null;
  const sorted = [...cov.levels].sort((a, b) => a.from.localeCompare(b.from));
  let level = sorted[0].level;
  for (const l of sorted) if (l.from <= asOf) level = l.level;
  return level;
}

/**
 * The date metrics are measured at: today for live deals, the closing date for
 * closed deals, and the last stage change for passed or lost ones.
 */
export function metricsAsOf(db: DB, dealId: string): string {
  const d = dealById(db, dealId);
  if (!d || d.status === "active") return db.settings.today;
  if (d.status === "closed" && d.closedAt) return d.closedAt;
  return d.stageEnteredAt.slice(0, 10);
}

/** 1 − leverage ÷ covenant level, as a fraction. */
export function cushionPct(db: DB, dealId: string, termSetId?: string): number | null {
  const tsId = resolveTermSetId(db, dealId, termSetId);
  const lev = totalLeverage(db, dealId, tsId);
  const level = currentCovenantLevel(covenantFor(db, tsId), metricsAsOf(db, dealId));
  if (lev === null || level === null) return null;
  return 1 - lev / level;
}

export const cushionBelowGuideline = (db: DB, cushion: number | null) =>
  cushion !== null && cushion * 100 < db.settings.coverageCushionGuidelinePct;

// ---------------------------------------------------------------------------
// Deal-level summary used by headers, lists and chat
// ---------------------------------------------------------------------------

export type DealMetrics = {
  facilitySize: number; fundHold: number; fundedDebt: number;
  leverage: number | null; spreadBps: number | null; floorBps: number | null;
  covenantLevel: number | null; cushion: number | null; cushionWarn: boolean;
  /** True when leverage or cushion rely on a still-proposed field. */
  unconfirmed: boolean;
  nextIcDate: string | null;
};

export function dealMetrics(db: DB, dealId: string, termSetId?: string): DealMetrics {
  const tsId = resolveTermSetId(db, dealId, termSetId);
  const lead = leadTranche(db, tsId);
  const cushion = cushionPct(db, dealId, tsId);
  return {
    facilitySize: facilitySize(db, tsId),
    fundHold: fundHold(db, tsId),
    fundedDebt: fundedDebt(db, tsId),
    leverage: totalLeverage(db, dealId, tsId),
    spreadBps: lead?.spreadBps ?? null,
    floorBps: lead?.floorBps ?? null,
    covenantLevel: currentCovenantLevel(covenantFor(db, tsId), metricsAsOf(db, dealId)),
    cushion,
    cushionWarn: cushionBelowGuideline(db, cushion),
    unconfirmed: !!fieldValue(db, dealId, "adj_ebitda_ltm")?.unconfirmed,
    nextIcDate: nextIcDate(db, dealId),
  };
}

export function nextIcDate(db: DB, dealId: string): string | null {
  const pending = db.icEvents.filter((e) => e.dealId === dealId && e.status === "pending").sort((a, b) => a.date.localeCompare(b.date));
  return pending[0]?.date ?? null;
}

export function daysInStage(db: DB, deal: Deal): number {
  return differenceInCalendarDays(parseISO(db.settings.today), parseISO(deal.stageEnteredAt));
}

export function lastActivityAt(db: DB, dealId: string): string | null {
  let latest: string | null = null;
  for (const e of db.auditEvents) if (e.dealId === dealId && (!latest || e.at > latest)) latest = e.at;
  return latest;
}

// ---------------------------------------------------------------------------
// Memo staleness
// ---------------------------------------------------------------------------

const r4 = (n: number | null) => (n === null ? "null" : n.toFixed(4));

/**
 * Serialize one memo dependency to a stable string. Dependency keys:
 * `field:<key>`, `metric:<name>`, `termset:active`, `covenant:<metric>`, `dd:red_flags`, `dd:open_items`.
 */
export function serializeDependency(db: DB, dealId: string, dep: string): string {
  const [kind, name] = dep.split(":");
  switch (kind) {
    case "field": {
      const v = fieldValue(db, dealId, name);
      return v ? String(v.value) : "null";
    }
    case "metric": {
      if (name === "total_leverage") return r4(totalLeverage(db, dealId));
      if (name === "cushion_pct") return r4(cushionPct(db, dealId));
      return "null";
    }
    case "termset": {
      const ts = activeTermSet(db, dealId);
      if (!ts) return "null";
      const tr = tranchesFor(db, ts.id).map((t) => [t.key, t.commitment, t.fundedAtClose, t.spreadBps, t.floorBps, t.oidPct, t.maturityDate]);
      const cov = db.covenants.filter((c) => c.termSetId === ts.id).map((c) => [c.metric, c.levels]);
      return JSON.stringify({ v: ts.version, tr, cov });
    }
    case "covenant": {
      return JSON.stringify(covenantFor(db, activeTermSet(db, dealId)?.id, name as Covenant["metric"])?.levels ?? null);
    }
    case "dd": {
      const items = db.ddItems.filter((d) => d.dealId === dealId);
      if (name === "red_flags") {
        return JSON.stringify(items.filter((d) => d.severity === "red_flag").map((d) => [d.id, d.status, d.mitigant ?? "", d.icConditionId ?? ""]));
      }
      return JSON.stringify(items.filter((d) => d.status === "open").map((d) => [d.id, d.status]));
    }
    default:
      return "null";
  }
}

export function computeSnapshot(db: DB, dealId: string, deps: string[]): Record<string, string> {
  return Object.fromEntries(deps.map((d) => [d, serializeDependency(db, dealId, d)]));
}

export function memoDealId(db: DB, section: Pick<MemoSection, "memoId">): string | undefined {
  return db.memos.find((m) => m.id === section.memoId)?.dealId;
}

/** Dependencies whose current value differs from the snapshot taken when the section was written. */
export function staleDependencies(db: DB, section: MemoSection): string[] {
  const dealId = memoDealId(db, section);
  if (!dealId) return [];
  return section.dependencies.filter((d) => section.snapshot[d] !== serializeDependency(db, dealId, d));
}

export const sectionIsStale = (db: DB, section: MemoSection) => staleDependencies(db, section).length > 0;

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

export function currentAffiliation(db: DB, personId: string) {
  const affs = db.affiliations.filter((a) => a.personId === personId);
  return affs.find((a) => a.isCurrent) ?? affs[affs.length - 1];
}

export function notesMentioning(db: DB, type: "deal" | "company" | "person", id: string) {
  return db.notes.filter((n) => (n.subject.type === type && n.subject.id === id) || n.mentions.some((m) => m.type === type && m.id === id));
}

export type Strength = "strong" | "medium" | "weak";

/** Based on the count and recency of notes and deal roles. */
export function relationshipStrength(db: DB, personId: string): Strength {
  const notes = notesMentioning(db, "person", personId);
  const roles = db.stakeholders.filter((s) => s.personId === personId);
  const today = parseISO(db.settings.today);
  const recent = notes.filter((n) => differenceInCalendarDays(today, parseISO(n.createdAt)) <= 120).length;
  const activeRoles = roles.filter((r) => dealById(db, r.dealId)?.status === "active").length;
  const score = notes.length + roles.length + 2 * recent + 2 * activeRoles;
  return score >= 6 ? "strong" : score >= 3 ? "medium" : "weak";
}

export function lastTouchAt(db: DB, personId: string): string | null {
  const dates = notesMentioning(db, "person", personId).map((n) => n.createdAt);
  return dates.sort().at(-1) ?? null;
}

/** Deals where the company is borrower, sponsor or a stakeholder, with its role. */
export function dealsForCompany(db: DB, companyId: string): { deal: Deal; role: string }[] {
  const out = new Map<string, string>();
  for (const d of db.deals) {
    if (d.borrowerCompanyId === companyId) out.set(d.id, "Borrower");
    else if (d.sponsorCompanyId === companyId) out.set(d.id, "Sponsor");
  }
  for (const s of db.stakeholders) if (s.companyId === companyId && !out.has(s.dealId)) out.set(s.dealId, s.role);
  return [...out].map(([id, role]) => ({ deal: dealById(db, id)!, role })).filter((x) => x.deal);
}

export function dealsForPerson(db: DB, personId: string): { deal: Deal; role: string }[] {
  return db.stakeholders
    .filter((s) => s.personId === personId)
    .map((s) => ({ deal: dealById(db, s.dealId)!, role: s.role }))
    .filter((x) => x.deal);
}

export const outcomeLabel = (d: Deal) =>
  d.status === "active" ? "Active" : d.status === "closed" ? "Closed" : d.status === "lost" ? "Lost" : d.status === "on_hold" ? "On hold" : "Passed";
