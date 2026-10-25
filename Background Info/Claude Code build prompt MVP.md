# One-shot build prompt: "Covenant" private credit underwriting workspace (MVP)

> Paste everything below the line into Claude Code, in an empty folder. It is self-contained. It assumes Node 20+ and npm. An Anthropic API key is optional: without one, chat and memo regeneration run in a deterministic offline mode.

---

You are building a complete, working **local web app** called **Covenant**: an underwriting workspace for the deal team of a private credit fund. It is a demo prototype that will be shown to an investment team with both technical and non-technical members. It must run with `npm install && npm run dev` and work end to end in the browser with no external services. The only optional service is the Anthropic API, for chat.

Work autonomously. Make reasonable decisions without asking. Build in the order given in §14, so the app can be demonstrated at each stage. Do not stop until every item in the acceptance checklist (§15) passes.

## 1. Product summary

- The fund is **Fernhill Credit Partners** (fictional). All companies and people in the seed data are fictional.
- **Core records:** Deals, Companies, People.
- **Underwriting depth lives on the deal:** extracted financials with human confirmation, versioned terms (the "securities"), due diligence, the IC memo, and IC approval.
- **Chat** answers questions across the whole database using typed query tools.

**Key principles. These must be visible in the product:**
1. **AI proposes, a person confirms.** Every extracted value has a confidence score, a source page and a review status.
2. **One source of truth.** Every number shown in the header, the memo or chat is *computed* from records (confirmed fields, the term set). Numbers are never typed into prose. Changing a source value updates everything that uses it, and flags memo sections that depend on it as **stale**.
3. **Lineage.** Every number in a memo or chat answer carries a citation chip that links to its source: a record, tab or document page.
4. **Versioned terms.** The term set is copy-on-write. An IC approval locks it.
5. **Audit.** Every write produces an AuditEvent, which is what the History tab shows.

## 2. Tech stack and constraints

- **Next.js** (latest stable, App Router), **TypeScript strict**, **Tailwind CSS v4**, **shadcn/ui** (Radix primitives), **lucide-react** icons.
- **Libraries:**
  - **State and persistence:** Zustand with `persist` to localStorage (key `covenant-db-v1`). This is the in-browser database.
  - **UI behavior:** `@dnd-kit/core` and `@dnd-kit/sortable` for the kanban board; `@tanstack/react-table` for lists; `cmdk` for the command palette; `fuse.js` for fuzzy search and duplicate detection.
  - **Content and utilities:** `react-markdown` + `remark-gfm` for chat and memo rendering; `zod` for runtime validation of seed data and forms; `date-fns`; `nanoid`.
  - **API and testing:** `@anthropic-ai/sdk` (server only); `vitest` + `@testing-library/react` for tests.
- **Fonts** via `next/font/google`: **Inter** (UI sans), **Source Serif 4** (serif for headings, memo body and assistant chat text), **JetBrains Mono** (code and the tool-call trace).
- **Server code is limited to one route:** `app/api/llm/route.ts`. It is a thin proxy to the Anthropic Messages API. It holds no data. If `ANTHROPIC_API_KEY` is missing it returns HTTP 503 `{ error: "no_key" }`. The model comes from `ANTHROPIC_MODEL`, defaulting to `claude-sonnet-5-5`.
- Provide `.env.example` containing `ANTHROPIC_API_KEY=` and `ANTHROPIC_MODEL=claude-sonnet-5-5`.
- No database server, no auth provider, no other network calls, and no analytics.
- The primary layout target is desktop at 1280px or wider. It must remain usable at 1024px.

## 3. Visual design: a claude.ai-inspired style

Recreate the *feel* of the claude.ai web app: warm neutrals, calm density, a serif for reading and a sans for UI, a single terracotta accent, generous spacing, flat surfaces with hairline borders and whisper-soft shadows. **Do not use Anthropic or Claude logos, the spark mark, wordmarks or product names in the UI.** The app is "Covenant", with a simple monogram (a rounded square containing a serif "C").

Define these tokens as CSS variables in `globals.css` and map them into the Tailwind theme. Support light and dark modes (`class="dark"`), with a toggle in the user menu that defaults to the system setting.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FAF9F5` | `#262624` | Main canvas |
| `--sidebar` | `#F5F4ED` | `#1F1E1D` | Left nav, chat thread list |
| `--surface` | `#FFFFFF` | `#30302E` | Cards, modals, inputs, table rows |
| `--surface-2` | `#F0EEE6` | `#3A3936` | Hover rows, user chat bubble, secondary buttons |
| `--border` | `#E8E6DC` | `#3E3D39` | 1px hairlines |
| `--border-strong` | `#D1CFC5` | `#52514C` | Input borders, focus-adjacent |
| `--text` | `#141413` | `#FAF9F5` | Primary text |
| `--text-2` | `#5E5D59` | `#C2C0B6` | Secondary text |
| `--text-3` | `#87867F` | `#9A9890` | Metadata and labels |
| `--accent` | `#C96442` | `#D97757` | Primary buttons, active nav marker, links, the "New" button |
| `--accent-soft` | `#F5E6DF` | `#4A2F25` | Accent backgrounds (selected chip) |
| `--success` | `#3F7D4E` | `#7FB98C` | Confirmed, approved |
| `--warn` | `#B7791F` | `#E0B36A` | Needs review, stale, cushion below guideline |
| `--danger` | `#B53333` | `#E07A7A` | Red flags, declined |
| `--focus` | `#3898EC` | `#3898EC` | Focus ring only |

**Type and shape rules:**
- **Type:**
  - Page titles and record names use Source Serif 4 at weight 500, 26–32px.
  - Section headings use the serif at 18–20px.
  - UI and body text use Inter at 14px, line-height 1.55. Labels are 12px `--text-3`.
  - Memo body and assistant chat messages use the serif at 16px, line-height 1.65.
