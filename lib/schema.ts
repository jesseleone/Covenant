import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ROLES = ["analyst", "associate", "vp", "md", "ic_member", "compliance"] as const;
export const STAGES = ["sourced", "screening", "term_sheet", "diligence", "ic", "documentation", "closed"] as const;
export const DEAL_STATUSES = ["active", "passed", "lost", "on_hold", "closed"] as const;
export const PASS_REASONS = ["pricing", "structure", "credit_quality", "sponsor", "sector", "lost_to_competitor", "other"] as const;
export const STRATEGIES = ["cash_flow", "abl", "nav", "special_sits"] as const;
export const DEAL_TYPES = ["lbo", "add_on", "refi", "recap", "growth"] as const;
export const COMPANY_TYPES = ["borrower", "sponsor", "lender", "advisor", "law_firm", "qoe_provider", "agent"] as const;
export const PERSON_TYPES = ["management", "sponsor", "banker", "advisor", "lender", "internal"] as const;
export const STAKEHOLDER_SIDES = ["internal", "borrower", "sponsor", "lender", "advisor"] as const;
export const NOTE_TYPES = ["meeting", "call", "screening", "ic", "general"] as const;
export const DOC_TYPES = ["cim", "qoe", "model", "term_sheet", "credit_agreement", "other"] as const;
export const FIELD_UNITS = ["usd_m", "pct", "x", "text", "count"] as const;
export const FIELD_STATUSES = ["proposed", "confirmed", "corrected"] as const;
export const PERIOD_CASES = ["actual", "sponsor", "lender_base", "downside"] as const;
export const TERM_SET_LABELS = ["proposal", "term_sheet", "ic_approved", "closing"] as const;
export const TERM_SET_STATUSES = ["draft", "issued", "locked"] as const;
export const INSTRUMENTS = ["term_loan", "ddtl", "revolver", "second_lien", "mezz"] as const;
export const LIEN_RANKS = ["1L", "1L_FO", "1L_LO", "2L", "unsecured"] as const;
export const COVENANT_METRICS = ["total_leverage", "interest_coverage", "min_liquidity"] as const;
export const WORKSTREAMS = ["qoe", "commercial", "legal", "tax", "insurance", "environmental", "it", "background", "kyc", "collateral"] as const;
export const SEVERITIES = ["red_flag", "high", "medium", "low"] as const;
export const DD_STATUSES = ["open", "received", "mitigated", "accepted", "closed"] as const;
export const MEMO_TYPES = ["screening", "dd_update", "final", "closing"] as const;
export const MEMO_STATUSES = ["draft", "ready_for_ic", "final"] as const;
export const IC_DECISIONS = ["approve", "approve_with_conditions", "defer", "decline"] as const;
export const IC_VOTES = ["approve", "approve_with_conditions", "decline", "abstain"] as const;
export const CONDITION_TYPES = ["pre_close", "post_close", "terms"] as const;
export const CONDITION_STATUSES = ["proposed", "open", "satisfied"] as const;
export const ENTITY_TYPES = ["deal", "company", "person"] as const;

export type Role = (typeof ROLES)[number];
export type Stage = (typeof STAGES)[number];
export type DealStatus = (typeof DEAL_STATUSES)[number];
export type PassReason = (typeof PASS_REASONS)[number];
export type Strategy = (typeof STRATEGIES)[number];
export type EntityType = (typeof ENTITY_TYPES)[number];

const id = z.string().min(1);
const iso = z.string().min(4);
const entityRef = z.object({ type: z.enum(ENTITY_TYPES), id });

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export const UserSchema = z.object({
  id, name: z.string(), email: z.string(), role: z.enum(ROLES), title: z.string(), initials: z.string(),
});

export const CompanySchema = z.object({
  id, name: z.string(), aliases: z.array(z.string()), domain: z.string().optional(),
  types: z.array(z.enum(COMPANY_TYPES)).min(1), sector: z.string().optional(), hqCountry: z.string().optional(),
  hqCity: z.string().optional(), description: z.string().optional(), ownerUserId: id.optional(), createdAt: iso,
});

export const PersonSchema = z.object({
  id, fullName: z.string(), email: z.string().optional(), phone: z.string().optional(),
  personType: z.enum(PERSON_TYPES), relationshipOwnerId: id.optional(), bio: z.string().optional(), createdAt: iso,
});

export const AffiliationSchema = z.object({
  id, personId: id, companyId: id, title: z.string(), startDate: iso.optional(), endDate: iso.optional(), isCurrent: z.boolean(),
});

export const DealSchema = z.object({
  id, name: z.string(), codename: z.string(), borrowerCompanyId: id, sponsorCompanyId: id.optional(),
  strategy: z.enum(STRATEGIES), dealType: z.enum(DEAL_TYPES), stage: z.enum(STAGES), status: z.enum(DEAL_STATUSES),
  passReason: z.enum(PASS_REASONS).optional(), passNote: z.string().optional(),
  requestedSize: z.number(), fundHoldTarget: z.number(), expectedClose: iso.optional(), closedAt: iso.optional(),
  leadUserId: id, teamUserIds: z.array(id),
  riskRating: z.object({ value: z.number(), scale: z.literal("1-5 (1=best)") }).optional(),
  summary: z.string().optional(), thesis: z.string().optional(), tags: z.array(z.string()), sectorTags: z.array(z.string()),
  sector: z.string(), createdAt: iso, stageEnteredAt: iso,
});

