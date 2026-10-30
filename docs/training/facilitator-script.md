# Facilitator script

What to say (in quotes), what to do (→), and what to do if something goes wrong (⚠). Times are cumulative. Speak plainly; avoid "PR", "commit", "branch" and "merge". The participants will see those words on GitHub, so explain them once ("GitHub calls an approval request a *pull request*").

## Preparation (the day before)

1. → Follow the checklist in the [session plan](session-plan.md).
2. → **Stage the core change** (needs engineer mode on your machine, see the [admin runbook](../admin-runbook.md#5-engineer-mode)):
   ```bash
   git switch -c demo/leverage-change main
   # edit lib/selectors.ts: e.g. in totalLeverage(), add a comment or a small change to how funded debt is counted
   git commit -am "Count the revolver in total leverage (demo)"
   git push -u origin demo/leverage-change
   gh pr create --base main --title "Count the revolver in total leverage (demo)" --body "Staged for training: a change to a calculation."
   ```
   → Wait for the checks; confirm the label is **lane: review** and the comment says *"This change edits the deal calculations … so an engineer needs to review it."* Don't merge it; close it after the session.
3. → **Rehearse the one-pager** once in a throwaway Codespace, then delete that extension. Save screenshots of each step as fallbacks. Note how long Claude takes (usually 3–6 minutes to build).
4. → Prepare the prompt in a note to paste:
   > *I'd like a new tab on each deal called "Deal one-pager" that summarises the deal on one page for IC: borrower and sponsor, stage, facility size and our hold, leverage, cushion against the covenant, spread, open red flags, and the latest note. It should only show information, no editing.*

## 0:00 Why and how (slides 1–7)

"Covenant is our underwriting app. Today you'll learn to add your own screens to it by describing them to Claude, without writing code."

"You can build two kinds of things: a page in the left menu, or a tab that appears on every deal. We call these extensions."

→ Show **Sector exposure** in the app (left menu → Extensions). "One of us built this. It reads our data and shows it differently. It can't change any numbers."

"Every change goes through one of two lanes." → Slide 5.
- "**Green lane**: the change only adds or edits your screen. Automatic checks run, an AI reviews it, one business approver looks at it, and it goes live by itself."
- "**Review lane**: anything that touches the core (how leverage is calculated, who can do what, the data itself) goes to an engineer first. Claude will tell you when that's the case, and can write the request to the engineers for you."

"Why the guardrails? Our numbers drive investment decisions. A screen can't break them; a calculation could. So screens are yours, and the engine stays with engineering."

## 0:10 Live walkthrough (slides 8–10)

1. → Show your Codespace. "This is your workspace. It runs in the browser. It has its own copy of Covenant with demo data, so you can't break anything real."
2. → In the terminal: `claude` (already signed in). Paste the one-pager prompt.
3. → Claude asks a few questions. Answer briefly out loud. It writes a plan (**What it does / Out of scope / Open questions**). "It always shows you the plan first. Read it; this is where you catch misunderstandings." → Type **yes**.
4. → While it builds (narrate): "It's only working in one folder for this screen. It's writing a test as well, which is a small program that checks the numbers appear correctly."
5. → When it offers a preview, say **"show me"**. Open the link, sign in as Jordan, open Project Larch → **Deal one-pager**. Walk through it.
   ⚠ If the build is slow (over 6 minutes) or goes wrong: "This is why we preview before shipping." Switch to the pre-built branch and continue from the preview.
6. → Type **ship it**. "It runs every check, saves the work and sends it for approval." Open the link it gives.
7. → On GitHub (the approval page): point out the **plain-English summary**, the **estimated cost** line, the **AI-authored** record, the checks running, the **lane: green** label and the lane comment, the **AI review** comment, and the **Open in Codespaces** preview button.
8. → Ask your business approver to approve on their device. "One approval and it goes live automatically." Refresh after the checks finish: merged.
   ⚠ If checks take long, move to step 9 and come back.
9. → **The core change.** In Claude, ask: *"Can you change the leverage calculation to include the revolver?"* Claude explains it needs an engineer and offers an engineering request. Say "yes, draft it" to show the draft; don't create it unless you want to.
10. → Open the staged pull request: **lane: review**, and the comment *"This change edits the deal calculations… an engineer needs to review it."* "Same process, different lane. Nothing reaches the app until an engineer approves."

## 0:25 Hands-on (slide 11)

→ "Open your workspace, type `claude`, pick one idea from the starter ideas, and get to a preview. Put your hand up (or say so in chat) when you see it."

→ Circulate. Common snags:
- *Workspace still starting*: it takes a few minutes the first time; meanwhile read the starter ideas.
- *Claude asks to approve a command*: fine to say yes for anything in the cheat sheet's list; if unsure, ask.
- *"Blocked: … outside the extensions folder"*: Claude tried to change the core; tell it to stay inside the extension, or ask for an engineering request.
- *Preview link doesn't open*: open the **Ports** tab and click the globe next to "Covenant preview".

## 0:40 Wrap-up (slides 12–13)

→ Two or three people share their screen and show their preview.

"Four things to remember: describe what you want; say 'show me' to preview; say 'ship it' to send it for approval; and if Claude says it needs an engineer, ask it to write the engineering request."

→ Point to the [cheat sheet](cheat-sheet.md) and [office hours](office-hours.md). Close the staged pull request after the session.