- **Radius:** 8px for buttons and chips; 12px for inputs, cards and menus; 16px for modals; 20px for the chat composer; pill (9999px) for status chips.
- **Shadows:** cards have none (border only). Popovers and modals use `0 4px 24px rgba(0,0,0,0.06)`. The chat composer uses `0 2px 12px rgba(0,0,0,0.05)`.
- **Left nav:**
  - 260px wide, `--sidebar` background, collapsible to 64px.
  - Items are 36px tall with an icon and label. The active item gets a `--surface-2` background and a 2px accent marker on the left.
  - "New" is a full-width accent button with a "+" icon.
- **Top bar:** 56px, `--bg` background, 1px bottom border. The search field is centered, about 520px wide, 12px radius, with a `⌘K` hint. The user avatar menu is on the right.
- **Chat:**
  - Centered column, max width 760px.
  - User messages sit in a `--surface-2` bubble (18px radius), right-aligned, max width 85%.
  - Assistant messages are plain serif text with no bubble.
  - The composer is pinned to the bottom: a large rounded `--surface` box with a hairline border and a soft shadow. It has a textarea that grows to 8 lines, a round accent send button, and an "@" mention trigger.
  - Empty state: a large serif greeting ("Good afternoon, Jordan"; choose the greeting from the local time) with 4–5 suggested-prompt cards.
- **Status chips** (pill, 12px text, soft tinted background):
  - *Proposed* is amber; *Confirmed* is green; *Corrected* is green with a pencil icon.
  - *Stale* is amber; *Red flag* is red.
  - Stages use neutral chips.
- **Citation chips:** inline pill, `--surface-2` background, 11px mono text such as `CIM p.5` or `Term set v2`. Hovering shows a preview; clicking navigates.
- **Motion:** subtle 120–180ms transitions. No gradients, no heavy color blocks, no emoji in the UI.

## 4. Architecture and folder structure

```
app/
  layout.tsx                 # fonts, ThemeProvider, AppShell (only once authenticated)
  login/page.tsx
  page.tsx                   # redirect → /deals
  chat/page.tsx, chat/[threadId]/page.tsx
  deals/page.tsx             # ?view=list|pipeline
  deals/[dealId]/[[...tab]]/page.tsx   # tab defaults to overview
  companies/page.tsx, companies/[companyId]/[[...tab]]/page.tsx
  people/page.tsx, people/[personId]/[[...tab]]/page.tsx
  api/llm/route.ts           # Anthropic proxy only
components/
  shell/ (TopBar, LeftNav, NewMenu, UserMenu, CommandPalette, AuthGuard)
  modals/ (NewDealModal, NewCompanyModal, NewPersonModal, GateModal, PassReasonModal, ConfirmModal)
  deals/ (DealsTable, PipelineBoard, DealCard, DealHeader, tabs/*)
  companies/, people/, chat/, memo/, common/ (CitationChip, StatusChip, MetricTile, RichText, EmptyState, DiffTable, DocViewer)
lib/
  schema.ts       # TS types + zod schemas for every entity
  seed/           # seed data split by entity; seed/index.ts exports buildSeed()
  store.ts        # Zustand store: db state + ACTIONS (the ontology actions); every action writes an AuditEvent
  selectors.ts    # derived metrics: leverage, cushion, active term set, stale detection, relationship strength
  gates.ts        # stage gate rules
  permissions.ts  # role → allowed actions
  queries.ts      # typed read functions over the store (used by UI, chat tools and offline chat)
  llm/
    tools.ts      # tool definitions (JSON schema) mapping 1:1 to queries.ts
    agent.ts      # client-side tool-use loop
    prompts.ts    # system prompts (chat, memo section regeneration, devil's advocate)
    offline.ts    # deterministic fallback answers built from queries.ts
  render/
    tokens.ts     # parse {{metric:…}} and [[cite:…]] tokens in memo and chat text
  format.ts       # $, x, %, bps, dates
docs/
  SYSTEM.md       # 1–2 page system explanation (see §13)
  schema.sql      # Postgres DDL equivalent of lib/schema.ts (documentation for the technical audience)
README.md
```

**How chat works with browser-local data:** the client sends the conversation to `/api/llm`, which forwards it to Anthropic with the tool definitions. When the response's `stop_reason` is `tool_use`, the **client** runs each tool with `queries.ts` against the local store, appends a `tool_result`, and calls the route again. It repeats up to 8 iterations. In production the same tools become an MCP server over Postgres; state this in SYSTEM.md. If the route returns 503, or the request fails, use `offline.ts` instead.

## 5. Data model (`lib/schema.ts`)

All IDs are strings with prefixes (`deal_…`, `co_…`, `per_…`). Records generated in seed data use readable slugs (e.g. `deal_larch`). Timestamps are ISO strings.

- **User** `{id, name, email, role: 'analyst'|'associate'|'vp'|'md'|'ic_member'|'compliance', title, initials}`
- **Company** `{id, name, aliases: string[], domain?, types: ('borrower'|'sponsor'|'lender'|'advisor'|'law_firm'|'qoe_provider'|'agent')[], sector?, hqCountry?, description?, ownerUserId?, createdAt}`
- **Person** `{id, fullName, email?, phone?, personType: 'management'|'sponsor'|'banker'|'advisor'|'lender'|'internal', relationshipOwnerId?, bio?, createdAt}`
- **Affiliation** `{id, personId, companyId, title, startDate?, endDate?, isCurrent}`
- **Deal** `{id, name, codename, borrowerCompanyId, sponsorCompanyId?, strategy: 'cash_flow'|'abl'|'nav'|'special_sits', dealType: 'lbo'|'add_on'|'refi'|'recap'|'growth', stage: Stage, status: 'active'|'passed'|'lost'|'on_hold'|'closed', passReason?: PassReason, passNote?, requestedSize, fundHoldTarget, expectedClose?, closedAt?, leadUserId, teamUserIds: string[], riskRating?: {value:number, scale:'1-5 (1=best)'}, summary?, thesis?, tags: string[], sectorTags: string[], createdAt, stageEnteredAt}`
  - `Stage = 'sourced'|'screening'|'term_sheet'|'diligence'|'ic'|'documentation'|'closed'`
  - `PassReason = 'pricing'|'structure'|'credit_quality'|'sponsor'|'sector'|'lost_to_competitor'|'other'`
