// The chat's query layer: typed reads over the DB, returned as compact JSON.
// Claude calls these as tools (live mode) and the offline engine calls the
// same functions, so both answer from identical data. In production these
// become an MCP server over Postgres.
//
// Every row carries a `cite` token ([[cite:<type>:<id>|<label>]]) the model
// copies into its answer, which the UI renders as a citation chip.

import Fuse from "fuse.js";
import type { DB, Deal } from "@/lib/schema";
import { PASS_REASON_LABELS, STAGE_LABELS, STRATEGY_LABELS } from "@/lib/schema";
import {
  activeTermSet, approvedTermSet, companyById, covenantFor, currentAffiliation, dealMetrics, dealsForCompany, dealsForPerson,
  documentById, fieldValue, metricsAsOf, notesMentioning, outcomeLabel, personById, relationshipStrength, termSetsFor,
  tranchesFor, userById, cushionPct, totalLeverage,
} from "@/lib/selectors";
import { findPrecedents } from "@/lib/queries";
import { docShortName } from "@/lib/render/tokens";

const r1 = (n: number | null | undefined, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? null : +n.toFixed(d));
const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : null);
const cite = (type: string, id: string, label: string) => `[[cite:${type}:${id}|${label.replace(/[|\]]/g, " ")}]]`;
const dealCite = (d: Deal) => cite("deal", d.id, d.name);
const user = (db: DB, id?: string) => userById(db, id)?.name ?? null;

/** The term set a deal's figures should be quoted from: approved if locked, else the latest. */
const termsFor = (db: DB, dealId: string) => approvedTermSet(db, dealId) ?? activeTermSet(db, dealId);

function dealRow(db: DB, d: Deal) {
  const ts = termsFor(db, d.id);
  const m = dealMetrics(db, d.id, ts?.id);
  const finalIc = db.icEvents.filter((e) => e.dealId === d.id && e.status === "decided").sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    id: d.id, name: d.name, cite: dealCite(d),
    borrower: companyById(db, d.borrowerCompanyId)?.name, sponsor: companyById(db, d.sponsorCompanyId)?.name ?? null,
    sector: d.sector, sectorTags: d.sectorTags,
    stage: STAGE_LABELS[d.stage], status: outcomeLabel(d),
    facilitySizeM: r1(m.facilitySize, 1), leverageX: r1(m.leverage), spreadBps: m.spreadBps, cushionPct: m.cushion === null ? null : r1(m.cushion * 100, 1),
    termSet: ts ? `v${ts.version} (${ts.status})` : null,
    passReason: d.passReason ? PASS_REASON_LABELS[d.passReason] : null, passNote: d.passNote ?? null,
    closedAt: d.closedAt ?? null, lastIcDecision: finalIc ? { stage: finalIc.stage, decision: finalIc.decision, date: day(finalIc.date), cite: cite("ic_event", finalIc.id, `${finalIc.stage === "final" ? "Final" : "Screening"} IC ${day(finalIc.date)}`) } : null,
    lead: user(db, d.leadUserId),
  };
}

// ---------------------------------------------------------------------------

export function searchEntities(db: DB, input: { query: string; types?: ("deal" | "company" | "person")[] }) {
  const types = input.types?.length ? input.types : ["deal", "company", "person"];
  const rows = [
    ...(types.includes("deal") ? db.deals.map((d) => ({ type: "deal", id: d.id, name: d.name, keys: [d.name, d.codename, d.sector], detail: `${outcomeLabel(d)} · ${STAGE_LABELS[d.stage]} · ${companyById(db, d.borrowerCompanyId)?.name}` })) : []),
    ...(types.includes("company") ? db.companies.map((c) => ({ type: "company", id: c.id, name: c.name, keys: [c.name, ...c.aliases], detail: `${c.types.join(", ")} · ${c.sector ?? ""}` })) : []),
    ...(types.includes("person") ? db.people.map((p) => { const a = currentAffiliation(db, p.id); return { type: "person", id: p.id, name: p.fullName, keys: [p.fullName, p.email ?? ""], detail: `${a?.title ?? ""} @ ${companyById(db, a?.companyId)?.name ?? ""}` }; }) : []),
  ];
  const fuse = new Fuse(rows, { keys: ["keys"], threshold: 0.35, ignoreLocation: true, includeScore: true });
  return fuse.search(input.query).slice(0, 8).map(({ item }) => ({ type: item.type, id: item.id, name: item.name, detail: item.detail, cite: cite(item.type, item.id, item.name) }));
}

