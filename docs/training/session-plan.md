# Training session: build your first Covenant extension (45 minutes)

**For:** people on the deal team who will build with Claude Code (analysts, associates, VPs). No coding experience needed.
**Goal:** everyone leaves having built and previewed an extension, and knowing how to send it for approval and when they'll need an engineer.
**Format:** in person or video call; everyone on a laptop with a browser.
**Materials:** [slides](slides.md), [facilitator script](facilitator-script.md), [cheat sheet](cheat-sheet.md) (hand out), [starter ideas](starter-ideas.md), [office hours](office-hours.md).

## Agenda

| Time | Block | What happens |
|---|---|---|
| 0:00–0:10 | **Why and how** | What you can build (a page in the left menu, a tab on every deal). The two lanes: green (one business approver, live automatically) and review (an engineer looks first). Why the guardrails exist: the numbers drive investment decisions, so the core (data, calculations, permissions) stays with engineers. |
| 0:10–0:25 | **Live walkthrough** | The facilitator builds a **Deal one-pager** tab end to end: open Codespaces, describe it, confirm the plan, preview, ship it. Then shows the approval page: checks, lane label, AI review, approval, live. Then a staged request to change a calculation, which Claude declines (it offers an engineering request) and which lands in the review lane. |
| 0:25–0:40 | **Hands-on** | Everyone opens their workspace and builds one idea from [starter ideas](starter-ideas.md), or their own if it fits. Facilitator and a helper circulate. Goal: a working preview; sending for approval is optional. |
| 0:40–0:45 | **Wrap-up** | Two or three people show their preview. Recap the four phrases (describe, "show me", "ship it", "write an engineering request"). Point to the cheat sheet and office hours. |

## Before the session (facilitator)

Do these the day before; the [facilitator script](facilitator-script.md) has detail.

- [ ] Everyone has a GitHub account, has been added to the repository with **Write** access, and has a Claude seat with Claude Code. Send the [cheat sheet](cheat-sheet.md) in advance.
- [ ] Ask everyone to click **Open in GitHub Codespaces** in the README once before the session, so the first (slow) start is out of the way.
- [ ] Repository ready: `ANTHROPIC_API_KEY` secret set, auto-merge allowed, branch protection on (see [admin runbook](../admin-runbook.md)).
- [ ] A business approver (not you) is available during the walkthrough to approve the one-pager live, with GitHub open on their phone or laptop.
- [ ] Your own Codespace is open, warmed up, signed in to Claude, with the preview tab open.
- [ ] The staged core change is ready (an open pull request in the review lane; see the script).
- [ ] Fallbacks ready: screenshots of each walkthrough step, and a finished one-pager on a branch in case the live build stalls.

## Success measures

- Everyone reaches a working preview in the hands-on block.
- Within a week: each person has sent at least one change for approval. Check the *Weekly metrics* issue for "time to first safe deployment".
