# Office hours

A weekly drop-in for anyone building Covenant extensions.

**When:** 30 minutes, same time each week (e.g. Thursdays 4:00–4:30pm), run by an engineer. Calendar invite to everyone who did the training.
**Bring:** your Codespace open, and the link to your approval request if you have one.

## What it's for

- Getting unstuck: Claude went in circles, a check failed, the preview doesn't show your change.
- Checking an idea *before* building: will it stay in the green lane, or does it need an engineer?
- Turning a "needs an engineer" moment into a good engineering request.
- Showing what you built. Good ideas spread.

## Before you come: quick fixes

| Problem | Try this |
|---|---|
| Preview doesn't show the change | Ask Claude: *"show me"*. It restarts the preview if needed. Reload the page. |
| A check failed on the approval page | Ask Claude: *"the checks failed on my approval request, can you fix it?"*, then *"ship it"* again. It updates the same request. |
| "Blocked: … is outside the extensions folder" | Your request touches the core. Ask: *"write an engineering request"*. |
| Changes were requested by the approver | Paste their comment to Claude, then *"ship it"* again. |
| Claude is confused or slow | Start a fresh session: type `/clear`, or close the terminal and run `claude` again. Then describe what's left to do. |

## Engineering requests

When something needs an engineer, Claude drafts an *engineering request* (a GitHub issue with the label `engineering-request`) and creates it once you confirm. Engineers triage them weekly; you'll get a comment on the issue. In office hours we can sharpen a request together: what you want, why, who uses it, and an example.

## Escalation

- Something looks wrong in the **real** app after a change went live: tell an engineer straight away. Changes can be undone quickly.
- You think data is wrong (not just the screen): that's an engineering request, marked urgent.
