# Covenant

An underwriting workspace for a private credit deal team: deals, companies and people, with the underwriting work (financials, securities, due diligence, IC memo and IC approval) on each deal page, and a chat that answers questions from the fund's own records. It's a demo prototype for the fictional Fernhill Credit Partners; all data lives in the browser.

The system explanation is in [`docs/SYSTEM.md`](docs/SYSTEM.md); the Postgres version of the data model is [`docs/schema.sql`](docs/schema.sql).

## Run it

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for live AI
npm run dev                  # http://localhost:3000
```

Without an API key, chat and memo regeneration run in **offline mode**: answers are computed deterministically from the same database queries, and the UI says so.

```bash
npm test         # 69 unit tests: calculations, stage rules, permissions, actions, chat, seed integrity
npm run lint
npm run build
```

## Personas

Sign in with a quick-pick persona, or with any seeded email and any password. Switch persona from the user menu (top right). **Reset demo data** in the same menu restores the seed.

| Persona | Can |
|---|---|
| Jordan Reyes, Analyst | Create records, confirm or correct extracted values, diligence, notes, memo drafting; move deals up to Diligence |
| Marcus Chen, VP · Elena Duarte, MD | Everything above, plus create and issue term-set versions, mark the memo ready for IC, submit to IC |
| Robert Hale, IC chair · Aisha Okafor (`aisha.okafor@fernhillcredit.com`) | Vote, record the IC decision, manage conditions, move approved deals to Documentation |

## Demo script (about 8 minutes)

1. **Pipeline.** Sign in as **Jordan**. Open Deals → **Pipeline**: active deals by stage, the last year's closes, and passed or lost deals in the collapsed side lane. Drag Larch toward IC and note the locked column: analysts can't submit to IC.
2. **Create from a CIM.** **New → Deal → Start from a sample CIM.** Extraction pre-fills Project Wren and flags the borrower as a likely duplicate of *Wren Industrial Svcs.*; choose **Use existing**, then **Create deal**. Its Financials tab shows ten proposed values, each with its source passage highlighted.
3. **Confirm or correct.** Open **Project Larch → Financials**, select *Adjusted EBITDA (LTM)* (64% confidence, CIM p.8), click **Correct**, enter `16.3` (the dialog finds it on QoE p.2) and save. Leverage moves 5.14x → 5.52x, cushion 26.5% → 21.1% (below the 25% guideline), and four memo sections become stale. **History** records the correction.
4. **Securities.** Switch to **Marcus**. Securities → **New version**, set the covenant steps to 7.5 / 7 / 6.5, then **Issue v2**. Cushion returns to 26.4%. **Compare versions** highlights the change.
5. **Diligence.** On the customer-concentration red flag, **Propose IC condition** (the text is pre-filled).
6. **Memo.** On IC Memo, hover a number to see its source, then open **Show the data** on Financial Analysis. Click **Regenerate stale**, **Mark reviewed** on each section, then **Mark ready for IC**.
7. **Submit.** From the deal header, **Submit to IC**: both requirements are met, and the final IC is scheduled for Thursday. Dragging Beacon to Documentation shows the rule that can't be overridden.
8. **Decide.** Switch to **Robert**. IC & Approvals shows the packet, devil's-advocate questions linked to precedents (Ember, Granite, Tern) and "What IC asked" on each. Vote **Approve w/ conditions**, then **Approve with conditions**. Term set v2 is **locked · IC-approved**; **Advance to Documentation**.
9. **Since last IC.** History → **Since last IC** lists every change since screening.
10. **Chat.** Open Chat and run the first suggested prompt: a table of approved pricing with citation chips; **Show queries** lists the calls behind it. On any deal, **Ask about this deal** opens the same chat scoped to that deal.
11. **Relationships.** From Larch → Stakeholders, open **Tom Brandt**: his role history runs from Tern (a past borrower) to Larch. Press `⌘K` and type "Wren Services" or "Larch" to search by alias and jump straight to a tab.

## Project layout

| Path | What |
|---|---|
| `lib/schema.ts` | Every entity, as zod schemas and TypeScript types |
| `lib/seed/` | Seed data; Project Larch (`larch.ts`) is the fully built deal |
| `lib/store.ts` | The in-browser database (Zustand, saved to localStorage) and the `commit` helper every write goes through |
| `lib/actions.ts` | The 34 domain actions; each checks permissions and writes an audit event |
| `lib/selectors.ts` | Derived values: leverage, cushion, stale memo sections, relationship strength |
| `lib/gates.ts`, `lib/permissions.ts` | Stage rules and role permissions |
| `lib/memo.ts`, `lib/render/tokens.ts` | Memo staleness, offline generation, and live-value tokens |
| `lib/llm/` | Query tools, tool definitions, prompts, client tool loop, offline chat engine |
| `app/api/llm/route.ts` | Thin proxy to the Claude Messages API (no data held server-side) |
| `components/` | UI by area: `deals/`, `chat/`, `modals/`, `shell/`, `common/`, `ui/` |
