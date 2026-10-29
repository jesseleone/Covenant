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
