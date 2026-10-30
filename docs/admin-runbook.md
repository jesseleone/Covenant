# Admin runbook

> **Demo only.** Covenant's sign-in is a persona picker without passwords: anyone who can reach a running copy can act as any user, so permissions and the audit trail can't be trusted against a determined person. Never load real fund data. Before real use, replace sign-in with the firm's single sign-on and a signed session.

Everything an administrator sets up and looks after, outside the code. Steps marked **(one-time)** are done once. GitHub menu names are as of October 2026; the Claude admin console changes more often, so where a menu path isn't certain this runbook says what to look for.

## 1. GitHub: make the process binding (one-time)

The workflows only *report*; branch protection makes them *required*.

1. **Merge the work to `main`.** Open a pull request from `citizen-sdlc` to `main` and merge it. It lands in the review lane; as the owner you may need the admin override (section 6).
2. **Pull request settings.** *Settings → General → Pull Requests*: tick **Allow squash merging**, **Allow auto-merge** and **Automatically delete head branches**.
3. **Protect `main`.** *Settings → Branches → Add branch protection rule* (or *Rules → Rulesets*) for `main`:
   - **Require a pull request before merging**, with **Required approvals: 1**
   - **Dismiss stale pull request approvals when new commits are pushed**
   - **Require review from Code Owners**
   - **Require approval of the most recent reviewable push** (nobody can push a change and approve it themselves; GitHub never lets authors approve their own pull request)
   - **Require status checks to pass**, adding: `typecheck`, `lint`, `test`, `build`, `ai-review`, `lane`, `engineer-approval` (they appear in the list after they've run once)
   - **Block force pushes** and **Restrict deletions**
   - Leave **Do not allow bypassing the above settings** unticked only if you want the admin override for dry runs (section 6). Tick it once you have a second engineer.
   - Using **rulesets** instead (*Settings → Rules → Rulesets*)? The same rules apply; the admin override is the ruleset's **Bypass list** (add *Repository admin*, "For pull requests only").
4. **The AI review's API key.** *Settings → Secrets and variables → Actions → New repository secret*: name `ANTHROPIC_API_KEY`. Use a key dedicated to CI from an Anthropic API (Console) workspace with its own monthly spend limit; one review costs cents. Without it, every change goes to the review lane.
5. **People.** *Settings → Collaborators → Add people*, role **Write**, for every citizen developer (they need it to send changes for approval) and every approver. Code owners must have write access or GitHub ignores them.
6. **Codespaces.** On a personal account, anyone who opens the repository's Codespace pays from their *own* free monthly allowance (GitHub Free includes a monthly quota of core-hours and storage; check GitHub's billing page for current amounts). Nothing is billed to the repository owner. Each person can add `ANTHROPIC_API_KEY` as their own Codespaces secret (*github.com → Settings → Codespaces → Secrets*) to get live AI in the app's chat; without it the app's chat runs offline. Claude Code itself signs in with their company Claude account.

## 2. Approvers

Two files say who approves what, and they must agree:

- `.github/CODEOWNERS`: `* @<engineer>` (everything) and `/extensions/ @<business approver>` (citizen-built views). The last matching line wins.
- `.github/approvers.json`: the same people as `engineers` and `businessApprovers`, used by the lane comment and the `engineer-approval` check.

Defaults: engineer **@jesseleone**, business approver **@jesse-leone**. To add or change someone, list several usernames separated by spaces in CODEOWNERS and add them to the JSON. These files are owned by engineers, so the change itself goes through the review lane.

**Moving to an organization.** A free GitHub organization gives you **teams**: replace usernames with `@fernhill/engineers` and `@fernhill/deal-team-approvers` in CODEOWNERS, and approvals follow team membership. That's the recommended setup beyond a pilot.

## 3. Claude Enterprise: seats, models and spend

Principle: **cap the budget, not the brains.** Give citizen developers the most capable model (Opus) by default, because a weaker model's rework and wrong turns cost more than the tokens saved, and control cost with spend limits instead.

In the Claude admin console (claude.ai, admin settings):

