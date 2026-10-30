// Mapping between Postgres rows and the app's `DB` shape (lib/schema.ts).
//
// `loadDB` assembles the whole database (it is small); `saveDiff` compares the
// database before and after an action and writes only the rows that changed,
// including child tables (deal team, document pages, covenant levels, IC votes
// and questions, note mentions). Server-only.

import type { Client } from "@/lib/server/db";
import type {
  AuditEvent, ChatMessage, ChatThread, Company, Covenant, DB, DDItem, Deal, DevilsAdvocate, Doc, ExtractedField,
  FinancialPeriod, ICCondition, ICEvent, Memo, MemoSection, Note, Person, Affiliation, Stakeholder, StageEvent, TermSet,
  Tranche, User,
} from "@/lib/schema";

type Row = Record<string, unknown>;
type Collection = Exclude<keyof DB, "settings">;
type Item<K extends Collection> = DB[K][number];

type ChildSpec<T> = { table: string; fk: string; rows: (e: T) => Row[]; json?: string[] };
type Spec<K extends Collection> = {
  key: K;
  table: string;
  /** Column list for SELECT, when a plain `*` doesn't come back in a usable form. */
  select?: string;
  json?: string[];
  toRow: (e: Item<K>) => Row;
  fromRow: (r: Row, kids: Record<string, Row[]>) => Item<K>;
  children?: ChildSpec<Item<K>>[];
};

// Optional values: absent in the app model, NULL in the database.
const n = (v: unknown) => (v === undefined || v === "" ? null : v);
/** Drop keys whose value is null or undefined (the app model leaves them out). */
function clean<T extends object>(o: T): T {
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === null || o[k] === undefined) delete o[k];
  return o;
}
const s = (v: unknown) => v as string;
const num = (v: unknown) => v as number;

const spec = <K extends Collection>(x: Spec<K>) => x;