export function listDeals(db: DB, input: { stage?: string; status?: string; sponsorId?: string; sectorKeyword?: string; minSize?: number; maxSize?: number }) {
  const kw = input.sectorKeyword?.toLowerCase().replace(/[_-]/g, " ").trim();
  return db.deals.filter((d) => {
    if (input.stage && d.stage !== input.stage) return false;
    if (input.status) {
      const want = input.status === "passed_or_lost" ? ["passed", "lost"] : [input.status];
      if (!want.includes(d.status)) return false;
    }
    if (input.sponsorId && d.sponsorCompanyId !== input.sponsorId) return false;
    if (kw && ![d.sector, ...d.sectorTags].some((t) => t.toLowerCase().replace(/_/g, " ").includes(kw))) return false;
    if (input.minSize !== undefined && d.requestedSize < input.minSize) return false;
    if (input.maxSize !== undefined && d.requestedSize > input.maxSize) return false;
    return true;
  }).map((d) => dealRow(db, d));
}

export function getDeal(db: DB, input: { dealId: string }) {
  const d = db.deals.find((x) => x.id === input.dealId);
  if (!d) return { error: `No deal ${input.dealId}` };
  const memo = db.memos.filter((m) => m.dealId === d.id).sort((a, b) => b.version - a.version)[0];
  return {
    ...dealRow(db, d),
    strategy: STRATEGY_LABELS[d.strategy], dealType: d.dealType, requestedSizeM: d.requestedSize, fundHoldTargetM: d.fundHoldTarget,
    expectedClose: d.expectedClose ?? null, riskRating: d.riskRating ? `${d.riskRating.value} on ${d.riskRating.scale}` : null,
    summary: d.summary, thesis: d.thesis, team: d.teamUserIds.map((id) => user(db, id)),
    adjEbitdaLtm: (() => { const f = fieldValue(db, d.id, "adj_ebitda_ltm"); return f ? { valueM: f.value, status: f.field.status, source: `${docShortName(documentById(db, f.field.documentId)?.docType)} p.${f.field.page}`, cite: cite("document", `${f.field.documentId}#p${f.field.page}`, `${docShortName(documentById(db, f.field.documentId)?.docType)} p.${f.field.page}`) } : null; })(),
    openRedFlags: db.ddItems.filter((x) => x.dealId === d.id && x.severity === "red_flag" && !x.mitigant && !x.icConditionId).map((x) => x.title),
    memo: memo ? { type: memo.memoType, version: memo.version, status: memo.status } : null,
    nextIc: day(dealMetrics(db, d.id).nextIcDate),
  };
}

export function getTermSet(db: DB, input: { dealId: string; which?: "active" | "approved" | number }) {
  const sets = termSetsFor(db, input.dealId);
  const ts = input.which === "approved" ? approvedTermSet(db, input.dealId) : typeof input.which === "number" ? sets.find((t) => t.version === input.which) : activeTermSet(db, input.dealId);
  if (!ts) return { error: "No matching term set", versions: sets.map((t) => `v${t.version} ${t.status}`) };
  const cov = covenantFor(db, ts.id);
  return {
    version: ts.version, label: ts.label, status: ts.status, cite: cite("term_set", ts.id, `Term set v${ts.version}`),
    allVersions: sets.map((t) => ({ version: t.version, status: t.status, label: t.label })),
    tranches: tranchesFor(db, ts.id).map((t) => ({ name: t.name, commitmentM: t.commitment, fundedM: t.fundedAtClose, holdM: t.fundHold, lien: t.lienRank, spreadBps: t.spreadBps, floorBps: t.floorBps, oidPct: t.oidPct, call: t.callProtection, maturity: t.maturityDate })),
    covenant: cov ? { metric: cov.metric, levels: cov.levels.map((l) => ({ from: l.from, levelX: l.level })) } : null,
    leverageX: r1(totalLeverage(db, input.dealId, ts.id)), cushionPct: (() => { const c = cushionPct(db, input.dealId, ts.id); return c === null ? null : r1(c * 100, 1); })(),
    measuredAsOf: metricsAsOf(db, input.dealId),
  };
}

