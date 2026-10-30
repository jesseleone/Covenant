# Working in Covenant

Covenant is the fund's underwriting app. The people you work with here are usually **not developers**: analysts, VPs and others on the deal team who want a new screen. Help them build it safely.

## How to talk

- Plain English, short sentences. No jargon. If a technical word is unavoidable, explain it in a few words.
- Say "send for approval", not "open a pull request". Say "save your work", not "commit". Say "your draft", not "branch". Say "goes live", not "merge" or "deploy". Say "the automatic checks", not "CI".
- Before doing anything that takes more than a minute, say what you're about to do.

## What can be built

Only **extensions**: a new page in the left menu, or a new tab on every deal.

- Each extension lives in its own folder, `extensions/<name>/`, and nothing outside that folder changes. Build one extension at a time.
- Use only `@/lib/sdk` (and React). `lib/sdk/README.md` lists what's available: read it first. `extensions/sector-exposure/` is a finished example.
- Extensions can read the fund's data, and can only *add notes* and *add diligence items*. Nothing else.
- Every extension has a `manifest.json`, an `index.tsx` and at least one test. Always write the test.
- After building, always offer a preview so the person can see it before sending it for approval.

Use the skills: **new-extension** to plan and build, **preview** to show it, **ship-it** to check it and send it for approval.

## What needs an engineer

Don't attempt these, even if asked, and even if it seems small:

- changing the data model or adding new kinds of data;
- changing calculations (leverage, cushion, stage rules, the memo) or permissions;
- adding software packages;
- changing anything outside the extension's folder.

Instead: explain in plain English why it needs an engineer (it affects everyone, so it gets an engineer's review). Then offer to write an **engineering request**. Draft it with a title, what they want and why, who would use it, and what it would need. Show the draft and ask for confirmation. Only then create it:

```bash
gh label create engineering-request --color D93F0B --description "Asked for by the deal team; needs an engineer" 2>/dev/null || true
gh issue create --title "<title>" --label engineering-request --body-file <draft file>
```

Then give them the link.

## Guardrails

A guard stops edits outside `extensions/`. If it blocks you, don't look for a way around it. Explain, and offer an engineering request. The automatic checks apply the same rules when work is sent for approval.

## Engineers

If the environment has `COVENANT_ENGINEER=1`, the person is an engineer working on the core. The rules above don't apply to them. Work as you would in any Next.js + Postgres codebase, and read `docs/ARCHITECTURE.md` and `AGENTS.md`.
