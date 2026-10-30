// CI: the preview comment on a pull request (one comment, updated in place):
// an "Open live preview" button that starts a Codespace on the PR's branch,
// and, when extensions changed, a link to their screenshots.
//
//   npx tsx scripts/ci/preview-comment.ts link                → post the button; output the changed extensions
//   npx tsx scripts/ci/preview-comment.ts screenshots <url>   → add the screenshots link
// Env: PR_NUMBER, HEAD_REPO, HEAD_REF, GH_TOKEN.

import { readFileSync, existsSync } from "node:fs";
import { changedFiles, prNumber, setOutput, upsertComment } from "./github";

export const PREVIEW_MARKER = "<!-- covenant:preview -->";

/** GitHub's documented link format: https://codespaces.new/OWNER/REPO/tree/BRANCH (+ ?quickstart=1 to resume). */
export const codespacesUrl = (repo: string, branch: string) =>
  `https://codespaces.new/${repo}/tree/${branch.split("/").map(encodeURIComponent).join("/")}?quickstart=1`;

export const changedExtensions = (files: string[]) =>
  [...new Set(files.map((f) => /^extensions\/([^/]+)\//.exec(f)?.[1]).filter((x): x is string => !!x))].filter((slug) => existsSync(`extensions/${slug}/manifest.json`));

export function renderPreview(repo: string, branch: string, extensions: string[], screenshots: "none" | "pending" | { url: string } ) {
  const lines = [
    "### Live preview",
    "",
    `[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](${codespacesUrl(repo, branch)})`,
    "",
    "Opens your own copy of Covenant with this change and the demo data, in the browser. The first start takes a few minutes; it uses your own free Codespaces hours.",
  ];
  if (extensions.length) {
    const pages = extensions.map((slug) => {
      const m = JSON.parse(readFileSync(`extensions/${slug}/manifest.json`, "utf8")) as { name: string; placement: string };
      return `**${m.name}** (${m.placement === "nav" ? `page \`/x/${slug}\`` : `tab on each deal, e.g. \`/deals/deal_larch/${slug}\``})`;
    });
    lines.push("", `Changed extension${extensions.length === 1 ? "" : "s"}: ${pages.join(", ")}.`);
    if (screenshots === "pending") lines.push("", "📸 Screenshots are being taken; this comment updates when they're ready.");
    else if (typeof screenshots === "object") lines.push("", `📸 [Download the screenshots](${screenshots.url}) (light and dark, from this version of the change).`);
  }
  return lines.join("\n");
}

if (process.argv[1]?.endsWith("preview-comment.ts")) {
  const pr = prNumber();
  const repo = process.env.HEAD_REPO || process.env.GITHUB_REPOSITORY || "jesseleone/Covenant";
  const branch = process.env.HEAD_REF || "main";
  const extensions = changedExtensions(changedFiles(pr));
  const mode = process.argv[2];
  if (mode === "screenshots") {
    upsertComment(pr, PREVIEW_MARKER, renderPreview(repo, branch, extensions, process.argv[3] ? { url: process.argv[3] } : "none"));
  } else {
    upsertComment(pr, PREVIEW_MARKER, renderPreview(repo, branch, extensions, extensions.length ? "pending" : "none"));
    setOutput("extensions", extensions.join(","));
  }
}