export const StakeholderSchema = z.object({
  id, dealId: id, personId: id.optional(), companyId: id.optional(), role: z.string(), side: z.enum(STAKEHOLDER_SIDES),
});

export const StageEventSchema = z.object({
  id, dealId: id, from: z.enum(STAGES).nullable(), to: z.enum(STAGES), userId: id, at: iso, overrideReason: z.string().optional(),
});

export const NoteSchema = z.object({
  id, subject: entityRef, body: z.string(), noteType: z.enum(NOTE_TYPES), authorId: id, pinned: z.boolean(),
  mentions: z.array(entityRef), createdAt: iso,
});

export const DocumentSchema = z.object({
  id, dealId: id, docType: z.enum(DOC_TYPES), title: z.string(), version: z.number(),
  source: z.enum(["upload", "vdr", "email"]), pages: z.array(z.object({ n: z.number(), markdown: z.string() })),
  extractionStatus: z.enum(["none", "done"]), uploadedAt: iso,
});

export const ExtractedFieldSchema = z.object({
  id, dealId: id, documentId: id, page: z.number(), quote: z.string(), fieldKey: z.string(), label: z.string(),
  value: z.union([z.number(), z.string()]), unit: z.enum(FIELD_UNITS), period: z.string().optional(),
  confidence: z.number().min(0).max(1), status: z.enum(FIELD_STATUSES),
  correctedFrom: z.object({ value: z.union([z.number(), z.string()]), documentId: id, page: z.number() }).optional(),
  reviewedBy: id.optional(), reviewedAt: iso.optional(),
});

export const FinancialPeriodSchema = z.object({
  id, dealId: id, companyId: id, label: z.string(), periodEnd: iso, periodType: z.enum(["FY", "LTM"]),
  case: z.enum(PERIOD_CASES), revenue: z.number(), adjEbitdaFieldKey: z.string().optional(), adjEbitda: z.number(),
  capex: z.number(), interest: z.number().optional(),
});

export const TermSetSchema = z.object({
  id, dealId: id, version: z.number(), label: z.enum(TERM_SET_LABELS), status: z.enum(TERM_SET_STATUSES),
  parentId: id.optional(), createdBy: id, createdAt: iso, lockedByIcEventId: id.optional(), note: z.string().optional(),
});

export const TrancheSchema = z.object({
  id, termSetId: id, key: z.string(), name: z.string(), instrument: z.enum(INSTRUMENTS), lienRank: z.enum(LIEN_RANKS),
  commitment: z.number(), fundedAtClose: z.number(), fundHold: z.number(), baseRate: z.literal("SOFR"),
  spreadBps: z.number(), floorBps: z.number(), oidPct: z.number(), pikBps: z.number(), callProtection: z.string(),
  maturityDate: iso, amortPctPerYear: z.number(),
});

export const CovenantSchema = z.object({
  id, termSetId: id, metric: z.enum(COVENANT_METRICS), operator: z.enum(["max", "min"]),
  levels: z.array(z.object({ from: iso, level: z.number() })).min(1), testFrequency: z.literal("quarterly"), notes: z.string().optional(),
});

export const DDItemSchema = z.object({
  id, dealId: id, workstream: z.enum(WORKSTREAMS), kind: z.enum(["request", "finding"]), title: z.string(), detail: z.string(),
  severity: z.enum(SEVERITIES).optional(), status: z.enum(DD_STATUSES), mitigant: z.string().optional(),
  memoSectionKey: z.string().optional(), icConditionId: id.optional(), ownerUserId: id.optional(), dueDate: iso.optional(),
});

export const MemoSchema = z.object({
  id, dealId: id, memoType: z.enum(MEMO_TYPES), version: z.number(), status: z.enum(MEMO_STATUSES), termSetId: id, createdAt: iso,
});

export const MemoSectionSchema = z.object({
  id, memoId: id, key: z.string(), title: z.string(), order: z.number(), content: z.string(),
  dependencies: z.array(z.string()), snapshot: z.record(z.string(), z.string()),
  generatedBy: z.enum(["ai", "human", "ai_offline"]), reviewedBy: id.optional(), reviewedAt: iso.optional(), updatedAt: iso,
});

export const ICEventSchema = z.object({
  id, dealId: id, stage: z.enum(["screening", "final"]), date: iso, memoId: id.optional(), termSetId: id.optional(),
  status: z.enum(["pending", "decided"]), decision: z.enum(IC_DECISIONS).optional(),
  votes: z.array(z.object({ userId: id, vote: z.enum(IC_VOTES), comment: z.string().optional() })),
  qa: z.array(z.object({ question: z.string(), askedBy: id, answer: z.string().optional() })),
  approvedHold: z.number().optional(), decidedAt: iso.optional(),
});

