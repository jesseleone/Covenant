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

Fernhill Credit Partners · 45 minutes

---

## Today

1. **Why and how** (10 min)
2. **Live walkthrough**: a Deal one-pager, from idea to live (15 min)
3. **Hands-on**: you build one (15 min)
4. **Wrap-up** (5 min)

---

## What you can build

- A **page in the left menu**, e.g. *Sector exposure*
- A **tab on every deal**, e.g. a one-page IC summary

They **show** the fund's data, and can **add notes** and **add diligence items**.

They can't change calculations, terms, stages or permissions. That's the engine, and engineers look after it.

---

## How it works

1. Open your **workspace** (one click; demo data only)
2. Type `claude` and **describe** what you want
3. Claude shows a **plan**: you say yes
4. Claude **builds and tests** it, and gives you a **preview**
5. Say **"ship it"**: it's sent for approval

---

## Two lanes

| | 🟢 Green lane | 🟠 Review lane |
|---|---|---|
| When | Only your screen changed, all checks passed | Anything touching the core, a failed check, or a serious AI finding |
| Who approves | One business approver | An engineer |
| Then | Goes live automatically | Goes live after the engineer approves |

Most requests are green. The risky few get an engineer's eyes.

---

## Why the guardrails

- Our numbers drive **investment decisions**
- A screen can't change a number; a calculation can
- So: **screens are yours, the engine is engineering's**
- Every change is checked, reviewed by AI, approved by a named person, and recorded

---

## What you'll see on the approval page

- A **plain-English summary** of the change
- The **lane** and why
- **Automatic checks** ✅ and an **AI review**
- An **estimated cost** and an **AI-authored** record
- A **live preview** button and screenshots

---

## Live: the Deal one-pager

> *"A new tab on each deal that summarises it on one page for IC: borrower and sponsor, stage, facility and hold, leverage, cushion, spread, open red flags and the latest note."*

Watch for: the **plan**, the **preview**, **ship it**, the **green lane**, the **approval**.

---

## Live: a change to the engine

> *"Can you change the leverage calculation to include the revolver?"*

- Claude explains why it needs an engineer
- It offers to **write an engineering request**
- A change like this always lands in the **review lane**

---

## The four phrases

| Say | To |
|---|---|
| *Describe it* | build something |
| **"show me"** | preview it |
| **"ship it"** | send it for approval |
| **"write an engineering request"** | ask engineers for what an extension can't do |

---

## Your turn (15 min)

1. Open your workspace (**Open in GitHub Codespaces**)
2. Type `claude`
3. Pick a **starter idea** and paste it
4. Get to a **preview**, then put your hand up

---

## Show and tell

Two or three previews.

---

## After today

- **Cheat sheet**: everything on one page
- **Office hours**: weekly drop-in with an engineer
- **Goal**: send your first change for approval this week