// Order matters for inserts: a table comes after the tables its triggers read
// (tranche and covenant check their term set). Foreign keys are deferred.
const SPECS = [
  spec({
    key: "users", table: "app_user",
    toRow: (u: User) => ({ id: u.id, name: u.name, email: u.email, role: u.role, title: u.title, initials: u.initials }),
    fromRow: (r) => ({ id: s(r.id), name: s(r.name), email: s(r.email), role: r.role as User["role"], title: s(r.title), initials: s(r.initials) }),
  }),
  spec({
    key: "companies", table: "company",
    select: "id, name, aliases, domain, types::text[] AS types, sector, hq_country, hq_city, description, owner_user_id, created_at",
    toRow: (c: Company) => ({
      id: c.id, name: c.name, aliases: c.aliases, domain: n(c.domain), types: c.types, sector: n(c.sector), hq_country: n(c.hqCountry),
      hq_city: n(c.hqCity), description: n(c.description), owner_user_id: n(c.ownerUserId), created_at: c.createdAt,
    }),
    fromRow: (r) => clean({
      id: s(r.id), name: s(r.name), aliases: r.aliases as string[], domain: r.domain as string, types: r.types as Company["types"],
      sector: r.sector as string, hqCountry: r.hq_country as string, hqCity: r.hq_city as string, description: r.description as string,
      ownerUserId: r.owner_user_id as string, createdAt: s(r.created_at),
    }),
  }),
  spec({
    key: "people", table: "person",
    toRow: (p: Person) => ({
      id: p.id, full_name: p.fullName, email: n(p.email), phone: n(p.phone), person_type: p.personType,
      relationship_owner_id: n(p.relationshipOwnerId), bio: n(p.bio), created_at: p.createdAt,
    }),
    fromRow: (r) => clean({
      id: s(r.id), fullName: s(r.full_name), email: r.email as string, phone: r.phone as string, personType: r.person_type as Person["personType"],
      relationshipOwnerId: r.relationship_owner_id as string, bio: r.bio as string, createdAt: s(r.created_at),
    }),
  }),
  spec({
    key: "affiliations", table: "affiliation",
    toRow: (a: Affiliation) => ({ id: a.id, person_id: a.personId, company_id: a.companyId, title: a.title, start_date: n(a.startDate), end_date: n(a.endDate), is_current: a.isCurrent }),
    fromRow: (r) => clean({
      id: s(r.id), personId: s(r.person_id), companyId: s(r.company_id), title: s(r.title), startDate: r.start_date as string,
      endDate: r.end_date as string, isCurrent: r.is_current as boolean,
    }),
  }),
  spec({
    key: "deals", table: "deal",
    toRow: (d: Deal) => ({
      id: d.id, name: d.name, codename: d.codename, borrower_company_id: d.borrowerCompanyId, sponsor_company_id: n(d.sponsorCompanyId),
      strategy: d.strategy, deal_type: d.dealType, stage: d.stage, status: d.status, pass_reason: n(d.passReason), pass_note: n(d.passNote),
      requested_size: d.requestedSize, fund_hold_target: d.fundHoldTarget, expected_close: n(d.expectedClose), closed_at: n(d.closedAt),
      lead_user_id: d.leadUserId, risk_rating: d.riskRating?.value ?? null, risk_rating_scale: d.riskRating?.scale ?? null,
      summary: n(d.summary), thesis: n(d.thesis), sector: d.sector, sector_tags: d.sectorTags, tags: d.tags,
      created_at: d.createdAt, stage_entered_at: d.stageEnteredAt,
    }),
    fromRow: (r, kids) => clean({
      id: s(r.id), name: s(r.name), codename: s(r.codename), borrowerCompanyId: s(r.borrower_company_id), sponsorCompanyId: r.sponsor_company_id as string,
      strategy: r.strategy as Deal["strategy"], dealType: r.deal_type as Deal["dealType"], stage: r.stage as Deal["stage"], status: r.status as Deal["status"],
      passReason: r.pass_reason as Deal["passReason"], passNote: r.pass_note as string, requestedSize: num(r.requested_size), fundHoldTarget: num(r.fund_hold_target),
      expectedClose: r.expected_close as string, closedAt: r.closed_at as string, leadUserId: s(r.lead_user_id),
      teamUserIds: (kids.deal_team ?? []).map((k) => s(k.user_id)),
      riskRating: r.risk_rating == null ? undefined : { value: num(r.risk_rating), scale: r.risk_rating_scale as "1-5 (1=best)" },
      summary: r.summary as string, thesis: r.thesis as string, tags: r.tags as string[], sectorTags: r.sector_tags as string[],
      sector: s(r.sector), createdAt: s(r.created_at), stageEnteredAt: s(r.stage_entered_at),
    }),
    children: [{ table: "deal_team", fk: "deal_id", rows: (d: Deal) => d.teamUserIds.map((u) => ({ deal_id: d.id, user_id: u })) }],
  }),
  spec({
    key: "stakeholders", table: "stakeholder",
    toRow: (x: Stakeholder) => ({ id: x.id, deal_id: x.dealId, person_id: n(x.personId), company_id: n(x.companyId), role: x.role, side: x.side }),
    fromRow: (r) => clean({ id: s(r.id), dealId: s(r.deal_id), personId: r.person_id as string, companyId: r.company_id as string, role: s(r.role), side: r.side as Stakeholder["side"] }),
  }),
  spec({
    key: "stageEvents", table: "stage_event",
    toRow: (e: StageEvent) => ({ id: e.id, deal_id: e.dealId, from_stage: e.from, to_stage: e.to, user_id: e.userId, at: e.at, override_reason: n(e.overrideReason) }),
    // `from` is null (not absent) for the event that creates a deal.
    fromRow: (r) => ({
      ...clean({ id: s(r.id), dealId: s(r.deal_id), to: r.to_stage as StageEvent["to"], userId: s(r.user_id), at: s(r.at), overrideReason: r.override_reason as string }),
      from: (r.from_stage ?? null) as StageEvent["from"],
    }),
  }),
  spec({
    key: "notes", table: "note",
    toRow: (x: Note) => ({ id: x.id, subject_type: x.subject.type, subject_id: x.subject.id, body: x.body, note_type: x.noteType, author_id: x.authorId, pinned: x.pinned, created_at: x.createdAt }),
    fromRow: (r, kids) => ({
      id: s(r.id), subject: { type: r.subject_type as Note["subject"]["type"], id: s(r.subject_id) }, body: s(r.body), noteType: r.note_type as Note["noteType"],
      authorId: s(r.author_id), pinned: r.pinned as boolean,
      mentions: (kids.note_mention ?? []).map((m) => ({ type: m.entity_type as Note["subject"]["type"], id: s(m.entity_id) })), createdAt: s(r.created_at),
    }),
    children: [{ table: "note_mention", fk: "note_id", rows: (x: Note) => x.mentions.map((m) => ({ note_id: x.id, entity_type: m.type, entity_id: m.id })) }],
  }),
  spec({
    key: "documents", table: "document",
    toRow: (d: Doc) => ({ id: d.id, deal_id: d.dealId, doc_type: d.docType, title: d.title, version: d.version, source: d.source, extraction_status: d.extractionStatus, uploaded_at: d.uploadedAt }),
    fromRow: (r, kids) => ({
      id: s(r.id), dealId: s(r.deal_id), docType: r.doc_type as Doc["docType"], title: s(r.title), version: num(r.version), source: r.source as Doc["source"],
      pages: (kids.document_page ?? []).map((p) => ({ n: num(p.n), markdown: s(p.text) })), extractionStatus: r.extraction_status as Doc["extractionStatus"], uploadedAt: s(r.uploaded_at),
    }),
    children: [{ table: "document_page", fk: "document_id", rows: (d: Doc) => d.pages.map((p) => ({ document_id: d.id, n: p.n, text: p.markdown })) }],
  }),
  spec({
    key: "extractedFields", table: "extracted_field", json: ["corrected_from"],
    toRow: (f: ExtractedField) => ({
      id: f.id, deal_id: f.dealId, document_id: f.documentId, page: f.page, quote: f.quote, field_key: f.fieldKey, label: f.label,
      value_num: typeof f.value === "number" ? f.value : null, value_text: typeof f.value === "string" ? f.value : null, unit: f.unit, period: n(f.period),
      confidence: f.confidence, status: f.status, corrected_from: f.correctedFrom ?? null, reviewed_by: n(f.reviewedBy), reviewed_at: n(f.reviewedAt),
    }),
    fromRow: (r) => clean({
      id: s(r.id), dealId: s(r.deal_id), documentId: s(r.document_id), page: num(r.page), quote: s(r.quote), fieldKey: s(r.field_key), label: s(r.label),
      value: (r.value_text ?? r.value_num) as number | string, unit: r.unit as ExtractedField["unit"], period: r.period as string, confidence: num(r.confidence),
      status: r.status as ExtractedField["status"], correctedFrom: r.corrected_from as ExtractedField["correctedFrom"], reviewedBy: r.reviewed_by as string, reviewedAt: r.reviewed_at as string,
    }),
  }),
  spec({
    key: "financialPeriods", table: "financial_period",
    toRow: (p: FinancialPeriod) => ({
      id: p.id, deal_id: p.dealId, company_id: p.companyId, label: p.label, period_end: p.periodEnd, period_type: p.periodType, case_name: p.case,
      revenue: p.revenue, adj_ebitda_field_key: n(p.adjEbitdaFieldKey), adj_ebitda: p.adjEbitda, capex: p.capex, interest: p.interest ?? null,
    }),
    fromRow: (r) => clean({
      id: s(r.id), dealId: s(r.deal_id), companyId: s(r.company_id), label: s(r.label), periodEnd: s(r.period_end), periodType: r.period_type as FinancialPeriod["periodType"],
      case: r.case_name as FinancialPeriod["case"], revenue: num(r.revenue), adjEbitdaFieldKey: r.adj_ebitda_field_key as string, adjEbitda: num(r.adj_ebitda),
      capex: num(r.capex), interest: r.interest as number,
    }),
  }),
  spec({
    key: "termSets", table: "term_set",
    toRow: (t: TermSet) => ({
      id: t.id, deal_id: t.dealId, version: t.version, label: t.label, status: t.status, parent_id: n(t.parentId), created_by: t.createdBy,
      created_at: t.createdAt, locked_by_ic_event_id: n(t.lockedByIcEventId), note: n(t.note),
    }),
    fromRow: (r) => clean({
      id: s(r.id), dealId: s(r.deal_id), version: num(r.version), label: r.label as TermSet["label"], status: r.status as TermSet["status"], parentId: r.parent_id as string,
      createdBy: s(r.created_by), createdAt: s(r.created_at), lockedByIcEventId: r.locked_by_ic_event_id as string, note: r.note as string,
    }),
  }),
  spec({
    key: "tranches", table: "tranche",
    toRow: (t: Tranche) => ({
      id: t.id, term_set_id: t.termSetId, key: t.key, name: t.name, instrument: t.instrument, lien_rank: t.lienRank, commitment: t.commitment,
      funded_at_close: t.fundedAtClose, fund_hold: t.fundHold, base_rate: t.baseRate, spread_bps: t.spreadBps, floor_bps: t.floorBps, oid_pct: t.oidPct,
      pik_bps: t.pikBps, call_protection: t.callProtection, maturity_date: t.maturityDate, amort_pct_per_year: t.amortPctPerYear,
    }),
    fromRow: (r) => ({
      id: s(r.id), termSetId: s(r.term_set_id), key: s(r.key), name: s(r.name), instrument: r.instrument as Tranche["instrument"], lienRank: r.lien_rank as Tranche["lienRank"],
      commitment: num(r.commitment), fundedAtClose: num(r.funded_at_close), fundHold: num(r.fund_hold), baseRate: "SOFR", spreadBps: num(r.spread_bps),
      floorBps: num(r.floor_bps), oidPct: num(r.oid_pct), pikBps: num(r.pik_bps), callProtection: s(r.call_protection), maturityDate: s(r.maturity_date),
      amortPctPerYear: num(r.amort_pct_per_year),
    }),
  }),
  spec({
    key: "covenants", table: "covenant",
    toRow: (c: Covenant) => ({ id: c.id, term_set_id: c.termSetId, metric: c.metric, operator: c.operator, test_frequency: c.testFrequency, notes: n(c.notes) }),
    fromRow: (r, kids) => clean({
      id: s(r.id), termSetId: s(r.term_set_id), metric: r.metric as Covenant["metric"], operator: r.operator as Covenant["operator"],
      levels: (kids.covenant_level ?? []).map((l) => ({ from: s(l.from_date), level: num(l.level) })), testFrequency: "quarterly" as const, notes: r.notes as string,
    }),
    children: [{ table: "covenant_level", fk: "covenant_id", rows: (c: Covenant) => c.levels.map((l) => ({ covenant_id: c.id, from_date: l.from, level: l.level })) }],
  }),
  spec({
    key: "ddItems", table: "dd_item",
    toRow: (d: DDItem) => ({
      id: d.id, deal_id: d.dealId, workstream: d.workstream, kind: d.kind, title: d.title, detail: d.detail, severity: n(d.severity), status: d.status,
      mitigant: n(d.mitigant), memo_section_key: n(d.memoSectionKey), ic_condition_id: n(d.icConditionId), owner_user_id: n(d.ownerUserId), due_date: n(d.dueDate),
    }),
    fromRow: (r) => clean({
      id: s(r.id), dealId: s(r.deal_id), workstream: r.workstream as DDItem["workstream"], kind: r.kind as DDItem["kind"], title: s(r.title), detail: s(r.detail),
      severity: r.severity as DDItem["severity"], status: r.status as DDItem["status"], mitigant: r.mitigant as string, memoSectionKey: r.memo_section_key as string,
      icConditionId: r.ic_condition_id as string, ownerUserId: r.owner_user_id as string, dueDate: r.due_date as string,
    }),
  }),
  spec({
    key: "memos", table: "memo",
    toRow: (m: Memo) => ({ id: m.id, deal_id: m.dealId, memo_type: m.memoType, version: m.version, status: m.status, term_set_id: m.termSetId, created_at: m.createdAt }),
    fromRow: (r) => ({
      id: s(r.id), dealId: s(r.deal_id), memoType: r.memo_type as Memo["memoType"], version: num(r.version), status: r.status as Memo["status"],
      termSetId: s(r.term_set_id), createdAt: s(r.created_at),
    }),
  }),
  spec({
    key: "memoSections", table: "memo_section", json: ["snapshot"],
    toRow: (m: MemoSection) => ({
      id: m.id, memo_id: m.memoId, key: m.key, title: m.title, ord: m.order, content: m.content, dependencies: m.dependencies, snapshot: m.snapshot,
      generated_by: m.generatedBy, reviewed_by: n(m.reviewedBy), reviewed_at: n(m.reviewedAt), updated_at: m.updatedAt,
    }),
    fromRow: (r) => clean({
      id: s(r.id), memoId: s(r.memo_id), key: s(r.key), title: s(r.title), order: num(r.ord), content: s(r.content), dependencies: r.dependencies as string[],
      snapshot: r.snapshot as Record<string, string>, generatedBy: r.generated_by as MemoSection["generatedBy"], reviewedBy: r.reviewed_by as string,
      reviewedAt: r.reviewed_at as string, updatedAt: s(r.updated_at),
    }),
  }),
  spec({
    key: "icEvents", table: "ic_event",
    toRow: (e: ICEvent) => ({
      id: e.id, deal_id: e.dealId, stage: e.stage, date: e.date, memo_id: n(e.memoId), term_set_id: n(e.termSetId), status: e.status,
      decision: n(e.decision), approved_hold: e.approvedHold ?? null, decided_at: n(e.decidedAt),
    }),
    fromRow: (r, kids) => clean({
      id: s(r.id), dealId: s(r.deal_id), stage: r.stage as ICEvent["stage"], date: s(r.date), memoId: r.memo_id as string, termSetId: r.term_set_id as string,
      status: r.status as ICEvent["status"], decision: r.decision as ICEvent["decision"],
      votes: (kids.ic_vote ?? []).map((v) => clean({ userId: s(v.user_id), vote: v.vote as ICEvent["votes"][number]["vote"], comment: v.comment as string })),
      qa: (kids.ic_question ?? []).map((q) => clean({ question: s(q.question), askedBy: s(q.asked_by), answer: q.answer as string })),
      approvedHold: r.approved_hold as number, decidedAt: r.decided_at as string,
    }),
    children: [
      { table: "ic_vote", fk: "ic_event_id", rows: (e: ICEvent) => e.votes.map((v) => ({ ic_event_id: e.id, user_id: v.userId, vote: v.vote, comment: n(v.comment) })) },
      // Questions have no id in the app model; their position identifies them.
      { table: "ic_question", fk: "ic_event_id", rows: (e: ICEvent) => e.qa.map((q, i) => ({ id: `${e.id}:q${i + 1}`, ic_event_id: e.id, question: q.question, asked_by: q.askedBy, answer: n(q.answer) })) },
    ],
  }),
  spec({
    key: "icConditions", table: "ic_condition",
    toRow: (c: ICCondition) => ({
      id: c.id, deal_id: c.dealId, ic_event_id: n(c.icEventId), description: c.description, type: c.type, owner_user_id: c.ownerUserId,
      due_date: n(c.dueDate), status: c.status, source_dd_item_id: n(c.sourceDdItemId),
    }),
    fromRow: (r) => clean({
      id: s(r.id), dealId: s(r.deal_id), icEventId: r.ic_event_id as string, description: s(r.description), type: r.type as ICCondition["type"],
      ownerUserId: s(r.owner_user_id), dueDate: r.due_date as string, status: r.status as ICCondition["status"], sourceDdItemId: r.source_dd_item_id as string,
    }),
  }),
  spec({
    key: "devilsAdvocate", table: "devils_advocate",
    toRow: (d: DevilsAdvocate) => ({ id: d.id, deal_id: d.dealId, question: d.question, rationale: d.rationale, precedent_deal_ids: d.precedentDealIds }),
    fromRow: (r) => ({ id: s(r.id), dealId: s(r.deal_id), question: s(r.question), rationale: s(r.rationale), precedentDealIds: r.precedent_deal_ids as string[] }),
  }),
  spec({
    key: "chatThreads", table: "chat_thread", json: ["scope"],
    toRow: (t: ChatThread) => ({ id: t.id, title: t.title, owner_id: t.ownerId, scope: t.scope ?? null, created_at: t.createdAt }),
    fromRow: (r) => clean({ id: s(r.id), title: s(r.title), ownerId: s(r.owner_id), createdAt: s(r.created_at), scope: r.scope as ChatThread["scope"] }),
  }),
  spec({
    key: "chatMessages", table: "chat_message", json: ["tool_calls"],
    toRow: (m: ChatMessage) => ({ id: m.id, thread_id: m.threadId, role: m.role, content: m.content, tool_calls: m.toolCalls ?? null, mode: n(m.mode), created_at: m.createdAt }),
    fromRow: (r) => clean({
      id: s(r.id), threadId: s(r.thread_id), role: r.role as ChatMessage["role"], content: s(r.content), toolCalls: r.tool_calls as ChatMessage["toolCalls"],
      mode: r.mode as ChatMessage["mode"], createdAt: s(r.created_at),
    }),
  }),
  spec({
    key: "auditEvents", table: "audit_event",
    toRow: (a: AuditEvent) => ({
      id: a.id, actor_id: a.actorId, action: a.action, entity_type: a.entity.type, entity_id: a.entity.id, deal_id: n(a.dealId),
      field: n(a.field), before: n(a.before), after: n(a.after), at: a.at, summary: a.summary,
    }),
    fromRow: (r) => clean({
      id: s(r.id), actorId: s(r.actor_id), action: s(r.action), entity: { type: s(r.entity_type), id: s(r.entity_id) }, dealId: r.deal_id as string,
      field: r.field as string, before: r.before as string, after: r.after as string, at: s(r.at), summary: s(r.summary),
    }),
  }),
] as const;

