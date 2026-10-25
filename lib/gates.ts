// Stage gates: what must be true before a deal enters a stage.

import { STAGES, STAGE_LABELS, type DB, type Deal, type Stage } from "@/lib/schema";
import { activeTermSet, termSetsFor, tranchesFor } from "@/lib/selectors";

export type GateItem = { label: string; href: string };
export type GateResult = { ok: boolean; unmet: GateItem[]; hard: boolean };

/** Gates that can't be overridden. */
export const HARD_GATES: Stage[] = ["documentation"];

const tab = (deal: Deal, t: string) => `/deals/${deal.id}/${t}`;

export type ChecklistItem = GateItem & { met: boolean };

/** Every requirement for entering `stage`, met or not. */
export function checklistFor(db: DB, deal: Deal, stage: Stage): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const add = (label: string, t: string, met: boolean) => items.push({ label, href: tab(deal, t), met });
  switch (stage) {
    case "sourced":
      break;
    case "screening":
      add("Borrower set", "overview", !!deal.borrowerCompanyId);
      add("Strategy set", "overview", !!deal.strategy);
      break;
    case "term_sheet": {
      const ts = activeTermSet(db, deal.id);
      add("Term set drafted with at least one tranche", "securities", !!ts && tranchesFor(db, ts.id).length > 0);
      break;
    }
    case "diligence":
      add("Term set v1 issued", "securities", termSetsFor(db, deal.id).some((t) => t.status === "issued" || t.status === "locked"));
      break;
    case "ic": {
      add("Final IC memo marked ready for IC", "memo", db.memos.some((m) => m.dealId === deal.id && m.memoType === "final" && m.status === "ready_for_ic"));
      const flags = db.ddItems.filter((d) => d.dealId === deal.id && d.kind === "finding" && d.severity === "red_flag");
      const open = flags.filter((d) => !d.mitigant && !d.icConditionId);
      if (open.length === 0) add("Every red-flag finding has a mitigant or IC condition", "diligence", true);
      for (const d of open) add(`Add a mitigant or IC condition: ${d.title}`, "diligence", false);
      break;
    }
    case "documentation":
      add("Final IC approval (Approve or Approve with conditions)", "ic", db.icEvents.some((e) => e.dealId === deal.id && e.stage === "final" && e.status === "decided" &&
        (e.decision === "approve" || e.decision === "approve_with_conditions")));
      break;
    case "closed": {
      const pre = db.icConditions.filter((c) => c.dealId === deal.id && c.type === "pre_close");
      if (pre.every((c) => c.status === "satisfied")) add("All pre-close IC conditions satisfied", "ic", true);
      for (const c of pre.filter((c) => c.status !== "satisfied")) add(`Satisfy pre-close condition: ${c.description}`, "ic", false);
      const kyc = db.ddItems.find((d) => d.dealId === deal.id && d.workstream === "kyc");
      add("KYC cleared", "diligence", kyc?.status === "closed");
      break;
    }
  }
  return items;
}

/** Unmet requirements for entering one specific stage. */
export function requirementsFor(db: DB, deal: Deal, stage: Stage): GateItem[] {
  return checklistFor(db, deal, stage).filter((i) => !i.met).map(({ label, href }) => ({ label, href }));
}

/**
 * Evaluate a move from the deal's current stage to `toStage`. Moving forward checks
 * every stage passed through; moving backward is always allowed.
 */
export function evaluateGate(db: DB, deal: Deal, toStage: Stage): GateResult {
  const from = STAGES.indexOf(deal.stage);
  const to = STAGES.indexOf(toStage);
  if (to <= from) return { ok: true, unmet: [], hard: false };
  const unmet: GateItem[] = [];
  let hard = false;
  for (const stage of STAGES.slice(from + 1, to + 1)) {
    const items = requirementsFor(db, deal, stage);
    if (items.length && HARD_GATES.includes(stage)) hard = true;
    unmet.push(...items);
  }
  return { ok: unmet.length === 0, unmet, hard };
}

export const nextStage = (stage: Stage): Stage | null => STAGES[STAGES.indexOf(stage) + 1] ?? null;

export const gateTitle = (stage: Stage) => `Before moving to ${STAGE_LABELS[stage]}`;