- **Stakeholder** `{id, dealId, personId?, companyId?, role: string, side: 'internal'|'borrower'|'sponsor'|'lender'|'advisor'}`
- **StageEvent** `{id, dealId, from, to, userId, at, overrideReason?}`
- **Note** `{id, subject: {type:'deal'|'company'|'person', id}, body (markdown), noteType: 'meeting'|'call'|'screening'|'ic'|'general', authorId, pinned, mentions: {type,id}[], createdAt}`
- **Document** `{id, dealId, docType: 'cim'|'qoe'|'model'|'term_sheet'|'credit_agreement'|'other', title, version, source: 'upload'|'vdr'|'email', pages: {n:number, markdown:string}[], extractionStatus: 'none'|'done', uploadedAt}`
- **ExtractedField** `{id, dealId, documentId, page, quote, fieldKey, label, value: number|string, unit: 'usd_m'|'pct'|'x'|'text'|'count', period?, confidence: number, status: 'proposed'|'confirmed'|'corrected', correctedFrom?: {value, documentId, page}, reviewedBy?, reviewedAt?}`
- **FinancialPeriod** `{id, dealId, companyId, label, periodEnd, periodType: 'FY'|'LTM', case: 'actual'|'sponsor'|'lender_base'|'downside', revenue, adjEbitdaFieldKey?, adjEbitda, capex, interest?}`. LTM adjusted EBITDA must be read through the ExtractedField `adj_ebitda_ltm`, never duplicated.
- **TermSet** `{id, dealId, version, label: 'proposal'|'term_sheet'|'ic_approved'|'closing', status: 'draft'|'issued'|'locked', parentId?, createdBy, createdAt, lockedByIcEventId?}`
- **Tranche** `{id, termSetId, name, instrument: 'term_loan'|'ddtl'|'revolver'|'second_lien'|'mezz', lienRank: '1L'|'1L_FO'|'1L_LO'|'2L'|'unsecured', commitment, fundedAtClose, fundHold, baseRate: 'SOFR', spreadBps, floorBps, oidPct, pikBps, callProtection: string, maturityDate, amortPctPerYear}`
- **Covenant** `{id, termSetId, metric: 'total_leverage'|'interest_coverage'|'min_liquidity', operator: 'max'|'min', levels: {from: string, level: number}[], testFrequency: 'quarterly', notes?}`
- **DDItem** `{id, dealId, workstream: 'qoe'|'commercial'|'legal'|'tax'|'insurance'|'environmental'|'it'|'background'|'kyc'|'collateral', kind: 'request'|'finding', title, detail, severity?: 'red_flag'|'high'|'medium'|'low', status: 'open'|'received'|'mitigated'|'accepted'|'closed', mitigant?, memoSectionKey?, icConditionId?, ownerUserId?, dueDate?}`
- **Memo** `{id, dealId, memoType: 'screening'|'dd_update'|'final'|'closing', version, status: 'draft'|'ready_for_ic'|'final', termSetId, createdAt}`
- **MemoSection** `{id, memoId, key, title, order, content (markdown with tokens), dependencies: string[], snapshot: Record<string,string>, generatedBy: 'ai'|'human'|'ai_offline', reviewedBy?, reviewedAt?, updatedAt}`
- **ICEvent** `{id, dealId, stage: 'screening'|'final', date, memoId?, termSetId?, status: 'pending'|'decided', decision?: 'approve'|'approve_with_conditions'|'defer'|'decline', votes: {userId, vote: 'approve'|'approve_with_conditions'|'decline'|'abstain', comment?}[], qa: {question, askedBy, answer?}[], approvedHold?, decidedAt?}`
- **ICCondition** `{id, dealId, icEventId?, description, type: 'pre_close'|'post_close'|'terms', ownerUserId, dueDate?, status: 'proposed'|'open'|'satisfied', sourceDdItemId?}`
- **DevilsAdvocate** `{id, dealId, question, rationale, precedentDealIds: string[]}`
- **ChatThread** `{id, title, ownerId, createdAt}` and **ChatMessage** `{id, threadId, role: 'user'|'assistant', content, toolCalls?: {name, input, resultSummary, rowCount}[], mode?: 'live'|'offline', createdAt}`
- **AuditEvent** `{id, actorId, action, entity: {type,id}, dealId?, field?, before?, after?, at, summary}`
- **Settings** `{coverageCushionGuidelinePct: 25, today: '2026-10-25'}`

**Derived values (`selectors.ts`, all pure and unit tested):**
- `fieldValue(dealId, key)` returns the value and status of the corrected or confirmed field. If the field is only proposed, it returns that value with an "unconfirmed" flag.
- `activeTermSet(dealId)` returns the highest version. `approvedTermSet(dealId)` returns the locked `ic_approved` version.
- `totalLeverage(dealId, termSetId?)` = Σ `fundedAtClose` of tranches ÷ `fieldValue(adj_ebitda_ltm)`.
- `currentCovenantLevel(covenant, asOf)` returns the level in force on that date.
- `cushionPct` = 1 − leverage ÷ covenant level. It is flagged warn when below `Settings.coverageCushionGuidelinePct`.
- `sectionIsStale(section)`: compare `section.snapshot` with the current values of `section.dependencies`. Dependency keys look like `field:adj_ebitda_ltm`, `termset:active`, `covenant:total_leverage`, `dd:red_flags`, and each serializes to a stable string. The section is stale if any differ.
- `relationshipStrength(personId)` returns strong, medium or weak, based on the count and recency of notes and stakeholder roles.