type AnySpec = Spec<Collection>;
const ALL = SPECS as unknown as AnySpec[];

/** Every table, parents first; used by reset. */
export const TABLES = ALL.flatMap((x) => [x.table, ...(x.children ?? []).map((c) => c.table)]).concat("settings");

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export async function loadDB(client: Client): Promise<DB> {
  const db = {} as Record<string, unknown>;
  for (const x of ALL) {
    const { rows } = await client.query(`SELECT ${x.select ?? "*"} FROM ${x.table} ORDER BY seq`);
    const kids: Record<string, Map<string, Row[]>> = {};
    for (const c of x.children ?? []) {
      const res = await client.query(`SELECT * FROM ${c.table} ORDER BY seq`);
      const byParent = new Map<string, Row[]>();
      for (const r of res.rows) {
        const list = byParent.get(r[c.fk] as string) ?? [];
        list.push(r);
        byParent.set(r[c.fk] as string, list);
      }
      kids[c.table] = byParent;
    }
    db[x.key] = rows.map((r) => {
      const own: Record<string, Row[]> = {};
      for (const [table, byParent] of Object.entries(kids)) own[table] = byParent.get(r.id as string) ?? [];
      return x.fromRow(r, own);
    });
  }
  const { rows: [st] } = await client.query("SELECT coverage_cushion_guideline_pct, today FROM settings WHERE id = 1");
  db.settings = { coverageCushionGuidelinePct: st?.coverage_cushion_guideline_pct ?? 25, today: st?.today ?? new Date().toISOString().slice(0, 10) };
  return db as unknown as DB;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function param(col: string, value: unknown, json: string[] | undefined) {
  // jsonb columns are sent as JSON text; node-postgres would turn JS arrays into Postgres arrays.
  return json?.includes(col) && value !== null ? JSON.stringify(value) : value;
}

async function insertRows(client: Client, table: string, rows: Row[], json?: string[]) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  // Stay well under Postgres's 65,535 parameters per statement.
  const perBatch = Math.max(1, Math.floor(10_000 / cols.length));
  for (let i = 0; i < rows.length; i += perBatch) {
    const batch = rows.slice(i, i + perBatch);
    const values: unknown[] = [];
    const tuples = batch.map((r) => `(${cols.map((c) => { values.push(param(c, r[c], json)); return `$${values.length}`; }).join(", ")})`);
    await client.query(`INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES ${tuples.join(", ")}`, values);
  }
}

