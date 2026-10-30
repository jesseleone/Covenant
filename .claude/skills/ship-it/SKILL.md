---
name: ship-it
description: Check a finished Covenant extension and send it for approval. Use when the person says "ship it", "send it", "send for approval", "submit", "publish" or "I'm done".
---

# Ship it: check and send for approval

The person is usually not a developer. Tell them briefly what's happening at each step, in plain English. Never say "PR", "commit", "branch", "push" or "merge" to them. Say "approval request", "save", "your draft" and "goes live".

## 1. Find what's being sent

```bash
git status --short
npx tsx scripts/predict-lane.ts --json
```

- Work out which extension folder changed: `extensions/<name>/`.
- If changes are in **more than one extension**, ask which one to send now. Send one at a time.
- If anything **outside `extensions/`** changed, stop. Explain that those changes need an engineer, and offer an engineering request (see `CLAUDE.md`). Don't send them.

## 2. Update the manifest

Set `updatedAt` in `extensions/<name>/manifest.json` to today's date (YYYY-MM-DD).

## 3. Run the checks, and fix what fails

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Fix failures inside the extension's folder and run the checks again until they pass. If a failure comes from outside the folder, stop and explain. That's for an engineer. Tell the person in one line that everything passed.

## 4. Save the work on its own draft

```bash
git switch -c ext/<name>-<YYYYMMDD>       # skip if already on an ext/<name>-… draft
git add extensions/<name>
```

Write the save message: a short title, a blank line, one or two sentences, a blank line, then the audit trailers from `npx tsx scripts/claude/audit.ts --trailers`:

```bash
git commit -m "<Name>: <short summary>" -m "<one or two sentences>" -m "$(npx tsx scripts/claude/audit.ts --trailers)"
git push -u origin ext/<name>-<YYYYMMDD>
```

## 5. Open the approval request

Gather:

```bash
npx tsx scripts/predict-lane.ts
npx tsx scripts/claude/cost.ts
npx tsx scripts/claude/audit.ts
```

Write the description to `/tmp/covenant-approval.md`, following `.github/pull_request_template.md`. Remove the template's comments and fill in each section in plain English, a few sentences each:

- **What changed**: what was added and what people will see.
- **Why**: who asked and what it helps them do (from `SPEC.md`).
- **How it was tested**: the tests you wrote and what they check, plus what the person looked at in the preview.
- **Approval lane (predicted)**: the first line from `predict-lane.ts`.
- **Cost**: the line from `cost.ts`, exactly as printed.
- **Audit**: the line from `audit.ts`, exactly as printed.

Then:

```bash
gh pr create --base main --title "<Name>: <short summary>" --body-file /tmp/covenant-approval.md
```

## 6. Tell the person what happens next

Give them the link and explain, briefly:

- The automatic checks and an AI review run now (a few minutes). They show up on the approval page.
- **Green lane**: one business approver approves it and it goes live automatically.
- **Review lane**: an engineer looks at it first. The approval page explains why.
- If changes are requested, they can come back and ask you to make them. Then say "ship it" again to update the same request.

If `git push` or `gh pr create` fails because they don't have access to the project, explain that an admin needs to add them as a collaborator (see `docs/admin-runbook.md`). Their work is saved locally in the meantime.