1. **Seats.** Give each citizen developer a seat that includes Claude Code. Claude Code usage draws on the member's seat allowance, which depends on the seat tier [check your contract].
2. **Group.** Create a group, e.g. *Deal team builders*, and add them. Groups let you set limits and defaults once.
3. **Model default.** Set the group's default model to Opus. The repository also defaults Claude Code to Opus (`.claude/settings.json`).
4. **Spend limits.** Set limits at three levels: organization, group (applies **per person** in the group, not as a shared pool), and individual overrides for outliers. Start with the group limit; raise individuals on request. A person can never exceed the organization limit.
5. **Alerts.** Admins are alerted at 75% and 90% of the organization limit; members see notices as they approach theirs and can ask for an increase.
6. **Optional: enforce settings centrally.** Server-managed Claude Code settings from the admin console can enforce rules (such as permission rules) on every company device, on top of the repository's settings.

**About the cost line in approval requests.** "Estimated Claude cost: ~$X at API list prices" adds up the tokens in the person's local Claude Code session and prices them at Anthropic's pay-as-you-go rates. On Enterprise seats you don't pay those rates, so treat it as a *relative* measure of effort (useful for spotting outliers), not a bill. Long sessions re-read their whole context on every turn, so they cost far more than short ones; one session per extension is cheaper. The admin console is the source of truth.

## 4. Day to day

- **Approving (business approvers).** Open the approval request. Read the plain-English summary and the lane comment, open the **live preview** or the screenshots, and check it does what it says. Approve, or *Request changes* with a sentence the citizen can pass to Claude. Green-lane changes go live on approval.
- **Reviewing (engineers).** The lane comment says why it came to you. Approving the latest version clears `engineer-approval`; a new push needs a new approval.
- **Engineering requests.** Citizens' requests for things extensions can't do arrive as issues labelled `engineering-request`.
- **Weekly metrics.** The *Weekly metrics* issue updates every Monday; run it any time from *Actions → Weekly metrics → Run workflow*.
- **Retiring extensions.** The *Extensions* page flags any extension unchanged for 90 days. To retire one, delete its folder in a pull request; that's a change to one extension folder, so it takes the green lane.
- **Rotating the API key.** Create a new key, replace the repository secret, then revoke the old key.
- **Reset demo data.** Wipes every table, including the audit trail, and reloads the demo data, then records who reset it. It's allowed in development and Codespaces, and refused in the production image unless the server is started with `COVENANT_ALLOW_RESET=1` (set `COVENANT_ALLOW_RESET=0` to refuse it anywhere).

## 5. Engineer mode

The guard in Claude Code stops edits outside `extensions/`. Engineers switch it off for themselves, either per session (`COVENANT_ENGINEER=1 claude`) or permanently for their copy by creating `.claude/settings.local.json` (never committed):

```json
{ "env": { "COVENANT_ENGINEER": "1" } }
```

Engineer mode only changes the guard. The automatic checks and approvals still apply to everyone's changes.

**First run in a new copy.** Claude Code asks once whether to trust the project folder. Until someone accepts, it ignores the project's list of pre-approved commands and asks before each one; the guard and the blocked commands apply either way.

## 6. Admin override (dry runs only)

While there is only one engineer, review-lane changes the engineer authored can't get an engineer approval (nobody approves their own work). For dry runs and the initial merge, a repository admin can tick **Merge without waiting for requirements to be met (bypass rules)** on the pull request. With a ruleset, that option only appears if *Repository admin* is on the ruleset's bypass list. GitHub records who did it. Don't use it for citizens' changes; add a second engineer and tick **Do not allow bypassing** before real use.

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Every change is in the review lane with "The AI review didn't finish" | No `ANTHROPIC_API_KEY` secret, or the key was rejected | Add or rotate the secret (section 1.4) |
| Green-lane change approved but not merged | Auto-merge not allowed in the repository | Section 1.2; or press *Merge* |
| "Squash and merge" blocked though approved | A required check is still running or failed | Open the *Checks* tab; failures explain themselves in plain English |
| A citizen can't send for approval (`git push` denied) | Not a collaborator with Write | Section 1.5 |
| Business approver's approval doesn't count | Not in CODEOWNERS, or no write access | Section 2 |
| `engineer-approval` stays red after an engineer approved | Approval was on an older version, or the engineer isn't in `approvers.json` | Approve the latest version; check the JSON |
| Codespace stops after a while | Idle timeout | Reopen it; the preview restarts automatically |