## 6. Seed data (`lib/seed`): realistic, internally consistent

Validate the whole seed with zod at load time. Provide **Reset demo data** in the user menu, with a confirmation step; it rebuilds the store from `buildSeed()`.

**Users (Fernhill)**

| Name | Role and title |
|---|---|
| Jordan Reyes | analyst |
| Sam Patel | associate |
| Marcus Chen | vp |
| Elena Duarte | md |
| Robert Hale | ic_member, CIO and IC chair |
| Aisha Okafor | ic_member, CRO |

**Companies (about 25)**
- **Borrowers:** one per deal below.
- **Sponsors:** Ashby Hill Partners, Corrigan Bay Capital, Westmere Equity, Pallister Group, Stonecrop Partners.
- **Advisors:**
  - Halvorsen & Co. (investment bank)
  - Brightline Advisory (QoE provider)
  - Pell & Marsh LLP (lender counsel)
  - Darrow Kline LLP (borrower counsel)
  - Keystone Agency Services (agent)
- **Fernhill Credit Partners** itself (type lender).
- **Wren Industrial Svcs.** (a borrower with no deal yet; aliases "Wren Industrial", "Wren Services"). This exists for the duplicate-check demo.

**People (about 40)**, each with affiliations and with role history for at least 5 people. Required:
- Larch CEO **Dana Whitfield**.
- Larch CFO **Tom Brandt**: previously CFO of Tern Pest Control 2019–2023, so the role history connects to a precedent deal.
- Ashby Hill partner **Kevin Moreau** and VP **Lauren Ito**.
- Halvorsen MD **Michael Grant**: banker on Larch and on 3 other deals.
- Brightline partner **Rachel Soto**.
- Pell & Marsh partner **David Kim**.

**Deals (12).** Dates are relative to 2026-10-25. Each deal needs a term set (with at least v1), key extracted fields and a summary. Larch is complete; the rest are lighter.

| Deal | Borrower (sector) | Sponsor | Stage / status | Size $M | Lev. | Spread |
|---|---|---|---|---|---|---|
| **Project Larch** | Larch Mechanical Holdings (commercial HVAC & mechanical services) | Ashby Hill | diligence / active | 115 | 5.1x → 5.5x | S+525 |
| Project Osprey | Osprey Dental Partners (dental services) | Corrigan Bay | screening | 80 | 5.6x | S+575 |
| Project Quarry | Quarry Fleet Services (fleet maintenance) | Westmere | term_sheet | 140 | 4.9x | S+500 |
| Project Beacon | Beacon Pharmacy Solutions (pharmacy software, recurring revenue) | Stonecrop | ic | 175 | 6.2x | S+600 |
| Project Fjord | Fjord Logistics Software (supply-chain SaaS) | Pallister | sourced | 60 | n/a | S+650 (indicative) |
| Project Cinder | Cinder Fire & Safety (fire & life safety services) | Ashby Hill | documentation | 95 | 5.0x | S+500 |
| Project Alder | Alder Environmental (testing labs) | Westmere | closed 2025-11 | 110 | 4.8x | S+525 |
| Project Tern | Tern Pest Control (pest control services) | Corrigan Bay | closed 2024-06 | 70 | 5.2x | S+550 |
| Project Granite | Granite Roofing Group (commercial roofing) | Pallister | closed 2023-09; covenant reset amendment 2025-04 | 125 | 5.4x | S+575 |
| Project Vale | Vale Elevator Services (elevator maintenance) | Stonecrop | passed 2025-03, `lost_to_competitor` (cleared at S+475) | 90 | 5.3x | S+525 |
| Project Ember | Ember HVAC Group (residential HVAC) | Ashby Hill | passed 2024-10, `credit_quality` (top customer 31% of revenue) | 85 | 5.8x | S+575 |
| Project Juniper | Juniper Home Health (home health) | Corrigan Bay | passed 2026-02, `sector` (reimbursement risk) | 65 | 5.5x | S+600 |

Closed and passed deals carry ICEvents (decisions, 2–3 Q&A items each) so they work as precedents. Granite's Q&A should include a question about covenant cushion that later proved prescient.

**Project Larch (the fully built deal)**
- **Status:** expected close 2026-12-15. Lead is Marcus Chen. Team: Jordan, Sam, Marcus, Elena. Risk rating 2 on the "1-5 (1=best)" scale.
- **Screening ICEvent:** decided `approve` on 2026-09-18.
- **Transaction:** enterprise value $220M (12.6x CIM EBITDA). Sources: term loan $90M plus sponsor equity $136M. Uses: purchase $220M plus fees $6M.
- **TermSet v1** (`term_sheet`, status `issued`):
  - Term loan $90M (funded at close $90M)
  - DDTL $15M (funded $0, 24-month availability)
  - Revolver $10M (funded $0)
  - All tranches 1L, fund hold 100%, SOFR + 525, floor 75bps, OID 2.0%, call protection "102 / 101 / par", maturity 2032-12-15, amortization 1% per year
  - **Covenant:** maximum total leverage, tested quarterly. Levels: 7.00x from 2026-12-31, 6.50x from 2027-12-31, 6.00x from 2028-12-31.
