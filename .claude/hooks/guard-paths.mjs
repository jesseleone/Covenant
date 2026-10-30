#!/usr/bin/env node
// PreToolUse hook for Edit, Write, MultiEdit and NotebookEdit.
//
// Citizen developers build only inside one extension folder
// (extensions/<name>/). This hook stops Claude from changing any other file in
// the project, with a plain-English explanation. Engineers set
// COVENANT_ENGINEER=1 to switch it off.
//
// It is a convenience guard, not the real enforcement: commands run in the
// terminal can still change files. The real enforcement is CI, which sends any
// change outside a single extension folder to an engineer for review.
//
// Input: the hook event as JSON on stdin. Exit 0 = allow; exit 2 = block
// (stderr is shown to Claude, which explains it to the person).

import { readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

if (process.env.COVENANT_ENGINEER === "1") process.exit(0);

let event;
try {
  event = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // Not a hook payload we understand: don't get in the way.
}

const input = event.tool_input ?? {};
const target = input.file_path ?? input.notebook_path;
if (!target) process.exit(0);

const project = path.resolve(process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd());
const file = path.resolve(event.cwd || project, target);
const inside = (dir) => file === dir || file.startsWith(dir + path.sep);

// Claude Code's own notes and plans, and scratch files, are not part of the app.
const claudeHome = path.resolve(process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), ".claude"));
// (On macOS /tmp is really /private/tmp, where Claude Code keeps its scratch files.)
if ([claudeHome, path.resolve(tmpdir()), "/tmp", "/private/tmp"].some(inside)) process.exit(0);

const extensions = path.join(project, "extensions");
if (inside(extensions) && file !== extensions) {
  // One level down is the extension's own folder; anything there is fine.
  process.exit(0);
}

const shown = inside(project) ? path.relative(project, file) : file;
process.stderr.write(
  [
    `Blocked: ${shown} is outside the extensions folder.`,
    "In Covenant, Claude can only add or change files inside one extension folder (extensions/<name>/).",
    "Everything else (the data, calculations, permissions and the app's own screens) is looked after by engineers, so a mistake there can't affect the rest of the fund.",
    "Tell the person in plain English why this needs an engineer, and offer to write an engineering request for them instead.",
  ].join("\n") + "\n",
);
process.exit(2);
