---
name: new-extension
description: Plan and build a new Covenant extension (a new left-menu page or a new tab on every deal) for someone on the deal team. Use when the person describes a new screen, view, report, summary, dashboard or tab they'd like in Covenant.
---

# Build a new extension

The person is usually not a developer. Speak plainly, keep questions short, and never use jargon (see `CLAUDE.md`).

## 1. Understand what they want

Ask a few short questions, in one message. Skip any they've already answered:

1. What should it show, and what question does it answer for them?
2. Where should it live: **its own page in the left menu**, or **a tab on every deal**?
3. Who will use it, and when (e.g. "before IC", "Monday pipeline meeting")?
4. Should it let people **add a note** or **add a diligence item**? Those are the only changes an extension can make.
5. What should it be called?

## 2. Check it can be built as an extension

Read `lib/sdk/README.md`. An extension can only read the data the SDK offers and only add notes or diligence items.

If the request needs something else (new kinds of data, changed calculations, other edits, permissions, outside services, new packages), say so plainly. Offer to build the part that fits, and to write an **engineering request** for the rest (see `CLAUDE.md`). Don't work around the limits.

## 3. Write a short plan and get it confirmed

Pick a folder name: lowercase words joined by hyphens, e.g. `deal-one-pager`. It must not exist yet under `extensions/`, and must not be one of: overview, financials, securities, diligence, memo, ic, stakeholders, documents, notes, history, deals, companies, people, chat, extensions, login, api.

Write `extensions/<name>/SPEC.md` with exactly these sections, in plain English, a few bullets each:

```markdown
# <Name>

## What it does
## Out of scope
## Open questions
```

Show the person the plan in your reply (not just the file path) and ask: **"Shall I build this?"** Wait for a clear yes. If they change anything, update `SPEC.md` and ask again.

## 4. Build it

Everything goes in `extensions/<name>/`. Use only `@/lib/sdk` and `react`. `extensions/sector-exposure/` is a complete example to copy from.

1. **`manifest.json`.** Get the owner from `gh api user --jq '{login: .login, name: .name}'`. Use today's date for both dates.
   ```json
   {
     "name": "<Name>",
     "description": "<one sentence, 10–200 characters>",
     "placement": "nav" | "deal-tab",
     "owner": { "github": "<login>", "name": "<full name>" },
     "createdAt": "YYYY-MM-DD",
     "updatedAt": "YYYY-MM-DD"
   }
   ```
2. **`index.tsx`.** The screen, as the default export. A deal tab receives `{ deal }` (type `DealTabProps`). Read data with `useCovenant()`. Use the SDK's components (`Card`, `Section`, `Table`, `BarChart` …) and formatting (`formatMoney`, `formatMultiple` …) so it looks like the rest of Covenant. Don't recalculate leverage or cushion: use `data.metrics(dealId)`.
3. **`<name>.test.tsx`.** At least one test, written with `renderExtension` from `@/lib/sdk/testing`. Check what matters to the person, e.g. the right deals and numbers appear. A deal tab test can use `data.deal("deal_larch")` values from the demo data. If it adds notes or diligence items, check `recordedWrites()`.
4. Run `npm run extensions` so the app picks the new folder up.

## 5. Check it

Run these, and fix any problem inside the extension's folder:

```bash
npx vitest run extensions/<name>
npx eslint extensions/<name>
npm run typecheck
```

If a check fails because of something outside the folder, stop and explain. That needs an engineer.

## 6. Show it

Tell the person in two or three sentences what you built. Then offer a preview: use the **preview** skill. When they're happy, they can say "ship it" (the **ship-it** skill) to send it for approval.
