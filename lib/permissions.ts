import type { Role, Stage } from "@/lib/schema";

export type Action =
  | "create_record" | "edit_deal" | "review_field" | "add_note" | "edit_dd" | "edit_memo"
  | "mark_memo_ready" | "edit_terms" | "issue_terms" | "record_vote" | "decide_ic" | "move_stage";

const DEAL_TEAM: Action[] = ["create_record", "edit_deal", "review_field", "add_note", "edit_dd", "edit_memo", "move_stage"];
const SENIOR: Action[] = [...DEAL_TEAM, "mark_memo_ready", "edit_terms", "issue_terms"];

const ALLOWED: Record<Role, Action[]> = {
  analyst: DEAL_TEAM,
  associate: DEAL_TEAM,
  vp: SENIOR,
  md: SENIOR,
  ic_member: ["add_note", "record_vote", "decide_ic", "move_stage"],
  compliance: ["add_note"],
};

export const can = (role: Role, action: Action) => ALLOWED[role].includes(action);

/** Stages each role may move a deal into (gates still apply). */
export function canMoveStage(role: Role, to: Stage): boolean {
  if (!can(role, "move_stage")) return false;
  if (role === "analyst" || role === "associate") return to !== "ic" && to !== "documentation";
  if (role === "ic_member") return to === "documentation";
  return true;
}

export const ACTION_DENIED: Record<Action, string> = {
  create_record: "Your role can't create records.",
  edit_deal: "Your role can't edit deal details.",
  review_field: "Your role can't confirm or correct extracted values.",
  add_note: "Your role can't add notes.",
  edit_dd: "Your role can't edit diligence items.",
  edit_memo: "Your role can't edit the memo.",
  mark_memo_ready: "Only a VP or MD can mark the memo ready for IC.",
  edit_terms: "Only a VP or MD can create or edit term-set versions.",
  issue_terms: "Only a VP or MD can issue a term set.",
  record_vote: "Only IC members can vote.",
  decide_ic: "Only IC members can record the IC decision.",
  move_stage: "Your role can't move deals between stages.",
};
