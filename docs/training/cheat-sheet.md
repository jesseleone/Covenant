# Covenant extensions: cheat sheet

**What you can build:** a new page in the left menu, or a new tab on every deal. It can show any of the fund's data in Covenant, and can add notes and diligence items. It can't change calculations, terms, stages or permissions; that's for engineers.

## Getting started

1. Open the project on GitHub and click **Open in GitHub Codespaces** (first time: a few minutes). It uses your own free Codespaces hours.
2. Covenant opens in a tab called **Covenant preview** with demo data. Sign in as any persona.
3. In the terminal at the bottom, type **`claude`** and press Enter. Sign in with your company Claude account. If asked whether to trust the folder, say yes.

## What to say to Claude

| You want to… | Say |
|---|---|
| Build something | Describe it: what it shows, who uses it, and whether it's a page or a deal tab. *"I'd like a page that lists every deal with an IC date in the next two weeks."* |
| Check the plan | Read the plan Claude shows you (What it does / Out of scope / Open questions), then say **yes** or what to change. |
| See it | **"show me"** (Claude gives you a link) |
| Change it | Just say what's wrong: *"make the leverage column first"*, *"hide passed deals"*. |
| Send it for approval | **"ship it"** |
| Something it says needs an engineer | **"write an engineering request"** |
| Start over | *"Let's start a new extension"*, or close the terminal and type `claude` again |

## The two lanes

- 🟢 **Green lane**: only your extension changed and everything passed. One business approver approves it, and it goes live automatically.
- 🟠 **Review lane**: something outside your extension changed, a check failed, or the AI review found a serious problem. An engineer looks at it first. The approval page says why, in plain English.

## Good to know

- Claude shows you a plan before building, writes a test, and offers a preview. Read the plan; it's where misunderstandings get caught.
- If you see **"Blocked: … is outside the extensions folder"**, Claude tried to change the core. That's the guardrail working. Ask it to stay in your extension, or to write an engineering request.
- Claude may ask before running a command. Commands for testing, previewing and sending for approval are pre-approved; if it asks about something else and you're not sure, ask in office hours.
- The approval page shows an **estimated Claude cost** at list prices. It's a rough guide, not a bill. Shorter sessions cost less: one session per extension.
- Your workspace has demo data only. Nothing you do there affects the real app until it's approved.

**Help:** office hours (see [office-hours.md](office-hours.md)), or ask an engineer.