export const ICConditionSchema = z.object({
  id, dealId: id, icEventId: id.optional(), description: z.string(), type: z.enum(CONDITION_TYPES), ownerUserId: id,
  dueDate: iso.optional(), status: z.enum(CONDITION_STATUSES), sourceDdItemId: id.optional(),
});

export const DevilsAdvocateSchema = z.object({
  id, dealId: id, question: z.string(), rationale: z.string(), precedentDealIds: z.array(id),
});

export const ChatThreadSchema = z.object({ id, title: z.string(), ownerId: id, createdAt: iso, scope: z.array(entityRef).optional() });

export const ChatMessageSchema = z.object({
  id, threadId: id, role: z.enum(["user", "assistant"]), content: z.string(),
  toolCalls: z.array(z.object({ name: z.string(), input: z.unknown(), resultSummary: z.string(), rowCount: z.number() })).optional(),
  mode: z.enum(["live", "offline"]).optional(), createdAt: iso,
});

export const AuditEventSchema = z.object({
  id, actorId: id, action: z.string(), entity: z.object({ type: z.string(), id }), dealId: id.optional(),
  field: z.string().optional(), before: z.string().optional(), after: z.string().optional(), at: iso, summary: z.string(),
});

export const SettingsSchema = z.object({ coverageCushionGuidelinePct: z.number(), today: iso });

export const DBSchema = z.object({
  users: z.array(UserSchema),
  companies: z.array(CompanySchema),
  people: z.array(PersonSchema),
  affiliations: z.array(AffiliationSchema),
  deals: z.array(DealSchema),
  stakeholders: z.array(StakeholderSchema),
  stageEvents: z.array(StageEventSchema),
  notes: z.array(NoteSchema),
  documents: z.array(DocumentSchema),
  extractedFields: z.array(ExtractedFieldSchema),
  financialPeriods: z.array(FinancialPeriodSchema),
  termSets: z.array(TermSetSchema),
  tranches: z.array(TrancheSchema),
  covenants: z.array(CovenantSchema),
  ddItems: z.array(DDItemSchema),
  memos: z.array(MemoSchema),
  memoSections: z.array(MemoSectionSchema),
  icEvents: z.array(ICEventSchema),
  icConditions: z.array(ICConditionSchema),
  devilsAdvocate: z.array(DevilsAdvocateSchema),
  chatThreads: z.array(ChatThreadSchema),
  chatMessages: z.array(ChatMessageSchema),
  auditEvents: z.array(AuditEventSchema),
  settings: SettingsSchema,
});

export type User = z.infer<typeof UserSchema>;
export type Company = z.infer<typeof CompanySchema>;
export type Person = z.infer<typeof PersonSchema>;
export type Affiliation = z.infer<typeof AffiliationSchema>;
export type Deal = z.infer<typeof DealSchema>;
export type Stakeholder = z.infer<typeof StakeholderSchema>;
export type StageEvent = z.infer<typeof StageEventSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type Doc = z.infer<typeof DocumentSchema>;
export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;
export type FinancialPeriod = z.infer<typeof FinancialPeriodSchema>;
export type TermSet = z.infer<typeof TermSetSchema>;
export type Tranche = z.infer<typeof TrancheSchema>;
export type Covenant = z.infer<typeof CovenantSchema>;
export type DDItem = z.infer<typeof DDItemSchema>;
export type Memo = z.infer<typeof MemoSchema>;
export type MemoSection = z.infer<typeof MemoSectionSchema>;
export type ICEvent = z.infer<typeof ICEventSchema>;
export type ICCondition = z.infer<typeof ICConditionSchema>;
export type DevilsAdvocate = z.infer<typeof DevilsAdvocateSchema>;
export type ChatThread = z.infer<typeof ChatThreadSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type DB = z.infer<typeof DBSchema>;

// ---------------------------------------------------------------------------
// Display labels
// ---------------------------------------------------------------------------

export const STAGE_LABELS: Record<Stage, string> = {
  sourced: "Sourced", screening: "Screening", term_sheet: "Term Sheet", diligence: "Diligence",
  ic: "IC", documentation: "Documentation", closed: "Closed",
};
export const STRATEGY_LABELS: Record<Strategy, string> = {
  cash_flow: "Cash-flow DL", abl: "ABL / ABF", nav: "NAV", special_sits: "Special sits",
};
export const PASS_REASON_LABELS: Record<PassReason, string> = {
  pricing: "Pricing", structure: "Structure", credit_quality: "Credit quality", sponsor: "Sponsor",
  sector: "Sector", lost_to_competitor: "Lost to competitor", other: "Other",
};
export const NOTE_LABELS: Record<(typeof NOTE_TYPES)[number], string> = {
  meeting: "meeting", call: "call", screening: "screening", ic: "IC prep", general: "general",
};
export const ROLE_LABELS: Record<Role, string> = {
  analyst: "Analyst", associate: "Associate", vp: "VP", md: "MD", ic_member: "IC member", compliance: "Compliance",
};
