---
marp: true
theme: default
paginate: true
title: Build your own Covenant screens
style: |
  section { font-family: -apple-system, "Segoe UI", sans-serif; color: #1f1e1d; background: #faf9f5; }
  h1, h2 { font-family: Georgia, serif; color: #1f1e1d; }
  strong { color: #c96442; }
  table { font-size: 0.8em; }
---

# Build your own Covenant screens

### Describe it. Preview it. Ship it.

**Describe** · **Preview** · **Ship**

Fernhill Credit Partners · 45-minute training

<!-- Covenant is our underwriting app. Today you'll learn to add your own screens to it by describing them to Claude, without writing code. -->

---

## Today

| | | |
|---|---|---|
| **10 min** | Why and how | What you can build, the two lanes, why the guardrails exist |
| **15 min** | Live walkthrough | A Deal one-pager, from idea to approval |
| **15 min** | Hands-on | You build one from a starter idea |
| **5 min** | Wrap-up | Show and tell, cheat sheet, office hours |

<!-- Four parts, 45 minutes. Most of the time is spent watching it done and then doing it yourself. -->

---

## What you can build

- **A page in the left menu**, e.g. Sector exposure
- **A tab on every deal**, e.g. a one-page IC summary

We call these **extensions**.

**They can:** show any of the fund's data · add notes · add diligence items

**They can't change:** calculations, terms, stages or permissions. That's the engine, and engineers look after it.

<!-- You can build two kinds of things: a page in the left menu, or a tab that appears on every deal. We call these extensions. Show Sector exposure in the app (left menu, then Extensions): one of us built this. It reads our data and shows it differently. It can't change any numbers. -->

---

## How it works

1. **Open your workspace:** one click. Demo data only.
2. **Describe it:** type `claude`, then say what you want.
3. **Approve the plan:** Claude shows a short plan. You say yes.
4. **Preview it:** Claude builds and tests it, then gives you a link.
5. **Ship it:** it's sent for approval.

<!-- This is the whole loop. The plan step is where you catch misunderstandings, so always read it. The preview is a private copy of Covenant with demo data, so you can't break anything real. -->

---

## Two lanes

| | 🟢 Green lane | 🟠 Review lane |
|---|---|---|
| **When** | Only your screen changed, and every check passed | Anything touching the core, a failed check, or a serious AI finding |
| **Who approves** | One business approver | An engineer |
| **Then** | Goes live automatically | Goes live after the engineer approves |

Most requests are green. The risky few get an engineer's eyes.

<!-- Every change goes through one of two lanes. Green lane: the change only adds or edits your screen. Automatic checks run, an AI reviews it, one business approver looks at it, and it goes live by itself. Review lane: anything that touches the core (how leverage is calculated, who can do what, the data itself) goes to an engineer first. Claude will tell you when that's the case, and can write the request to the engineers for you. You don't have to work out the lane yourself; the checks decide. -->

---

## Why the guardrails

Our numbers drive investment decisions.
A screen can't change a number. A calculation can.
**Screens are yours. The engine is engineering's.**

Every change is:
- **Checked:** automatic checks on every change
- **Reviewed by AI:** an independent AI review reads it
- **Approved by a named person:** never the person who asked for it
- **Recorded:** who asked, what changed, which model

<!-- Why the guardrails? Our numbers drive investment decisions. A screen can't break them; a calculation could. So screens are yours, and the engine stays with engineering. And nothing reaches the app without checks, an AI review, a named approver and a record. -->

---

## What you'll see on the approval page

- **Plain-English summary:** what changed, why, and how it was tested
- **The lane, and why:** green or review, explained in a sentence
- **Checks and AI review:** each check ticks off as it passes
- **Estimated cost:** a rough guide; the real bill is in the admin console
- **AI-authored record:** who directed it and which model built it
- **Live preview and screenshots:** one button opens your change to try

<!-- GitHub calls this approval page a pull request. You'll see that word there; it just means 'a change waiting for approval'. Point out each part during the live walkthrough. -->

---

## Live: the Deal one-pager

> A new tab on each deal that summarises it on one page for IC: borrower and sponsor, stage, facility and hold, leverage, cushion, spread, open red flags and the latest note.

**Watch for:** 1. The plan · 2. The preview · 3. Ship it · 4. The green lane · 5. The approval

<!-- Show your Codespace: this is your workspace, it runs in the browser with its own copy of Covenant and demo data. Type claude and paste the one-pager prompt. Claude asks a few questions, then writes a plan (What it does / Out of scope / Open questions). Read it, then type yes. While it builds: it's only working in one folder, and it's writing a test too. When it offers a preview, say 'show me', sign in as Jordan, open Project Larch, then the Deal one-pager tab. Then type 'ship it' and open the approval page: summary, estimated cost, AI-authored record, checks, lane: green, AI review, preview button. Ask the business approver to approve on their device; once checks finish, it's merged. If the build takes over 6 minutes, switch to the pre-built branch and carry on from the preview. -->

---

## Live: a change to the engine

> Can you change the leverage calculation to include the revolver?

- **Claude explains:** it's a calculation, so an engineer must review it
- **It offers a request:** it drafts an engineering request for you to confirm
- **Review lane:** any change like this goes to an engineer first

<!-- In Claude, ask: 'Can you change the leverage calculation to include the revolver?' Claude explains it needs an engineer and offers an engineering request. Say 'yes, draft it' to show the draft; don't create it unless you want to. Then open the staged pull request: lane: review, and the comment 'This change edits the deal calculations... an engineer needs to review it.' Same process, different lane. Nothing reaches the app until an engineer approves. -->

---

## The four phrases

| Say | To |
|---|---|
| *Describe it* | build something |
| **"Show me"** | preview it |
| **"Ship it"** | send it for approval |
| **"Write an engineering request"** | for anything an extension can't do |

<!-- Four things to remember: describe what you want; say 'show me' to preview; say 'ship it' to send it for approval; and if Claude says it needs an engineer, ask it to write the engineering request. -->

---

## Your turn

**15 minutes to a preview**

1. **Open your workspace:** click *Open in GitHub Codespaces* in the README
2. **Type `claude`:** sign in with your company Claude account the first time
3. **Pick a starter idea:** paste it in, then answer Claude's questions
4. **Get to a preview:** then put your hand up

<!-- Open your workspace, type claude, pick one idea from the starter ideas, and get to a preview. Put your hand up (or say so in chat) when you see it. Common snags: the workspace takes a few minutes to start the first time, so read the starter ideas meanwhile. If Claude asks to approve a command, it's fine to say yes for anything in the cheat sheet's list. If you see 'Blocked: outside the extensions folder', Claude tried to change the core; tell it to stay inside the extension, or ask for an engineering request. If the preview link doesn't open, open the Ports tab and click the globe next to 'Covenant preview'. -->

---

## Show and tell

Two or three previews.

<!-- Two or three people share their screen and show their preview. -->

---

## After today

- **Cheat sheet:** everything from today on one page
- **Office hours:** a weekly drop-in with an engineer
- **This week:** send your first change for approval

<!-- Point to the cheat sheet and office hours. The goal is a first change sent for approval this week. Close the staged pull request after the session. -->