export function getFinancials(db: DB, input: { dealId: string }) {
  const fields = db.extractedFields.filter((f) => f.dealId === input.dealId).map((f) => {
    const src = `${docShortName(documentById(db, f.documentId)?.docType)} p.${f.page}`;
    return { key: f.fieldKey, label: f.label, value: f.value, unit: f.unit, period: f.period ?? null, status: f.status, confidence: f.confidence, source: src, cite: cite("document", `${f.documentId}#p${f.page}`, src),
      ...(f.correctedFrom ? { correctedFrom: { value: f.correctedFrom.value, source: `${docShortName(documentById(db, f.correctedFrom.documentId)?.docType)} p.${f.correctedFrom.page}` } } : {}) };
  });
  const periods = db.financialPeriods.filter((p) => p.dealId === input.dealId).map((p) => {
    const e = p.adjEbitdaFieldKey ? Number(fieldValue(db, input.dealId, p.adjEbitdaFieldKey)?.value ?? p.adjEbitda) : p.adjEbitda;
    return { label: p.label, case: p.case, revenueM: p.revenue, adjEbitdaM: e, capexM: p.capex, interestM: p.interest ?? null };
  });
  return { fields, periods, cite: cite("deal", input.dealId, "Financials") };
}

export function getDDItems(db: DB, input: { dealId: string; severity?: string }) {
  return db.ddItems.filter((d) => d.dealId === input.dealId && (!input.severity || d.severity === input.severity)).map((d) => {
    const cond = db.icConditions.find((c) => c.id === d.icConditionId);
    return { title: d.title, workstream: d.workstream, kind: d.kind, severity: d.severity ?? null, status: d.status, detail: d.detail, mitigant: d.mitigant ?? null,
      icCondition: cond ? { description: cond.description, status: cond.status } : null, owner: user(db, d.ownerUserId), due: d.dueDate ?? null, cite: cite("dd_item", d.id, `DD · ${d.workstream}`) };
  });
}

export function getIcEvents(db: DB, input: { dealId?: string; dealIds?: string[] }) {
  const ids = input.dealIds ?? (input.dealId ? [input.dealId] : null);
  return db.icEvents.filter((e) => !ids || ids.includes(e.dealId)).sort((a, b) => a.date.localeCompare(b.date)).map((e) => {
    const d = db.deals.find((x) => x.id === e.dealId)!;
    const ts = db.termSets.find((t) => t.id === e.termSetId);
    return {
      deal: d.name, dealId: d.id, stage: e.stage, date: day(e.date), status: e.status, decision: e.decision ?? null, approvedHoldM: e.approvedHold ?? null,
      termSet: ts ? `v${ts.version} (${ts.status})` : null,
      votes: e.votes.map((v) => ({ member: user(db, v.userId), vote: v.vote, comment: v.comment ?? null })),
      qa: e.qa.map((q) => ({ question: q.question, askedBy: user(db, q.askedBy), answer: q.answer ?? null })),
      conditions: db.icConditions.filter((c) => c.icEventId === e.id).map((c) => ({ description: c.description, type: c.type, status: c.status })),
      cite: cite("ic_event", e.id, `${d.codename} ${e.stage === "final" ? "final" : "screening"} IC`),
    };
  });
}