- **Documents.** Write realistic markdown pages so the viewer looks real. The facts below must appear on these exact pages.
  - **CIM (12 pages)**

    | Page | Content |
    |---|---|
    | p.1 | Cover |
    | p.2 | Executive summary |
    | p.3 | Business overview: founded 1998, Columbus OH; 14 branches; 1,150 employees |
    | p.4 | Services and end markets: 68% recurring maintenance contracts |
    | p.5 | Customers: **top customer 22% of revenue**, top 10 customers 48%; top-customer master service agreement **renews December 2027** |
    | p.6 | Management: Dana Whitfield, CEO; Tom Brandt, CFO (ex-CFO, Tern Pest Control) |
    | p.7 | Historical financials table: revenue FY2024A $121.0M, FY2025A $134.0M, LTM Jun-26 $142.0M; adjusted EBITDA $14.2M / $16.4M / **$17.5M** |
    | p.8 | Adjusted EBITDA bridge: reported EBITDA $14.4M + owner compensation normalization $0.9M + one-time ERP costs $1.0M + **pricing initiatives run-rate $1.2M** = $17.5M |
    | p.9 | Capex and free cash flow: maintenance capex $2.1M |
    | p.10 | Growth and M&A pipeline |
    | p.11 | Transaction overview: EV $220M, sponsor Ashby Hill |
    | p.12 | Disclaimer |

  - **QoE summary from Brightline (3 pages):** p.2 shows **diligence-adjusted EBITDA of $16.3M**. It accepts the other add-backs and **rejects the $1.2M pricing run-rate** as not yet realized. p.3 covers net working capital.
  - **Term sheet (2 pages):** matches TermSet v1.
  - **Sponsor model summary (1 page).**
- **ExtractedFields (22).** Most are confirmed with confidence ≥ 0.9. These three are **proposed** with low confidence:
  - `adj_ebitda_ltm` = 17.5, CIM p.8, confidence 0.64
  - `top_customer_pct` = 22, CIM p.5, confidence 0.71
  - `maintenance_capex` = 2.1, CIM p.9, confidence 0.69

  The others include `revenue_ltm`, `revenue_fy24`, `revenue_fy25`, `adj_ebitda_fy24`, `adj_ebitda_fy25`, `top10_customer_pct`, `recurring_revenue_pct`, `employees`, `branches`, `founded`, `hq`, `ev`, `sponsor_equity`, `ceo`, `cfo`, `msa_renewal_date` and `addback_total`. Each one stores the verbatim `quote` that appears on its page.
- **FinancialPeriods:** FY2024A, FY2025A and LTM Jun-26 (actual), plus a lender base case and a downside case for FY2027E (downside: EBITDA −20%).
- **DDItems (10):**
  - **QoE finding** (high): "$1.2M pricing run-rate add-back rejected by QoE", status open.
  - **Commercial finding** (**red_flag**): "Top customer 22% of revenue; MSA renews Dec-2027 (~14 months)", no mitigant yet.
  - Legal: minor litigation (low, accepted).
  - Insurance review (closed).
  - Environmental Phase I clean (closed).
  - KYC: borrower and sponsor cleared (closed).
  - Background checks on management (closed).
  - Requests open for IT security and tax structure.
  - Field: lien search requested.
- **Memo `final` v1:** status `draft`, linked to TermSet v1. **8 sections**: Executive Summary, Investment Thesis, Company Overview, Financial Analysis, Structure & Terms, Key Risks & Mitigants, Diligence Status, Recommendation. Write a full credit-memo voice of 120–250 words per section.
  - **Use tokens instead of typed numbers.** `{{metric:total_leverage}}`, `{{metric:cushion_pct}}`, `{{field:adj_ebitda_ltm}}`, `{{field:revenue_ltm}}`, `{{tranche:tl.spread}}`, `{{covenant:total_leverage.current}}`, and so on. Add explicit `[[cite:document:doc_larch_cim#p5|CIM p.5]]` chips where the narrative cites a page.
  - Set `dependencies` per section and compute `snapshot` at seed time, so nothing is stale at the start.
- **DevilsAdvocate (3 questions), each linked to precedents:**
  1. "If the top customer does not renew in Dec-2027, what is pro forma leverage and covenant headroom?" (links Ember)
  2. "Granite needed a covenant reset 18 months after close at a similar cushion. Why is Larch different?" (links Granite)
  3. "How much of the add-back bridge is realized versus run-rate, and what does the QoE support?" (links Tern)
- **Notes:** 5 notes (screening call, management meeting, sponsor call, QoE readout, IC prep), with @mentions.
- **History:** StageEvents from sourced to diligence, with plausible dates since 2026-08-20.

**Seed also:** 2 chat threads with prior Q&A, and AuditEvents for the seeded history.

## 7. Shell, auth, search, New

- **Auth (mock):** `/login` has an email field, a password field, and "Sign in" (any password works for a seeded email). It also offers quick-pick buttons for the 4 demo personas: Analyst Jordan, VP Marcus, MD Elena, IC Robert.
  - The session is stored in localStorage. `AuthGuard` redirects unauthenticated users to `/login`.
  - The user menu shows name and role, a **"Switch persona"** submenu, theme toggle, Reset demo data, and Sign out.
- **Permissions (`permissions.ts`), enforced in the UI and in store actions** (a disallowed action shows a toast and makes no change):

  | Role | May |
  |---|---|
  | analyst / associate | Create records; confirm or correct fields; notes; DD items; memo drafting and regeneration; move stages except into ic or documentation |
  | vp / md | Everything above, plus create and issue term-set versions; mark the memo ready for IC; move into ic |
  | ic_member | Record votes and the IC decision; read everything; cannot edit terms |

  Only an IC decision can lock a term set.
- **Top bar:**
  - **Search:** the search field opens the **command palette** (`⌘K` / `Ctrl+K`). Results are grouped as Deals (with a stage chip), Companies (types), People (title @ company). Fuzzy matching covers names, codenames and **aliases**. Recent items show when the query is empty.
  - **Actions** in the palette: New deal, New company, New person, Go to chat, Ask chat "{query}", Toggle theme.
- **Left nav:**
  - **New** (dropdown: Deal, Company, Person), then Chat, Deals, Companies, People.
  - Below a divider, in muted text, add "My queue", "IC calendar" and "Review queue" as disabled items with a "Coming soon" tooltip, signalling the Ideal state.
  - A collapse toggle sits at the bottom.
