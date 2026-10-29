# Plan: Covenant as a citizen-developer SDLC demo

Branch `citizen-sdlc`, from tag `task1-v1` (the Task 1 prototype). Each phase ends with typecheck, lint, tests and build, a commit, and a stop for review. Minor choices go in [`decisions.md`](decisions.md).

## Starting point

- **The data layer is client-side.** One Zustand store holds the whole database (`DB`, 24 collections) in localStorage. The 34 actions in `lib/actions.ts` are recipes that run on a copy of that object through `commit()`, which checks permissions and appends audit events. They are synchronous and called from 11 component files. Five places read the store directly to compare before and after a write, or to feed chat.
- **Chat runs in the browser.** The tool loop is `lib/llm/agent.ts`; `/api/llm` only relays each turn to Claude. Offline answers come from `lib/llm/offline.ts`. Chat threads are written with the unaudited `mutate()`.
- **`docs/schema.sql` is more normalized than the TS shape.** It has 30 tables: child tables such as `document_page`, `covenant_level`, `ic_vote`, `ic_question` and `note_mention` hold data that sits nested in the TS objects. It was tested on Postgres 16.
- **Tests:** 69 vitest tests in `lib/__tests__/`; `actions.test.ts` drives the store directly. `@testing-library/react` and `jsdom` are already dev dependencies.
- Next.js 16.4.3: middleware is now `proxy.ts`; route handlers, `cookies()` and `output: "standalone"` are documented in `node_modules/next/dist/docs/`.

## Decision → files

### 1. Real backend (Phase 1)

| Item | Files |
|---|---|
| Migrations from `schema.sql`, adjusted where the TS model needs a column | `db/migrations/001_init.sql` …; `scripts/db/migrate.ts` (applies files in order, records them in `schema_migrations`) |
| Seed = today's demo data exactly | `scripts/db/seed.ts` calls the existing `buildSeed()` and inserts it; `scripts/db/reset.ts` drops, migrates and seeds. npm scripts `db:migrate`, `db:seed`, `db:reset` |
| Connection | `lib/server/db.ts` (`pg` Pool, `DATABASE_URL`) |
| Rows ⇄ `DB` shape | `lib/server/repo.ts`: `loadDB(client)` assembles the TS shape from the tables; `saveDiff(client, before, after)` inserts, updates and deletes changed rows per table, including child tables |
| Actions run on the server | `lib/actions.ts` becomes pure: each action takes `(db, actor, …args)` and returns audit drafts or an error. A new `lib/server/run-action.ts` opens a transaction, takes an advisory lock, loads the DB, checks the permission, runs the action, writes the diff plus `audit_event` rows, and commits. A registry maps action names to functions; one route, `app/api/actions/[name]/route.ts`, runs them. |
| Client cache | `lib/store.ts` keeps Zustand as a read cache, filled from `GET /api/db` and refreshed after each write. `lib/client/actions.ts` exposes the same action names as async functions that POST and then refresh. Components `await` them. |
| Persona cookie | `app/api/session/route.ts` (sign in, sign out); `lib/server/session.ts` reads the cookie; the server derives the actor from the cookie only. `proxy.ts` sends signed-out visitors to `/login`. |
| Chat on the server | `app/api/chat/route.ts` runs the tool loop (`lib/llm/agent.ts` moves server-side) against `loadDB`; offline mode runs the same tools when there is no key. Thread and message writes go through server routes (unaudited, as today). Memo regeneration moves to the server the same way. |
| Reset demo data | `app/api/reset/route.ts` runs the reset logic (truncate, seed) |
| Tests | Pure tests (selectors, gates, terms, dedupe, offline chat) stay unit tests on `buildSeed()`. Action tests run the pure actions on a seed copy, and new integration tests (`*.db.test.ts`) run `run-action` against a real Postgres (`TEST_DATABASE_URL`), each in a rolled-back transaction. No coverage is deleted. |
| Production image | `Dockerfile` (multi-stage, `output: "standalone"`), `.dockerignore` |

### 2. Extension model (Phase 2)

| Item | Files |
|---|---|
| SDK | `lib/sdk/index.ts`: read hooks and selectors (deals, companies, people, financial snapshot, terms, diligence), allowed writes `addNote` and `addDDItem`, and the shared UI components (`Card`, `Button`, `Badge`, table and chart primitives). The list is documented in `lib/sdk/README.md`. |
| Import rule | `eslint.config.mjs`: for `extensions/**`, `no-restricted-imports` allows only `@/lib/sdk`, `react`, and relative imports inside the same extension folder |
| Discovery | `scripts/gen-extensions.ts` reads every `extensions/*/manifest.json` (validated with zod) and writes `lib/extensions/registry.generated.ts`, which is gitignored. It runs before `dev`, `build`, `test` and `typecheck`. |
| Placement | Nav pages: `app/(app)/x/[slug]/page.tsx` plus nav entries from the registry. Deal tabs: `components/deals/deal-tabs.tsx` appends registry tabs. |
| Catalog | `app/(app)/extensions/page.tsx`: name, description, placement, owner, last updated |
| Reference extension | `extensions/sector-exposure/` (manifest, view, test, SPEC.md) |
| Extension tests | vitest picks up `extensions/**/*.test.tsx` in jsdom with a seeded SDK test harness from `lib/sdk/testing.ts` |

