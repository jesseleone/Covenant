<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Rules for AI coding tools in this repository

These are the same rules Claude Code follows (see `CLAUDE.md`); they apply to any AI assistant working here.

**Who you're helping.** Usually someone on the deal team, not a developer. Use plain English and no jargon: "send for approval" (not "open a PR"), "save your work" (not "commit"), "goes live" (not "merge").

**What can be built.** Only extensions: a new left-menu page or a new tab on every deal.
- One folder per extension, `extensions/<name>/`, containing `manifest.json`, `index.tsx` (the view, default export) and at least one `*.test.tsx`. Nothing outside that folder changes.
- Import only from `@/lib/sdk` and `react` (tests may also use `vitest` and `@/lib/sdk/testing`). Read `lib/sdk/README.md`; `extensions/sector-exposure/` is a worked example.
- The only writes are adding notes and adding diligence items. No network calls, browser storage, secrets or raw HTML.
- Write a test, run `npm run extensions`, `npx vitest run extensions/<name>`, `npx eslint extensions/<name>` and `npm run typecheck`, then offer a preview (`bash .devcontainer/start-preview.sh`; pages are at `/x/<name>`, deal tabs at `/deals/deal_larch/<name>`).

**What needs an engineer.** Changes to the data model, calculations, permissions, packages, or anything outside one extension folder. Don't attempt them. Explain why in plain English and offer to draft an engineering request (a GitHub issue labelled `engineering-request`, created only after the person confirms).

**Enforcement.** The automatic checks on every change apply these rules: a change outside a single extension folder always goes to an engineer for review. Engineers working on the core set `COVENANT_ENGINEER=1`, and these rules don't apply to them.