- **New modals** use zod validation and Enter to submit. On create: write the record and an AuditEvent, show a toast, and **redirect to `/[object]/[id]/overview`**.
  - **Duplicate check while typing.** Fuse matches against names and aliases, plus email for people. A match with score at or below 0.35 shows an inline card: "Possible match: *Wren Industrial Svcs.* — Open existing / Use existing / Create anyway".
  - **New Deal fields:**
    - **Required:** name; borrower (combobox of companies, or "+ Create '…'" inline); strategy.
    - **Optional:** sponsor; deal type; requested size; expected close; lead (defaults to the current user).
    - **"Start from a sample CIM"** offers one seeded sample, *Project Wren CIM*, with 4 markdown pages. Choosing it shows a 2-second "Extracting…" progress state. It then pre-fills name "Project Wren", borrower "Wren Industrial Services" (which triggers the duplicate card for the existing company), sector and size. It also creates 10 **proposed** ExtractedFields and the Document.
    - New deals start at stage `sourced` with an empty v1 proposal term set.
    - An upload control is visible but disabled, labelled "Upload your own CIM (Tier B)".
  - **New Company fields:** name and types (required); domain, sector and HQ (optional).
  - **New Person fields:** full name and company (required, inline create allowed); email, title, person type and relationship owner (optional). Creates the Affiliation.

## 8. `/deals`

- **Header:**
  - Title "Deals".
  - Segmented toggle **List | Pipeline**, synced to `?view=`.
  - Filter bar: stage, strategy, sponsor, lead, status; text filter.
  - Quick chips: "My deals", "At IC", "Passed (last 12 mo)".
  - "New deal" button.
- **List view** (TanStack Table): sortable columns for deal, borrower, sponsor, stage chip, days in stage, strategy, size, fund hold, leverage (computed), spread, risk rating, lead avatar, expected close, last activity. Clicking a row opens `/deals/[id]/overview`. Column visibility is configurable and persisted.
- **Pipeline view** (dnd-kit):
  - **Columns:** sourced, screening, term_sheet, diligence, ic, documentation, closed (closed shows the last 12 months by default, with a toggle for all). A collapsed **Passed / Lost / On hold** lane sits at the right.
  - **Column header:** count and Σ size.
  - **Card:** codename, borrower, size, lead avatar, days-in-stage badge (amber after 30 days), red-flag count, and an amber dot if any memo section is stale.
- **Drag-and-drop gates (`gates.ts`, unit tested).** `evaluateGate(deal, toStage)` returns `{ok, unmet: {label, href}[], hard: boolean}`:

  | Moving to | Requirement |
  |---|---|
  | screening | Borrower and strategy set |
  | term_sheet | A term set with at least one tranche |
  | diligence | Term set v1 issued |
  | ic | Final memo `ready_for_ic`, and every red-flag DD finding has a mitigant or a linked IC condition |
  | documentation | **Hard gate:** an ICEvent decided approve or approve_with_conditions |
  | closed | All pre-close ICConditions satisfied and KYC item closed |
  | Passed lane | Opens the PassReasonModal; a reason code and a note are required |

  - **When a gate is unmet:** the GateModal lists unmet items as links.
  - **Soft gates** offer "Move anyway", which requires a reason; it is stored as `overrideReason` and audited.
  - **Hard gates** cannot be overridden.
  - Moving into `ic` auto-creates a pending final ICEvent tied to the current memo and the active term set.
  - Every successful move writes a StageEvent and an AuditEvent, and updates `stageEnteredAt`.

## 9. `/deals/[dealId]/[tab]`

- **DealHeader:**
  - Breadcrumb "Deals / Project Larch"; serif title; borrower and sponsor links; strategy chip.
  - **Stage stepper:** clickable; runs the same gates as drag-and-drop.
  - **6 metric tiles**, computed live: facility size / hold; total leverage at close; spread / floor; covenant cushion (amber below the guideline); risk rating; next IC date. A tile shows a small "unconfirmed" amber dot if it relies on a proposed field.
  - **Actions:** Advance stage, Generate memo, Ask chat about this deal (opens `/chat` with `@Project Larch` prefilled).
- **Tabs** (URL segment): overview, financials, terms, diligence, memo, ic, stakeholders, documents, notes, history.

| Tab | Must include |
|---|---|
| **Overview** | Summary and thesis (editable); "Next gate" checklist from `evaluateGate(next stage)`; open red flags; IC conditions; team; 8 most recent activities; "Complete this record" prompts for missing fields on new deals |
| **Financials** | (a) **Extraction review**: split pane with the DocViewer on the left (document page, extracted quote highlighted) and the field list on the right (label, value, unit, period, confidence bar, status chip). Fields are sorted with proposed and low confidence first. "Confirm all ≥ 0.90" bulk action. Per field: **Confirm**, or **Correct** (a modal for value plus source document and page, e.g. QoE p.2). Clicking a field scrolls the viewer to its page and highlights the quote. (b) **Spread table** of periods × cases, with derived leverage, EBITDA margin and capex % |
| **Terms** | Version picker (v1, v2… with label and status chips); **Compare** mode (two-version diff table, changed cells highlighted); tranche table; covenant panel with the level schedule and a **headroom bar** (current leverage against the covenant level, marking the guideline threshold); sources & uses. "New version" copies the active version into an editable draft (VP+). "Issue" sets status issued. Locked versions are read-only with a lock icon and "Approved by IC on …" |
| **Diligence** | Grouped by workstream; findings have severity chips and mitigant text. "Propose IC condition" on a finding creates an ICCondition (`proposed`, linked) and sets the mitigant text. Add a request or finding |
| **Memo** | Memo selector (type and version) and status. Sections render with serif body text, live token values and citation chips. Each section header shows authorship (AI, human, AI offline), reviewer, a **Stale** chip if `sectionIsStale`, and the actions *Regenerate* (§11), *Edit* (markdown editor that keeps tokens), *Mark reviewed*. **"Show the data" drawer** per section lists the dependencies with current values, the records cited, and the queries a regeneration would call. Top actions: "Regenerate stale sections", "Mark ready for IC" (VP+; disabled while sections are stale or unreviewed), "Copy as Markdown" |
| **IC** | ICEvents list. Pending event: packet (memo version, term set version), **Precedents panel** (`queries.findPrecedents`: similar sector keywords, size ±50%, leverage ±1.0x; shows outcome, pricing, leverage, pass reason, IC Q&A), **Devil's advocate** questions with precedent chips, votes (each IC member records theirs), conditions (proposed ones from DD can be accepted, edited or removed), decision buttons. **Approve / Approve with conditions locks the active term set** (`status locked`, `label ic_approved`, `lockedByIcEventId`), sets conditions to `open`, and writes the audit. Decided events show the decision record |
| **Stakeholders** | Grouped by side; a person row shows name, role, company, relationship strength and last touch. Add a stakeholder (existing record or inline create) |
| **Documents** | Table: type, title, version, source, pages, extraction status, "cited in N places". Clicking opens a full-width DocViewer |
| **Notes** | Composer (markdown, @mention picker over deals, companies and people, note type, pin) plus a list. Pinned notes first |
| **History** | Timeline of AuditEvents and StageEvents for the deal: icon, actor, summary, timestamp, before → after for field changes. Filter by type and user. "Since last IC" toggle |

