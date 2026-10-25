# Covenant

An underwriting workspace for a private credit deal team: deals, companies and people, with the underwriting work (financials, securities, due diligence, IC memo and IC approval) on the deal page. It's a demo prototype; all data lives in the browser.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for live chat
npm run dev                  # http://localhost:3000
```

Sign in with any demo persona (Analyst, VP, MD, IC). **Reset demo data** in the user menu restores the seed.

```bash
npm test        # unit tests: calculations, stage gates, permissions, seed integrity
npm run lint
npm run build
```

## Where things are

| Path | What |
|---|---|
| `lib/schema.ts` | Every entity, as zod schemas and TypeScript types |
| `lib/seed/` | Seed data. Project Larch (`larch.ts`) is the fully built deal |
| `lib/store.ts` | The in-browser database (Zustand, saved to localStorage) and the `commit` helper every write goes through |
| `lib/selectors.ts` | Derived values: leverage, covenant cushion, stale memo sections, relationship strength |
| `lib/gates.ts` | Stage-gate rules |
| `lib/permissions.ts` | Role → allowed actions |
| `lib/queries.ts` | Typed reads (precedent search); chat tools will map onto these |
| `lib/render/tokens.ts` | Resolves `{{metric:…}}` / `[[cite:…]]` tokens in memo and chat text |
| `app/` | Routes: `/deals`, `/deals/[id]/[tab]`, `/companies`, `/people`, `/chat`, `/login` |

Build progress and scope: see `Background Info/` (product scope v3 and the build spec).