### 3–5, 8–10. Pipeline and governance (Phase 5)

| Item | Files |
|---|---|
| One PR workflow: checks → AI review → lane | `.github/workflows/pr.yml`. Jobs: `checks` (typecheck, lint, test with a Postgres service, build), `ai-review` (`anthropics/claude-code-action`, Opus, prompt in `.github/ai-review-prompt.md`, final line `AI-REVIEW-VERDICT: none \| minor \| serious`), `lane` (needs both) |
| Lane classifier | `scripts/ci/classify-lane.ts` (pure, unit-tested) + the `lane` job: sets the label, updates one comment (hidden marker), enables auto-merge on green and disables it on review. No verdict or a failed review means the review lane. |
| Engineer approval check | `engineer-approval` job in the same workflow, also run on `pull_request_review`: passes for green-lane PRs; for review-lane PRs it passes only once an engineer listed in `.github/approvers.json` has approved the latest commit. It is a required check. |
| Previews | `.github/workflows/preview.yml`: one updated comment with the "Open live preview" Codespaces link for the PR branch, and a screenshots job (Postgres service, migrate, seed, build, start, Playwright screenshots of changed extension views, uploaded as an artifact and linked) |
| CODEOWNERS | `.github/CODEOWNERS`: `* @jesseleone`, `/extensions/ <business approver>`; usernames also in `.github/approvers.json` |
| PR template | `.github/pull_request_template.md` |
| Metrics | `.github/workflows/metrics.yml` (weekly), `scripts/ci/metrics.ts` |

### 6. Workspace (Phase 3)

`.devcontainer/devcontainer.json` + `docker-compose.yml` (app: Node 22, GitHub CLI and Claude Code features; db: `postgres:16`), `postCreateCommand` (install, migrate, seed), `postStartCommand` (dev server), port 3000 labelled "Covenant preview". `scripts/setup-mac.sh`, `scripts/setup-windows.ps1`. README: Codespaces button and the 5-step quickstart.

### 7. Harness (Phase 4)

`CLAUDE.md`; `AGENTS.md` (Next.js block kept, same rules added); `.claude/settings.json` (model, deny rules, allowed commands, hook); `.claude/hooks/guard-paths.mjs` (blocks writes outside `extensions/` unless `COVENANT_ENGINEER=1`); `.claude/skills/{new-extension,preview,ship-it}/SKILL.md`; `scripts/claude-cost.ts` (sums the session transcript's token usage × list price) and `scripts/audit-trailer.ts`. The `.gitignore` entry for `/.claude/` is narrowed so the shared config is committed and local files (`settings.local.json`, `tts-disabled`) stay out.

### 11. Documents and training (Phase 6)

`docs/brief.md`, `docs/ARCHITECTURE.md`, `docs/admin-runbook.md`, `docs/training/{session-plan,slides,facilitator-script,cheat-sheet,starter-ideas,office-hours}.md`, README links. `docs/SYSTEM.md` and `Background Info/` stay unchanged.

## Risks

1. **Phase 1 is the largest change.** Every write becomes a network round trip. Mitigation: keep the action logic unchanged and only move where it runs; reload the cache after each write; port the action tests before touching components.
2. **Mapping rows to the TS shape is error-prone** with 30 tables and nested children. Mitigation: a round-trip test (`buildSeed()` → insert → `loadDB()` deep-equals the seed) and a diff-writer test per table.
3. **Loading the whole DB per request** is fine for demo data but doesn't scale. This is a documented simplification; the action and selector interfaces stay the same if loading becomes per-deal later.
4. **Parts of the pipeline only run on GitHub**: Codespaces, auto-merge, required checks, the AI review action. They're tested with real PRs on `citizen-sdlc` in Phases 5 and 7; repo settings stay with you.
5. **The review-lane guarantee rests on the engineer-approval check**, not on CODEOWNERS alone. Branch protection must mark it required, which is a manual step.
6. **The PreToolUse hook is a convenience.** It can be bypassed by Bash writes or by engineer mode; CI is the real enforcement, and the docs say so.
7. **The Windows setup script can't be run here.** It will be written carefully and marked untested.
8. **The cost estimate depends on Claude Code's transcript format**, which isn't a public contract. The script fails safe to "Estimated cost: unavailable".

## Open questions

1. **Business approver username.** You're creating the second account. Until you send the name, CODEOWNERS and `approvers.json` use the placeholder `BUSINESS_APPROVER_USERNAME`, and the runbook says where to change it.
2. **Exact Codespaces link format and `claude-code-action` inputs and outputs** (model setting, cost output). I'll check these against GitHub's and the action's docs in Phases 3 and 5 rather than relying on memory.
3. **Pushing the tag.** `task1-v1` exists locally. I'll push it with the branch in Phase 5, as you allowed.
