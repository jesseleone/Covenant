# A paved road for citizen developers

*How a credit fund can let its deal team build software with an AI coding agent, safely. Worked example: Covenant, the fund's underwriting app.*

## 1. The idea, in plain language

Deal teams constantly want small tools: a one-page deal summary, a view of sector exposure, a checklist before IC. Engineers are few, so these requests wait. AI coding agents such as Claude Code now let someone who can't code describe a screen and get working software. The question is no longer *can* they build it, but *how do we let them without putting the fund's data and numbers at risk?*

**A harness** is everything wrapped around the AI agent to steer it: written instructions ("build only views; talk in plain English"), step-by-step routines ("plan it, confirm it, build it, test it"), a list of allowed commands, and a guard that refuses to touch protected files. It makes the agent behave well by default.

**An SDLC** (software development lifecycle) is the path every change takes from idea to live: plan, build, test, review, approve, release, measure. In most firms it's how engineers' work reaches production safely.

**Why a harness alone isn't enough.** A harness runs on one person's computer, inside one conversation. It can be misconfigured, switched off or talked around, and it leaves no shared record. The SDLC is what makes the rules *binding*: every change goes through the same automatic checks, an independent AI review, a named human approver and a permanent record. The harness keeps people on the road; the SDLC is the road's guardrail and toll booth.

**Keeping cost and quality in check.** Most requests are small and self-contained, typically a new view of existing data. Those flow through a **green lane**: checks pass, one business approver signs off, and the change goes live automatically. The risky few touch calculations, data or permissions. Those are routed to an engineer, the **review lane**. Engineers spend their time where it matters (the Pareto principle) instead of on every chart. On cost: cap the budget, not the brains. Admins set spend limits per organization, group and person, and everyone uses the most capable model, because rework costs more than tokens.

## 2. How it works: this repository as the example

The core idea is to give citizens a deliberately *small* codebase. What a citizen works in is **one folder**, `extensions/<name>/`, holding a manifest, one screen and a test. That folder talks to the rest of Covenant only through **`lib/sdk`**, a single module that engineers own and which is roughly the size of a short API reference. It offers read-only data (deals, terms, diligence, notes), the app's own calculations (leverage, cushion), exactly two writes (add a note, add a diligence item) and the shared UI components. The core (data model, calculations, permissions, server actions, audit) is out of reach. A citizen never needs to understand it, and the agent never needs to read it. A small surface is what makes an AI agent reliable for a non-expert. It's also what makes a business person's approval meaningful: they're approving a screen they can see, not a diff.

| Stage | What happens | Enforced by |
|---|---|---|
| Workspace | One click opens a Codespace (or the same dev container on a laptop): app, Postgres with demo data, Claude Code. No production data or secrets. | `.devcontainer/` |
| Plan and build | The **new-extension** skill asks a few questions, writes `SPEC.md`, waits for a yes, builds inside the folder, writes a test, offers a preview. | `CLAUDE.md`, skills, settings |
| Guard | Edits outside `extensions/` are refused with a plain-English reason and an offer to file an engineering request. A convenience, not a security boundary. | Claude Code `PreToolUse` hook |
| Static rules | Extensions may import only the SDK and React; no network, storage, secrets or raw HTML. | ESLint rule, tested |
| Runtime rules | Every write is a named server action that checks the person's role and writes an audit row; locked term sets and audit rows are protected by database triggers. | Server, Postgres |
| Ship | The **ship-it** skill runs all checks, saves the work on its own branch with audit trailers, and opens a pull request with a plain-English summary, predicted lane, estimated cost and an AI-authored record. | Skill, PR template |
| Checks | Type check, lint, tests against real Postgres, build. | GitHub Actions |
| AI review | Claude Opus reviews the diff against the rules, security and correctness, and ends with `AI-REVIEW-VERDICT: none / minor / serious`. | `claude-code-action` |
| Lane | Green only if every changed file is in one extension folder, all checks pass and the verdict isn't serious; otherwise review. The rules run from the base branch, so a change can't rewrite its own classification. A missing verdict means review. | Lane classifier |
| Approval | Green: one business approver (code owner of `extensions/`, never the author), then auto-merge. Review: an engineer must approve the latest commit. | CODEOWNERS, branch protection, `engineer-approval` check |
| Measure | A weekly issue reports time to first safe deployment per citizen, lane mix, first-pass check rate, reverts and average estimated cost. | Scheduled workflow |

**Defence in depth.** No single layer is trusted. The guard can be bypassed from the terminal; the ESLint rule can't. ESLint is static and could in principle be evaded by obfuscation; the AI review and human approver read the change. Even a malicious extension can only call the two allowed writes, and the server still checks permissions on those.

**What production would add.** Real sign-in (SSO) instead of personas; per-user data visibility (today an extension can read whatever the app shows); a production deploy step after merge; running extensions in an isolated frame; and an organization account so approvers are GitHub teams, not names.

## 3. State of play

**What works today.** Agents reliably build small, bounded features from a plain description, especially against a clear API and with tests to check their work. CI, branch protection and code owners are mature and free on GitHub. Cloud dev environments remove setup entirely. Admin spend controls now exist at organization, group and user level, with alerts at 75% and 90% ([Anthropic, July 2026](https://claude.com/blog/giving-admins-more-visibility-and-control-over-claude-usage-and-spend)).

**What doesn't, yet.** Review is the bottleneck: agents produce changes faster than people can read them, which is why low-risk work needs a lane that doesn't wait for engineers. Non-engineers can't judge code, so their approval must be about *behaviour* (previews, screenshots), with code judged by tests and AI review. Guardrails on a laptop are advisory. Per-change cost is an estimate from local logs, not a bill.

**Who's doing it.**
- Anthropic's own non-engineering teams use Claude Code: legal built internal routing and review-tracking tools, a one-person growth marketing team automated ad workflows, and product designers ship front-end changes directly ([How Anthropic teams use Claude Code](https://www-cdn.anthropic.com/58284b19e702b49db9302d5b6f135ad8871e7658.pdf)).
- Stripe's internal agents reportedly open over 1,300 pull requests a week, all human-reviewed ([InfoQ, March 2026](https://infoq.com/news/2026/03/stripe-autonomous-coding-agents/)). That is engineers, not citizens, but it shows the same review-gated pattern.
- Gartner reports business users and citizen developers asking for coding agents like Claude Code, and recommends two layers of governance: development controls plus pre-deployment validation [unverified: Gartner pages not accessible; seen in search summaries].
- Gartner predicts that by 2027 over 65% of engineering teams using agentic coding will treat IDEs as optional, moving control to automated platforms [unverified].

**Tools and categories.**

| Category | Examples | Role here |
|---|---|---|
| Coding agents | Claude Code, GitHub Copilot coding agent, OpenAI Codex, Cursor, Devin | The builder |
| Agent guardrails and governance | Claude Code settings, hooks and managed settings; Claude admin spend and model controls; AI-agent governance platforms | The harness and budget |
| CI security scanning | GitHub CodeQL, Dependabot, Semgrep, Snyk | Natural next additions to the checks |
| Low-code platforms | Microsoft Power Apps, Retool, OutSystems | The alternative: safer by construction, but a second stack outside the app |
| Dev environments | GitHub Codespaces, Dev Containers, Ona (formerly Gitpod), Coder | The workspace |

The approach here sits between low-code and full engineering: the deal team builds inside the real app, with the same review discipline engineers use, scaled to the risk of each change.
