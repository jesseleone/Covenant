// Decides which approval lane a change goes to, with reasons in plain English.
//
// GREEN: every changed file is inside one extensions/<name>/ folder, all
// checks pass, and the AI review didn't find anything serious. One business
// approver signs off, then it goes live automatically.
// REVIEW: everything else. An engineer must approve.
//
// Used by the ship-it skill (to predict the lane) and by CI (to decide it).

export type Lane = "green" | "review";
export type AiVerdict = "none" | "minor" | "serious";

export type LaneInput = {
  /** Changed file paths, relative to the repository root, "/"-separated. */
  files: string[];
  /** false when any automatic check failed; undefined when not yet known. */
  checksPassed?: boolean;
  /** The AI review's verdict; null when it didn't run or gave no verdict. */
  aiVerdict?: AiVerdict | null;
  /** In CI the AI review must have run; a missing verdict means review. */
  requireAiVerdict?: boolean;
};

export type LaneResult = { lane: Lane; extension: string | null; reasons: string[] };

/** What each part of the core is, in words a non-engineer understands. */
const AREAS: [RegExp, string][] = [
  [/^(package\.json|package-lock\.json)$/, "the list of software packages the app uses"],
  [/^db\//, "the database structure"],
  [/^lib\/(selectors|gates|terms|memo|queries)\.ts$/, "the deal calculations (leverage, cushion, stage rules or the memo)"],
  [/^lib\/permissions\.ts$/, "who is allowed to do what"],
  [/^lib\/(actions|chat)\.ts$|^lib\/core\//, "how data is changed and recorded"],
  [/^lib\/server\/|^app\/api\//, "the server and its access to the database"],
  [/^lib\/sdk\//, "the extension toolkit every extension relies on"],
  [/^lib\/llm\//, "how the app's AI answers questions"],
  [/^lib\/schema\.ts$|^lib\/seed\//, "the data model or demo data"],
  [/^\.github\//, "the approval process itself"],
  [/^\.claude\/|^CLAUDE\.md$|^AGENTS\.md$/, "Claude's own guardrails"],
  [/^\.devcontainer\/|^scripts\/|^Dockerfile$|^compose\.yaml$/, "the workspace and tooling"],
  [/^(app|components)\//, "the app's own screens"],
  [/^docs\/|^README\.md$/, "the documentation"],
  [/^[^/]+$/, "the app's configuration"],
];

const areaOf = (file: string) => AREAS.find(([re]) => re.test(file))?.[1] ?? "the core of the app";

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

export function classifyLane({ files, checksPassed, aiVerdict, requireAiVerdict }: LaneInput): LaneResult {
  const reasons: string[] = [];
  const paths = [...new Set(files.map((f) => f.replace(/\\/g, "/").replace(/^\.\//, "")))].filter(Boolean);

  const extensionOf = (f: string) => /^extensions\/([^/]+)\/.+/.exec(f)?.[1] ?? null;
  const folders = [...new Set(paths.map(extensionOf).filter((x): x is string => !!x))];
  const outside = paths.filter((f) => !extensionOf(f));

  if (paths.length === 0) reasons.push("There are no changes to send.");
  if (outside.length) {
    const areas = [...new Set(outside.map(areaOf))];
    const shown = outside.slice(0, 3).join(", ") + (outside.length > 3 ? ` and ${outside.length - 3} more` : "");
    reasons.push(`This change edits ${list(areas)} (${shown}), so an engineer needs to review it.`);
  }
  if (folders.length > 1) reasons.push(`This change touches ${folders.length} extensions (${list(folders)}). Each extension should be sent for approval on its own.`);
  if (checksPassed === false) reasons.push("Some automatic checks failed, so an engineer needs to look at it.");
  if (aiVerdict === "serious") reasons.push("The AI review found a serious problem, so an engineer needs to review it.");
  if (requireAiVerdict && !aiVerdict) reasons.push("The AI review didn't finish, so an engineer needs to review it to be safe.");

  if (reasons.length) return { lane: "review", extension: folders.length === 1 ? folders[0] : null, reasons };
  return {
    lane: "green",
    extension: folders[0],
    reasons: [`Everything is inside the ${folders[0]} extension and nothing else changed, so one business approver can approve it.`],
  };
}
