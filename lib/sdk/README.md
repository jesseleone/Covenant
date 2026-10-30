# Extension SDK

Extensions are new screens built by the team on top of Covenant. Each one lives in its own folder, `extensions/<name>/`, and talks to the rest of the app **only** through `@/lib/sdk`. That keeps the part people build small and safe. The core (data, calculations, permissions) stays with the engineers.

## What an extension folder contains

| File | What it is |
|---|---|
| `manifest.json` | Name, one-line description, where it appears (`"nav"` = its own page in the left menu, `"deal-tab"` = a tab on every deal), owner (GitHub username and full name), `createdAt` and `updatedAt` (YYYY-MM-DD) |
| `index.tsx` | The screen itself, as the default export. A deal tab receives `{ deal }`. |
| `*.test.tsx` | At least one test |
| `SPEC.md` | What it does, what's out of scope, open questions (written before building) |

Covenant finds extensions by their manifests: no other file changes. The **Extensions** page in the left menu lists them all.

## Reading data

```tsx
import { useCovenant } from "@/lib/sdk";

const data = useCovenant();
data.deals                 // every deal (check deal.status: active, closed, passed, lost, on_hold)
data.metrics(deal.id)      // facility size, fund hold, leverage, spread, covenant level, cushion
data.currentTerms(deal.id) // the term set those numbers come from
data.tranches(termSetId)   // the loans in a term set
data.diligenceFor(deal.id) // diligence requests and findings
data.notesAbout("deal", deal.id)
data.company(id), data.person(id), data.userName(id), data.daysInStage(deal), data.statusLabel(deal)
data.companies, data.people, data.ddItems, data.notes, data.termSets, data.financialPeriods, data.icEvents, data.icConditions
data.today, data.me
```

Numbers like leverage and cushion come from Covenant's own calculations; extensions show them but don't recalculate them.

## Writing data: the allowed list

Only these two writes are available. Each runs on the server, checks the person's permissions, and is recorded in the deal's History.

| Function | What it does |
|---|---|
| `addNote(subject, text, kind?)` | Adds a note to a deal, company or person |
| `addDiligenceItem(dealId, item)` | Adds a diligence request or finding to a deal |

Anything else (changing terms, moving stages, editing calculations, new kinds of data) needs an engineer.

## Formatting and components

- Formatting: `formatMoney` ($M), `formatMultiple` (x), `formatPercent`, `formatSpread`, `formatDate`, `formatMonth`, `titleCase`.
- Components: `Card`, `Section`, `PageHeader`, `Button`, `Chip`, `EmptyState`, `KV`, `Label`, `Table` / `THead` / `TH` / `TR` / `TD`, `TextLink`, `Avatar`, `StageChip`, `StrategyChip`, `DealStatusChip`, `SeverityChip`, and `BarChart` (one measure across categories).

## Testing

```tsx
import { describe, expect, it } from "vitest";
import { fireEvent, recordedWrites, renderExtension, screen } from "@/lib/sdk/testing";
import View from "./index";

it("shows the deals", () => {
  renderExtension(<View />);            // demo data, signed in as Jordan (analyst)
  expect(screen.getByText("Project Larch")).toBeTruthy();
});
```

`renderExtension(<View deal={...} />, { as: "u_marcus" })` signs in as someone else. Writes are recorded, not sent: check them with `recordedWrites()`.

## The rules (checked automatically)

- Imports only from `@/lib/sdk`, `react` and files in the same folder (tests may also use `vitest` and `@/lib/sdk/testing`).
- No network calls, browser storage, server settings or raw HTML.
- No new packages and no changes outside the extension's folder.

`npm run lint` and `npm test` check these; so does every change sent for approval.