async function updateRow(client: Client, table: string, row: Row, json?: string[]) {
  const cols = Object.keys(row).filter((c) => c !== "id");
  const values = cols.map((c) => param(c, row[c], json));
  await client.query(`UPDATE ${table} SET ${cols.map((c, i) => `"${c}" = $${i + 1}`).join(", ")} WHERE id = $${cols.length + 1}`, [...values, row.id]);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function writeSettings(client: Client, s: DB["settings"]) {
  await client.query(
    `INSERT INTO settings (id, coverage_cushion_guideline_pct, today) VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET coverage_cushion_guideline_pct = EXCLUDED.coverage_cushion_guideline_pct, today = EXCLUDED.today`,
    [s.coverageCushionGuidelinePct, s.today],
  );
}

/** Insert a whole database into empty tables (seed and reset). */
export async function insertAll(client: Client, db: DB) {
  // Seeded term sets are already issued or locked, which the lock triggers would
  // refuse; this setting lets them through for the rest of this transaction only.
  await client.query("SELECT set_config('covenant.seeding', 'on', true)");
  for (const x of ALL) {
    const items = db[x.key] as Item<Collection>[];
    await insertRows(client, x.table, items.map(x.toRow), x.json);
    for (const c of x.children ?? []) await insertRows(client, c.table, items.flatMap(c.rows), c.json);
  }
  await writeSettings(client, db.settings);
  await client.query("SELECT set_config('covenant.seeding', 'off', true)");
}

/** Write the difference between two versions of the database. Returns the number of rows touched. */
export async function saveDiff(client: Client, before: DB, after: DB): Promise<number> {
  let touched = 0;
  // Deletes run children-first and in reverse table order; inserts and updates parents-first.
  for (const x of [...ALL].reverse()) {
    const keep = new Set((after[x.key] as Item<Collection>[]).map((e) => e.id));
    const gone = (before[x.key] as Item<Collection>[]).filter((e) => !keep.has(e.id)).map((e) => e.id);
    if (gone.length === 0) continue;
    for (const c of x.children ?? []) await client.query(`DELETE FROM ${c.table} WHERE ${c.fk} = ANY($1)`, [gone]);
    await client.query(`DELETE FROM ${x.table} WHERE id = ANY($1)`, [gone]);
    touched += gone.length;
  }
  for (const x of ALL) {
    const prev = new Map((before[x.key] as Item<Collection>[]).map((e) => [e.id, e]));
    const added: Item<Collection>[] = [];
    for (const e of after[x.key] as Item<Collection>[]) {
      const old = prev.get(e.id);
      if (!old) { added.push(e); continue; }
      if (old === e) continue;
      const row = x.toRow(e);
      if (!same(x.toRow(old), row)) { await updateRow(client, x.table, row, x.json); touched++; }
      for (const c of x.children ?? []) {
        const rows = c.rows(e);
        if (same(c.rows(old), rows)) continue;
        await client.query(`DELETE FROM ${c.table} WHERE ${c.fk} = $1`, [e.id]);
        await insertRows(client, c.table, rows, c.json);
        touched++;
      }
    }
    await insertRows(client, x.table, added.map(x.toRow), x.json);
    for (const c of x.children ?? []) await insertRows(client, c.table, added.flatMap(c.rows), c.json);
    touched += added.length;
  }
  if (!same(before.settings, after.settings)) { await writeSettings(client, after.settings); touched++; }
  return touched;
}