export function findPrecedentsTool(db: DB, input: { dealId: string }) {
  return findPrecedents(db, input.dealId).map((p) => ({
    ...dealRow(db, p.deal), similarity: r1(p.score), sharedSectorTags: p.sharedTags, tags: p.deal.tags,
    topCustomerPct: fieldValue(db, p.deal.id, "top_customer_pct")?.value ?? null,
    icQuestions: p.icEvents.flatMap((e) => e.qa.map((q) => ({ question: q.question, answer: q.answer ?? null, askedBy: user(db, q.askedBy), date: day(e.date) }))),
  }));
}

export function getCompany(db: DB, input: { companyId: string }) {
  const c = companyById(db, input.companyId);
  if (!c) return { error: `No company ${input.companyId}` };
  return {
    id: c.id, name: c.name, cite: cite("company", c.id, c.name), types: c.types, sector: c.sector, hq: c.hqCity, description: c.description, aliases: c.aliases,
    relationshipOwner: user(db, c.ownerUserId),
    people: db.affiliations.filter((a) => a.companyId === c.id).map((a) => {
      const p = personById(db, a.personId)!;
      return { name: p.fullName, id: p.id, cite: cite("person", p.id, p.fullName), title: a.title, current: a.isCurrent, from: a.startDate ?? null, to: a.endDate ?? null, relationshipOwner: user(db, p.relationshipOwnerId), strength: relationshipStrength(db, p.id) };
    }),
    deals: dealsForCompany(db, c.id).map(({ deal, role }) => ({ ...dealRow(db, deal), role })),
  };
}

export function getPerson(db: DB, input: { personId: string }) {
  const p = personById(db, input.personId);
  if (!p) return { error: `No person ${input.personId}` };
  return {
    id: p.id, name: p.fullName, cite: cite("person", p.id, p.fullName), type: p.personType, email: p.email ?? null, bio: p.bio ?? null,
    relationshipOwner: user(db, p.relationshipOwnerId), strength: relationshipStrength(db, p.id),
    roleHistory: db.affiliations.filter((a) => a.personId === p.id).map((a) => ({ company: companyById(db, a.companyId)?.name, companyCite: cite("company", a.companyId, companyById(db, a.companyId)?.name ?? ""), title: a.title, from: a.startDate ?? null, to: a.endDate ?? null, current: a.isCurrent })),
    deals: dealsForPerson(db, p.id).map(({ deal, role }) => ({ ...dealRow(db, deal), role })),
  };
}

export function getActivity(db: DB, input: { type: "deal" | "company" | "person"; id: string; limit?: number }) {
  return notesMentioning(db, input.type, input.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, input.limit ?? 10).map((n) => ({
    date: day(n.createdAt), type: n.noteType, author: user(db, n.authorId), body: n.body,
  }));
}

export function getHistory(db: DB, input: { dealId: string; sinceIso?: string }) {
  let since = input.sinceIso;
  let sinceLabel: string | null = null;
  if (!since || since === "last_ic") {
    const ic = db.icEvents.filter((e) => e.dealId === input.dealId && e.status === "decided" && e.decidedAt).sort((a, b) => b.decidedAt!.localeCompare(a.decidedAt!))[0];
    if (input.sinceIso === "last_ic" && ic) { since = ic.decidedAt!; sinceLabel = `${ic.stage} IC decision on ${day(ic.decidedAt)}`; }
  }
  return {
    since: since ?? null, sinceLabel,
    events: db.auditEvents.filter((e) => e.dealId === input.dealId && (!since || e.at > since)).sort((a, b) => a.at.localeCompare(b.at)).map((e) => ({
      at: day(e.at), who: user(db, e.actorId), action: e.action, summary: e.summary, ...(e.before || e.after ? { before: e.before ?? null, after: e.after ?? null } : {}),
    })),
  };
}

export function getDocuments(db: DB, input: { dealId: string }) {
  return db.documents.filter((d) => d.dealId === input.dealId).map((d) => ({
    documentId: d.id, title: d.title, type: d.docType, version: d.version, pages: d.pages.length, source: d.source, added: day(d.uploadedAt),
    pageHeadings: d.pages.map((p) => `p.${p.n}: ${(p.markdown.match(/^#+\s*(.+)$/m)?.[1] ?? p.markdown.slice(0, 40)).trim()}`),
  }));
}