## 10. Companies and People

- **`/companies`:** table of name, types, sector, HQ, deals (active / closed / passed), total committed, last activity, owner. Type filter chips (Borrowers, Sponsors, Advisors, Lenders).
- **`/companies/[id]/[tab]`:** tabs overview, deals, people, notes, activity.
  - **Overview** for a sponsor shows **track record with Fernhill**: deals shown, closed, passed (with reasons) and average spread.
  - **Overview** for a borrower shows the latest confirmed financials and current exposure.
- **`/people`:** table of name, title, current company, type, relationship strength, last interaction, owner, related deals count.
- **`/people/[id]/[tab]`:** tabs overview, **activity**, **related-deals**, **related-companies**, notes.
  - Related Companies shows the affiliation **role history** as a timeline (Tom Brandt: Tern → Larch).
  - Related Deals shows role and outcome.

## 11. Chat and AI (`/chat`, `lib/llm/*`)

- **Layout:** thread list on the left (new thread, rename, delete); conversation in the center (§3 styling); composer with an `@` mention picker that adds scope chips.
- **Suggested prompts:**
  1. "What leverage and spreads did we approve on services deals over $75M, and why did we pass on similar ones?"
  2. "Which active deals have unresolved red flags?"
  3. "Summarize what changed on Project Larch since screening IC."
  4. "Who do we know at Ashby Hill, and what's our history with them?"
  5. "Find precedents for Project Larch and the questions IC asked."
- **Tools** (`tools.ts`): JSON-schema definitions that map 1:1 to `queries.ts` and return compact JSON with IDs.
  - `search_entities(query, types?)`
  - `list_deals({stage?, status?, sponsorId?, sectorKeyword?, minSize?, maxSize?})`
  - `get_deal(dealId)`, which includes computed metrics
  - `get_term_set(dealId, which: 'active'|'approved'|number)`
  - `get_financials(dealId)`
  - `get_dd_items(dealId, severity?)`
  - `get_ic_events(dealId?)`
  - `find_precedents(dealId)`
  - `get_company(companyId)`
  - `get_person(personId)`
  - `get_activity({type,id}, limit?)`
  - `get_history(dealId, sinceIso?)`
- **System prompt** (`prompts.ts`) includes:
  - today's date, the user's name and role, and the scoped entities;
  - "Answer only from tool results; if data is missing say so";
  - **citation grammar**: cite every figure with `[[cite:<type>:<id>|<label>]]`, where type is one of deal, company, person, document#pN, term_set, ic_event or dd_item;
  - "prefer markdown tables for comparisons; be concise; credit-analyst tone".
- **Agent loop** (`agent.ts`, client side): `POST /api/llm {system, messages, tools}` → the route calls `anthropic.messages.create({model, max_tokens: 2048, system, messages, tools})` and returns `{content, stop_reason}`.
  - On `tool_use`, run the tools locally, append the results, and loop (at most 8 iterations).
  - Stream progress into the UI as steps: "Calling list_deals…" with a mono label.
  - Store `toolCalls` on the assistant message.
- **Rendering:** markdown with GFM tables. `[[cite:…]]` tokens become CitationChips that link to the right route or document page. A collapsible **"Show queries"** panel lists each tool call with its input JSON, row count and a short result summary. A "Live" or "Offline" badge appears on each answer.
- **Offline mode** (`offline.ts`): used when the route returns 503 or errors. Match the prompt by keyword to one of the 5 suggested intents (plus a generic search intent), **run the same `queries.ts` functions**, and compose a markdown answer with real tables and citations from live store data. Record the tool calls the same way, so "Show queries" works. When no key is configured, show a dismissible banner: "Offline mode — answers are computed deterministically from the database. Add ANTHROPIC_API_KEY for live AI."
- **Memo section regeneration** uses the same loop with a section-specific prompt. The AI must keep `{{metric:…}}` and `{{field:…}}` tokens rather than writing raw numbers. Offline, re-render the seeded template text.
  - Either way: refresh the `snapshot`, set `generatedBy` (`ai` or `ai_offline`), and clear `reviewedBy`.
- **Message actions:** Copy, and "Save to deal notes" (when a deal is in scope).

## 12. Cross-cutting quality

