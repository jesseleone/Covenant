# Decisions

Implementation choices not fixed by the brief. One line each: choice — reason.

- Actions run on the server by loading the whole DB in a transaction (behind an advisory lock), running the unchanged action logic, and writing only the changed rows — reuses all 34 actions as-is; the demo data is small.
- A single route `app/api/actions/[name]` dispatches to a registry of named actions — one place for permission checks, transactions and audit rows.
- Chat threads and messages stay unaudited (as in Task 1), but are stored in Postgres through server routes — they're personal working state, not deal records.
- The extension index is generated from manifests into a gitignored file before dev, build, test and typecheck — a new extension then changes only its own folder, which keeps it in the green lane.
- **Addition to decision 3:** a required `engineer-approval` check (lane classifier) passes for review-lane PRs only after an engineer listed in `.github/approvers.json` approves — CODEOWNERS alone would let an extension-only PR with a "serious" AI verdict merge with just a business approval.
- If the AI review doesn't run or gives no verdict, the PR goes to the review lane — fail safe.
- Checks, AI review and lane classification are jobs in one workflow, in that order — the classifier needs both results.
- Roles: `@jesseleone` is the engineer (owns `*`), `@jesse-leone` the business approver (owns `extensions/`) — two accounts so the approver is never the PR author.
- Admin override is allowed only as a documented fallback for dry runs — the second account is the intended approver.
- Codespaces opened from a PR's preview link are billed to whoever opens them, from their own free allowance — no cost to the repo owner; noted in the runbook and cheat sheet.
- Seed and reset load the existing `buildSeed()` into Postgres — the demo data stays defined in one place, and a test proves a round trip returns it exactly.
- `db/migrations/001_init.sql` extends `docs/schema.sql`: a `seq` column on every table (records load in creation order), deferred foreign keys (one action's writes are checked together), and the columns the app model carries (user initials, term-set note, settings.today).
- Audit rows are protected by a trigger, not `REVOKE` — the app connects as the table owner, which `REVOKE ... FROM PUBLIC` doesn't restrict.
- The term-set lock trigger skips rows only while a transaction has set `covenant.seeding` — seeded term sets arrive already issued or locked.
- The browser reads the whole database from `GET /api/db` after sign-in and after every write — simplest client cache; fine at demo size.
- `/api/session` lists the personas without sign-in; every other route needs the session cookie — the login page needs the persona list.
- No `proxy.ts` redirect — the app shell already sends signed-out visitors to /login, and every API route checks the cookie itself.
- Only a thread's owner can rename or delete a chat; everyone still sees the shared seeded threads — closes a gap the browser-only version couldn't enforce.
- Chat streams progress as newline-delimited JSON from `POST /api/chat` — keeps the "Calling list_deals…" trace now that tools run on the server.
- Local Postgres runs from `compose.yaml` on host port 5433 — 5432 is often taken by another local database.
- Database tests are skipped with a warning when no Postgres is reachable, except in CI (`CI=true`), where that fails the run.
- The production image bundles the database script with esbuild and runs `setup` (migrate, seed if empty) before `server.js` — one container is enough to demo.