export function readDocumentPage(db: DB, input: { documentId: string; page: number }) {
  const doc = documentById(db, input.documentId);
  const page = doc?.pages.find((p) => p.n === input.page);
  if (!doc || !page) return { error: `No page ${input.page} in ${input.documentId}` };
  const label = `${docShortName(doc.docType)} p.${page.n}`;
  return { documentId: doc.id, title: doc.title, page: page.n, of: doc.pages.length, text: page.markdown, cite: cite("document", `${doc.id}#p${page.n}`, label) };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

type ToolFn = (db: DB, input: never) => unknown;

export const TOOL_IMPLS: Record<string, ToolFn> = {
  search_entities: searchEntities as ToolFn,
  list_deals: listDeals as ToolFn,
  get_deal: getDeal as ToolFn,
  get_term_set: getTermSet as ToolFn,
  get_financials: getFinancials as ToolFn,
  get_dd_items: getDDItems as ToolFn,
  get_ic_events: getIcEvents as ToolFn,
  find_precedents: findPrecedentsTool as ToolFn,
  get_company: getCompany as ToolFn,
  get_person: getPerson as ToolFn,
  get_activity: getActivity as ToolFn,
  get_history: getHistory as ToolFn,
  get_documents: getDocuments as ToolFn,
  read_document_page: readDocumentPage as ToolFn,
};

export type ToolCallRecord = { name: string; input: unknown; resultSummary: string; rowCount: number };

/** Run one tool. Errors become an error object the model can read. */
export function runTool(db: DB, name: string, input: unknown): { result: unknown; record: ToolCallRecord; isError: boolean } {
  const fn = TOOL_IMPLS[name];
  let result: unknown;
  let isError = false;
  try {
    result = fn ? fn(db, (input ?? {}) as never) : { error: `Unknown tool ${name}` };
  } catch (e) {
    result = { error: e instanceof Error ? e.message : String(e) };
  }
  if (result && typeof result === "object" && "error" in (result as Record<string, unknown>)) isError = true;
  const rows = Array.isArray(result) ? result.length
    : result && typeof result === "object" && Array.isArray((result as { events?: unknown[] }).events) ? (result as { events: unknown[] }).events.length
    : result && typeof result === "object" && Array.isArray((result as { fields?: unknown[] }).fields) ? (result as { fields: unknown[] }).fields.length
    : isError ? 0 : 1;
  return { result, isError, record: { name, input, rowCount: rows, resultSummary: summarize(name, result, rows, isError) } };
}

function summarize(name: string, result: unknown, rows: number, isError: boolean): string {
  if (isError) return String((result as { error: string }).error);
  const r = result as Record<string, unknown>;
  switch (name) {
    case "list_deals": case "find_precedents": return `${rows} deal${rows === 1 ? "" : "s"}`;
    case "search_entities": return `${rows} match${rows === 1 ? "" : "es"}`;
    case "get_ic_events": return `${rows} IC event${rows === 1 ? "" : "s"}`;
    case "get_dd_items": return `${rows} item${rows === 1 ? "" : "s"}`;
    case "get_history": return `${rows} change${rows === 1 ? "" : "s"}${r.sinceLabel ? ` since ${r.sinceLabel}` : ""}`;
    case "get_financials": return `${rows} values, ${(r.periods as unknown[]).length} periods`;
    case "get_term_set": return `v${r.version} (${r.status}), ${(r.tranches as unknown[]).length} tranches`;
    case "get_company": return `${(r.people as unknown[]).length} people, ${(r.deals as unknown[]).length} deals`;
    case "get_person": return `${(r.roleHistory as unknown[]).length} roles, ${(r.deals as unknown[]).length} deals`;
    case "get_activity": return `${rows} note${rows === 1 ? "" : "s"}`;
    case "get_deal": return String(r.name);
    case "get_documents": return `${rows} document${rows === 1 ? "" : "s"}`;
    case "read_document_page": return `${r.title} p.${r.page}`;
    default: return `${rows} row${rows === 1 ? "" : "s"}`;
  }
}