- Every store action is a named function (e.g. `confirmField`, `correctField`, `createTermSetVersion`, `issueTermSet`, `moveStage`, `proposeIcCondition`, `recordVote`, `decideIc`, `regenerateSection`, `markSectionReviewed`, `markMemoReady`, `createDeal`, `createCompany`, `createPerson`, `addStakeholder`, `addNote`). Each one checks permissions, mutates state immutably, and appends an AuditEvent with a human-readable `summary`.
- Empty, loading and error states everywhere. Toasts confirm actions. Keyboard: `⌘K`, `Esc` closes modals, Enter submits.
- Accessibility: semantic headings, focus rings (`--focus`), aria labels on icon buttons, color is never the only signal (chips carry text).
- No console errors or warnings in normal use. No hydration mismatches: render store-dependent UI client-side after hydration.

## 13. Documentation deliverables

- **README.md:** what it is, setup (`npm install`, optional `.env.local`, `npm run dev`), personas, reset, the **demo script** (§15), and project structure.
- **docs/SYSTEM.md (at most 2 printed pages):**
  1. *What I built*
  2. *Architecture*, with a small diagram: browser store, query layer, tool loop, `/api/llm` proxy, Anthropic. Note the production path (Postgres plus ontology actions, MCP server, extraction pipeline with a review queue, SSO and information walls, CRM / data-room / monitoring integrations).
  3. *Data model*: entity list plus the 5 rules from §1.
  4. *Tradeoffs*: mocked vs simplified vs ignored.
  5. *With a couple more days*: live PDF extraction and review queue, Postgres + MCP server, covenant designer, closing checklist and approved-vs-closing diff, Word export, SSO and walls.
- **docs/schema.sql:** Postgres DDL mirroring `schema.ts`, with foreign keys and enums.

## 14. Build order (keep the app runnable after each step)

1. Scaffold, design tokens, fonts, theme toggle, AppShell (top bar, left nav), mock auth with persona switcher.
2. `schema.ts`, seed data (Larch complete; other deals lighter), store, selectors, gates, permissions. Unit tests for selectors and gates.
3. `/deals` list and pipeline with gates and the pass-reason modal.
4. Deal page: header, Overview, Financials (extraction review + DocViewer), Terms (versions, diff, headroom).
5. Memo tab with token rendering, stale detection and the data drawer; Diligence tab; IC tab with precedents, devil's advocate, votes, decision and lock.
6. Stakeholders, Documents, Notes, History tabs.
7. Companies and People lists and detail pages.
8. New modals with duplicate check, the sample-CIM flow and redirects; command palette.
9. Chat: queries, tools, offline engine first, then the live loop through `/api/llm`; memo regeneration.
10. Docs (README, SYSTEM.md, schema.sql), polish, full verification.

## 15. Acceptance checklist and demo script (all must pass)

**Automated:**
- `npm run build`, `npm run lint` and `npm test` all pass.
- Tests cover:
  - leverage: 90 / 17.5 = 5.14x, and after correction 90 / 16.3 = 5.52x;
  - cushion: 26.5% → 21.1% → 26.4% with the covenant at 7.50x;
  - stale detection;
  - every gate rule;
  - the duplicate matcher (finds "Wren Industrial Svcs." from "Wren Industrial Services");
  - permissions;
  - `findPrecedents(deal_larch)` considers only closed or passed deals, ranks them by similarity, and includes Ember, Granite, Tern and Alder. Give each deal `sectorTags`, e.g. Larch `['business_services','facility_services','hvac']`.

**Manual demo script** (verify it works exactly, with no API key, and again with a key if one is available):
1. Sign in as **Analyst Jordan**. You land on `/deals` (list). Switch to Pipeline: 12 deals in the correct columns, Passed lane with 3.
2. **New → Deal → Start from a sample CIM.** Extraction runs, the duplicate card suggests the existing *Wren Industrial Svcs.*, choose "Use existing". You are redirected to `/deals/<new>/overview` (stage sourced), and Financials shows 10 proposed fields.
3. Open **Project Larch → Financials**. Select `adj_ebitda_ltm` (0.64) and the viewer highlights CIM p.8. **Correct** it to 16.3 with source QoE p.2. The header leverage changes 5.1x → 5.5x and cushion 27% → 21% (amber). The Memo tab shows Financial Analysis, Structure & Terms, Key Risks and Recommendation as **Stale**. History records the correction.
4. Switch persona to **VP Marcus**. **Terms → New version** to v2 with the covenant at 7.50x / 7.00x / 6.50x. Save and issue. Compare v1 and v2 (covenant cells highlighted). Cushion is about 26% (no longer amber).
5. **Diligence:** "Propose IC condition" on the customer-concentration red flag ("Customer reference call with top customer and review of MSA renewal terms prior to close").
6. **Memo:** "Regenerate stale sections" (offline or live), mark sections reviewed, then **Mark ready for IC**. Citation chips open the right document page. The data drawer lists dependencies.
7. **/deals pipeline:** drag Larch to **IC**. The gate passes and a pending ICEvent is created. Dragging another deal into Documentation without approval shows the **hard gate**.
8. Switch to **IC Robert**. **IC tab:** precedents show Ember (passed, concentration 31%), Granite (covenant reset) and Tern. Devil's-advocate questions link to them. Record votes, accept the proposed condition, **Approve with conditions**. Term set v2 shows **Locked · IC-approved**. History shows the full trail. Dragging Larch to Documentation now succeeds.
9. **/chat:** run suggested prompt 1. The answer is a table of approved spreads and leverage with citation chips, plus the pass reasons. "Show queries" lists `list_deals`, `get_ic_events`, etc. Suggested prompt 3 lists the EBITDA correction, term-set v2 and the IC approval.
10. Open **Tom Brandt** from Larch → Stakeholders. `/people/<id>/related-companies` shows Tern (2019–2023) → Larch, and Related Deals shows Tern and Larch.
11. `⌘K` "GS"-style alias test: typing "Wren Services" finds Wren Industrial Svcs. Typing "Larch" offers "Go to Project Larch → Terms".
12. Toggle dark mode: every page remains legible with correct tokens. Reset demo data restores the seed.

When everything passes, print a short summary of what was built, how to run it, and any known limitations.
