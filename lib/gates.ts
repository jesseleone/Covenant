// Stage gates: what must be true before a deal enters a stage.

import { STAGES, STAGE_LABELS, type DB, type Deal, type Stage } from "@/lib/schema";
import { activeTermSet, termSetsFor, tranchesFor } from "@/lib/selectors";

export type GateItem = { label: string; href: string };
export type GateResult = { ok: boolean; unmet: GateItem[]; hard: boolean };

/** Gates that can't be overridden. */
export const HARD_GATES: Stage[] = ["documentation"];

const tab = (deal: Deal, t: string) => `/deals/${deal.id}/${t}`;

/** Unmet requirements for entering one specific stage. */
export function requirementsFor(db: DB, deal: Deal, stage: Stage): GateItem[] {
  const unmet: GateItem[] = [];
  switch (stage) {
    case "sourced":
      break;
    case "screening":
      if (!deal.borrowerCompanyId) unmet.push({ label: "Set the borrower", href: tab(deal, "overview") });
      if (!deal.strategy) unmet.push({ label: "Set the strategy", href: tab(deal, "overview") });
      break;
    case "term_sheet": {
      const ts = activeTermSet(db, deal.id);
      if (!ts || tranchesFor(db, ts.id).length === 0) unmet.push({ label: "Draft a term set with at least one tranche", href: tab(deal, "securities") });
      break;
    }
    case "diligence":
      if (!termSetsFor(db, deal.id).some((t) => t.status === "issued" || t.status === "locked"))
        unmet.push({ label: "Issue term set v1", href: tab(deal, "securities") });
      break;
    case "ic": {
      const memo = db.memos.find((m) => m.dealId === deal.id && m.memoType === "final" && m.status === "ready_for_ic");
      if (!memo) unmet.push({ label: "Mark the final IC memo ready for IC", href: tab(deal, "memo") });
      const open = db.ddItems.filter((d) => d.dealId === deal.id && d.kind === "finding" && d.severity === "red_flag" && !d.mitigant && !d.icConditionId);
      for (const d of open) unmet.push({ label: `Add a mitigant or IC condition: ${d.title}`, href: tab(deal, "diligence") });
      break;
    }
    case "documentation": {
      const approved = db.icEvents.some((e) => e.dealId === deal.id && e.stage === "final" && e.status === "decided" &&
        (e.decision === "approve" || e.decision === "approve_with_conditions"));
      if (!approved) unmet.push({ label: "Final IC approval (Approve or Approve with conditions)", href: tab(deal, "ic") });
      break;
    }
    case "closed": {
      const openPreClose = db.icConditions.filter((c) => c.dealId === deal.id && c.type === "pre_close" && c.status !== "satisfied");
      for (const c of openPreClose) unmet.push({ label: `Satisfy pre-close condition: ${c.description}`, href: tab(deal, "ic") });
      const kyc = db.ddItems.find((d) => d.dealId === deal.id && d.workstream === "kyc");
      if (!kyc || kyc.status !== "closed") unmet.push({ label: "Clear KYC", href: tab(deal, "diligence") });
      break;
    }
  }
  return unmet;
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
