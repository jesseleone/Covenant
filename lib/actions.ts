"use client";

// Domain actions: the only way the UI changes data. Each goes through
// `commit`, which checks the role's permission, applies the change to a copy
// of the DB and appends AuditEvents.

import { nextThursday, parseISO, format } from "date-fns";
import { PASS_REASON_LABELS, STAGE_LABELS, type AuditEvent, type DB, type PassReason, type Stage } from "@/lib/schema";
import { evaluateGate } from "@/lib/gates";
import { canMoveStage } from "@/lib/permissions";
import { activeTermSet } from "@/lib/selectors";
import { commit, newId, nowIso, type ActionResult } from "@/lib/store";

const fail = (error: string): ActionResult => ({ ok: false, error });

type AuditDraft = Omit<AuditEvent, "id" | "actorId" | "at">;

/** The next IC meeting: committees sit on Thursdays. */
export const nextIcMeeting = (db: DB) => format(nextThursday(parseISO(db.settings.today)), "yyyy-MM-dd");

/**
 * Move a deal to `to`. Gates are re-checked here: an unmet soft gate needs an
 * `overrideReason`; an unmet hard gate can't be overridden. Moving a passed or
 * lost deal back onto the board reopens it.
 */
export function moveStage(dealId: string, to: Stage, overrideReason?: string): ActionResult {
  return commit("move_stage", (db, actor) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) return fail("Deal not found.");
    const reopening = deal.status !== "active" && deal.status !== "closed";
    if (deal.stage === to && !reopening) return fail(`Already in ${STAGE_LABELS[to]}.`);
    if (!canMoveStage(actor.role, to)) return fail(`Your role can't move deals into ${STAGE_LABELS[to]}.`);

    const gate = evaluateGate(db, deal, to);
    if (!gate.ok && gate.hard) return fail(`${STAGE_LABELS[to]} requires: ${gate.unmet.map((u) => u.label).join("; ")}`);
    if (!gate.ok && !overrideReason?.trim()) return fail("Requirements not met. Give a reason to move anyway.");

    const from = deal.stage;
    const at = nowIso();
    deal.stage = to;
    deal.stageEnteredAt = at;
    if (reopening) {
      deal.status = "active";
      deal.passReason = undefined;
      deal.passNote = undefined;
    }
    if (to === "closed") {
      deal.status = "closed";
      deal.closedAt = db.settings.today;
    }

    db.stageEvents.push({ id: newId("se"), dealId, from, to, userId: actor.id, at, overrideReason: gate.ok ? undefined : overrideReason });

    const audit: AuditDraft[] = [{
      action: "stage.move", entity: { type: "deal", id: dealId }, dealId, field: "stage",
      before: STAGE_LABELS[from], after: STAGE_LABELS[to],
      summary: `${reopening ? "Reopened and moved" : "Moved"} from ${STAGE_LABELS[from]} to ${STAGE_LABELS[to]}${gate.ok ? "" : ` (override: ${overrideReason})`}`,
    }];

    // Entering IC schedules the final committee for the current memo and terms.
    if (to === "ic" && !db.icEvents.some((e) => e.dealId === dealId && e.stage === "final" && e.status === "pending")) {
      const memo = db.memos.filter((m) => m.dealId === dealId && m.memoType === "final").sort((a, b) => b.version - a.version)[0];
      const date = nextIcMeeting(db);
      const id = newId("ic");
      db.icEvents.push({
        id, dealId, stage: "final", date: `${date}T15:00:00.000Z`, memoId: memo?.id, termSetId: activeTermSet(db, dealId)?.id,
        status: "pending", votes: [], qa: [],
      });
      audit.push({ action: "ic.schedule", entity: { type: "ic_event", id }, dealId, summary: `Scheduled final IC for ${format(parseISO(date), "d MMM yyyy")}` });
    }
    return audit;
  });
}

export type Outcome = "passed" | "lost" | "on_hold";

/** Take a deal off the active board. Passed and lost need a reason code. */
export function setDealOutcome(dealId: string, outcome: Outcome, note: string, reason?: PassReason): ActionResult {
  return commit("move_stage", (db) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) return fail("Deal not found.");
    if (outcome !== "on_hold" && !reason) return fail("Choose a reason code.");
    if (!note.trim()) return fail("Add a note explaining the decision.");
    const before = deal.status;
    deal.status = outcome;
    deal.passReason = outcome === "on_hold" ? undefined : reason;
    deal.passNote = note.trim();
    deal.stageEnteredAt = nowIso();
    const label = outcome === "on_hold" ? "on hold" : outcome;
    return [{
      action: "deal.outcome", entity: { type: "deal", id: dealId }, dealId, field: "status", before, after: outcome,
      summary: `Marked ${label}${reason ? ` – ${PASS_REASON_LABELS[reason]}` : ""}: ${note.trim()}`,
    }];
  });
}

export function reopenDeal(dealId: string): ActionResult {
  return commit("move_stage", (db) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) return fail("Deal not found.");
    if (deal.status === "active" || deal.status === "closed") return fail("This deal is not passed, lost or on hold.");
    const before = deal.status;
    deal.status = "active";
    deal.passReason = undefined;
    deal.passNote = undefined;
    deal.stageEnteredAt = nowIso();
    return [{ action: "deal.reopen", entity: { type: "deal", id: dealId }, dealId, field: "status", before, after: "active", summary: `Reopened the deal at ${STAGE_LABELS[deal.stage]}` }];
  });
}

export function updateDealText(dealId: string, field: "summary" | "thesis", value: string): ActionResult {
  return commit("edit_deal", (db) => {
    const deal = db.deals.find((d) => d.id === dealId);
    if (!deal) return fail("Deal not found.");
    if ((deal[field] ?? "") === value) return [];
    deal[field] = value;
    return [{ action: "deal.edit", entity: { type: "deal", id: dealId }, dealId, field, summary: `Edited the ${field}` }];
  });
}
