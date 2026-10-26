"use client";

// Domain actions: the only way the UI changes data. Each goes through
// `commit`, which checks the role's permission, applies the change to a copy
// of the DB and appends AuditEvents.

import { nextThursday, parseISO, format } from "date-fns";
import { PASS_REASON_LABELS, STAGE_LABELS, type AuditEvent, type Covenant, type DB, type DDItem, type ICCondition, type ICEvent, type MemoSection, type PassReason, type Stage, type Tranche } from "@/lib/schema";
import { diffTerms, summarizeChanges } from "@/lib/terms";
import { evaluateGate } from "@/lib/gates";
import { canMoveStage } from "@/lib/permissions";
import { activeTermSet, computeSnapshot, sectionIsStale } from "@/lib/selectors";
import { offlineSection } from "@/lib/memo";
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

// ---------------------------------------------------------------------------
// Extraction review: AI proposes, a person confirms or corrects
// ---------------------------------------------------------------------------

const fieldLabel = (db: DB, docId: string, page: number) => {
  const doc = db.documents.find((d) => d.id === docId);
  const short = doc?.docType === "qoe" ? "QoE" : doc?.docType === "cim" ? "CIM" : doc?.docType === "term_sheet" ? "Term sheet" : "Doc";
  return `${short} p.${page}`;
};

const display = (v: number | string, unit: string) =>
  typeof v === "string" ? v : unit === "usd_m" ? `$${v.toFixed(1)}M` : unit === "pct" ? `${v}%` : String(v);

export function confirmField(fieldId: string): ActionResult {
  return commit("review_field", (db, actor) => {
    const f = db.extractedFields.find((x) => x.id === fieldId);
    if (!f) return fail("Value not found.");
    if (f.status !== "proposed") return fail("Already reviewed.");
    f.status = "confirmed";
    f.reviewedBy = actor.id;
    f.reviewedAt = nowIso();
    return [{
      action: "field.confirm", entity: { type: "extracted_field", id: f.id }, dealId: f.dealId, field: f.label,
      before: "proposed", after: "confirmed",
      summary: `Confirmed ${f.label}: ${display(f.value, f.unit)} (${fieldLabel(db, f.documentId, f.page)})`,
    }];
  });
}

export function confirmAllAbove(dealId: string, threshold = 0.9): ActionResult & { count?: number } {
  let count = 0;
  const r = commit("review_field", (db, actor) => {
    const at = nowIso();
    const fields = db.extractedFields.filter((f) => f.dealId === dealId && f.status === "proposed" && f.confidence >= threshold);
    for (const f of fields) { f.status = "confirmed"; f.reviewedBy = actor.id; f.reviewedAt = at; }
    count = fields.length;
    if (count === 0) return fail(`No proposed values at or above ${Math.round(threshold * 100)}% confidence.`);
    return [{
      action: "field.confirm_bulk", entity: { type: "deal", id: dealId }, dealId,
      summary: `Confirmed ${count} extracted value${count === 1 ? "" : "s"} with confidence ≥ ${threshold.toFixed(2)}`,
    }];
  });
  return { ...r, count };
}

/** Find the sentence (or table row) on a page that states `value`, to use as the quote. */
export function findQuote(markdown: string, value: number | string): string | undefined {
  const needle = typeof value === "number" ? value.toFixed(1).replace(/\.0$/, "") : value;
  const variants = typeof value === "number" ? [value.toFixed(1), needle] : [needle];
  const sentences = markdown.split("\n").filter((l) => !l.trim().startsWith("|")).flatMap((l) => l.split(/(?<=\.)\s+/));
  for (const v of variants) {
    const s = sentences.find((x) => x.includes(v));
    if (s) return s.replace(/^[-#*\s]+/, "").trim();
  }
  for (const v of variants) {
    const row = markdown.split("\n").find((l) => l.trim().startsWith("|") && l.includes(v));
    if (row) return row.trim().replace(/^\|\s*|\s*\|$/g, "");
  }
  return undefined;
}

/**
 * Replace an extracted value with a corrected one from another source.
 * The original value and source are kept in `correctedFrom`.
 */
export function correctField(fieldId: string, value: number | string, documentId: string, page: number, note?: string): ActionResult {
  return commit("review_field", (db, actor) => {
    const f = db.extractedFields.find((x) => x.id === fieldId);
    if (!f) return fail("Value not found.");
    const doc = db.documents.find((d) => d.id === documentId && d.dealId === f.dealId);
    const pg = doc?.pages.find((p) => p.n === page);
    if (!doc || !pg) return fail("Choose a source page from this deal's documents.");
    if (typeof f.value === "number" && (typeof value !== "number" || !Number.isFinite(value))) return fail("Enter a number.");

    const before = `${display(f.value, f.unit)} (${fieldLabel(db, f.documentId, f.page)})`;
    f.correctedFrom = { value: f.value, documentId: f.documentId, page: f.page };
    f.value = value;
    f.documentId = documentId;
    f.page = page;
    f.quote = findQuote(pg.markdown, value) ?? f.quote;
    f.status = "corrected";
    f.reviewedBy = actor.id;
    f.reviewedAt = nowIso();
    const after = `${display(value, f.unit)} (${fieldLabel(db, documentId, page)})`;
    return [{
      action: "field.correct", entity: { type: "extracted_field", id: f.id }, dealId: f.dealId, field: f.label, before, after,
      summary: `Corrected ${f.label}: ${before} → ${after}${note?.trim() ? `. ${note.trim()}` : ""}`,
    }];
  });
}

// ---------------------------------------------------------------------------
// Term sets (securities): copy-on-write versions, edited only as drafts
// ---------------------------------------------------------------------------

/** Copy the latest version into a new editable draft. */
export function createTermSetVersion(dealId: string): ActionResult & { termSetId?: string } {
  let termSetId: string | undefined;
  const r = commit("edit_terms", (db, actor) => {
    const sets = db.termSets.filter((t) => t.dealId === dealId).sort((a, b) => a.version - b.version);
    const parent = sets.at(-1);
    if (!parent) return fail("This deal has no term set to copy.");
    if (parent.status === "draft") return fail(`v${parent.version} is still a draft. Issue or discard it first.`);
    termSetId = newId("ts");
    db.termSets.push({
      id: termSetId, dealId, version: parent.version + 1,
      label: parent.label === "ic_approved" || parent.label === "closing" ? "closing" : parent.label,
      status: "draft", parentId: parent.id, createdBy: actor.id, createdAt: nowIso(),
    });
    for (const t of db.tranches.filter((x) => x.termSetId === parent.id)) db.tranches.push({ ...t, id: newId("tr"), termSetId: termSetId! });
    for (const c of db.covenants.filter((x) => x.termSetId === parent.id)) db.covenants.push({ ...structuredClone(c), id: newId("cov"), termSetId: termSetId! });
    return [{ action: "termset.create", entity: { type: "term_set", id: termSetId! }, dealId, summary: `Created term set v${parent.version + 1} (draft) from v${parent.version}` }];
  });
  return { ...r, termSetId };
}

/** Replace a draft's tranches and covenants; the audit entry lists what changed. */
export function saveTermSetDraft(termSetId: string, tranches: Tranche[], covenants: Covenant[]): ActionResult {
  return commit("edit_terms", (db) => {
    const ts = db.termSets.find((t) => t.id === termSetId);
    if (!ts) return fail("Term set not found.");
    if (ts.status !== "draft") return fail(`v${ts.version} is ${ts.status}; create a new version to change it.`);
    if (tranches.length === 0) return fail("A term set needs at least one tranche.");
    for (const t of tranches) {
      if (!(t.commitment > 0)) return fail(`${t.name}: commitment must be positive.`);
      if (t.fundedAtClose < 0 || t.fundedAtClose > t.commitment) return fail(`${t.name}: funded at close must be between 0 and the commitment.`);
      if (t.fundHold < 0 || t.fundHold > t.commitment) return fail(`${t.name}: hold must be between 0 and the commitment.`);
    }
    for (const c of covenants) if (c.levels.some((l) => !(l.level > 0) || !l.from)) return fail("Each covenant step needs a date and a positive level.");

    const before = { tranches: db.tranches.filter((t) => t.termSetId === ts.id), covenants: db.covenants.filter((c) => c.termSetId === ts.id) };
    const after = {
      tranches: tranches.map((t) => ({ ...t, termSetId: ts.id })),
      covenants: covenants.map((c) => ({ ...c, termSetId: ts.id, levels: [...c.levels].sort((a, b) => a.from.localeCompare(b.from)) })),
    };
    const changes = diffTerms(before, after);
    if (changes.length === 0) return [];
    db.tranches = [...db.tranches.filter((t) => t.termSetId !== ts.id), ...after.tranches];
    db.covenants = [...db.covenants.filter((c) => c.termSetId !== ts.id), ...after.covenants];
    return [{ action: "termset.edit", entity: { type: "term_set", id: ts.id }, dealId: ts.dealId, summary: `Edited term set v${ts.version}: ${summarizeChanges(changes)}` }];
  });
}

export function issueTermSet(termSetId: string): ActionResult {
  return commit("issue_terms", (db) => {
    const ts = db.termSets.find((t) => t.id === termSetId);
    if (!ts) return fail("Term set not found.");
    if (ts.status !== "draft") return fail(`v${ts.version} is already ${ts.status}.`);
    ts.status = "issued";
    if (ts.label === "proposal") ts.label = "term_sheet";
    return [{ action: "termset.issue", entity: { type: "term_set", id: ts.id }, dealId: ts.dealId, field: "status", before: "draft", after: "issued", summary: `Issued term set v${ts.version}` }];
  });
}

export function discardTermSetDraft(termSetId: string): ActionResult {
  return commit("edit_terms", (db) => {
    const ts = db.termSets.find((t) => t.id === termSetId);
    if (!ts) return fail("Term set not found.");
    if (ts.status !== "draft") return fail("Only drafts can be discarded.");
    if (db.termSets.filter((t) => t.dealId === ts.dealId).length === 1) return fail("A deal must keep at least one term set.");
    db.termSets = db.termSets.filter((t) => t.id !== ts.id);
    db.tranches = db.tranches.filter((t) => t.termSetId !== ts.id);
    db.covenants = db.covenants.filter((c) => c.termSetId !== ts.id);
    return [{ action: "termset.discard", entity: { type: "term_set", id: ts.id }, dealId: ts.dealId, summary: `Discarded draft term set v${ts.version}` }];
  });
}

// ---------------------------------------------------------------------------
// Due diligence
// ---------------------------------------------------------------------------

export type NewDDItem = Pick<DDItem, "workstream" | "kind" | "title" | "detail"> & Partial<Pick<DDItem, "severity" | "ownerUserId" | "dueDate">>;

export function addDDItem(dealId: string, item: NewDDItem): ActionResult {
  return commit("edit_dd", (db) => {
    if (!item.title.trim()) return fail("Give the item a title.");
    const id = newId("dd");
    db.ddItems.push({ id, dealId, status: "open", ...item, title: item.title.trim(), detail: item.detail.trim(), severity: item.kind === "finding" ? item.severity ?? "medium" : undefined });
    return [{ action: "dd.add", entity: { type: "dd_item", id }, dealId, summary: `Added ${item.kind}: ${item.title.trim()}${item.kind === "finding" && item.severity === "red_flag" ? " (red flag)" : ""}` }];
  });
}

export function updateDDItem(id: string, patch: Partial<Pick<DDItem, "status" | "mitigant" | "severity" | "ownerUserId" | "dueDate">>): ActionResult {
  return commit("edit_dd", (db) => {
    const d = db.ddItems.find((x) => x.id === id);
    if (!d) return fail("Item not found.");
    const changes: string[] = [];
    for (const [k, v] of Object.entries(patch) as [keyof typeof patch, string | undefined][]) {
      if ((d[k] ?? "") !== (v ?? "")) changes.push(`${k} ${d[k] ?? "—"} → ${v || "—"}`);
    }
    if (changes.length === 0) return [];
    Object.assign(d, patch);
    if (patch.mitigant !== undefined && !patch.mitigant.trim()) d.mitigant = undefined;
    return [{ action: "dd.update", entity: { type: "dd_item", id }, dealId: d.dealId, summary: `Updated "${d.title}": ${changes.join("; ")}` }];
  });
}

/** Turn a finding into a proposed IC condition, linked both ways. */
export function proposeIcCondition(ddItemId: string, description: string, type: ICCondition["type"], ownerUserId: string, dueDate?: string): ActionResult {
  return commit("edit_dd", (db) => {
    const d = db.ddItems.find((x) => x.id === ddItemId);
    if (!d) return fail("Item not found.");
    if (d.icConditionId) return fail("This finding already has an IC condition.");
    if (!description.trim()) return fail("Describe the condition.");
    const pending = db.icEvents.find((e) => e.dealId === d.dealId && e.stage === "final" && e.status === "pending");
    const id = newId("icc");
    db.icConditions.push({ id, dealId: d.dealId, icEventId: pending?.id, description: description.trim(), type, ownerUserId, dueDate, status: "proposed", sourceDdItemId: d.id });
    d.icConditionId = id;
    d.mitigant = `IC condition proposed: ${description.trim()}`;
    d.status = "mitigated";
    return [{ action: "ic.condition_propose", entity: { type: "ic_condition", id }, dealId: d.dealId, summary: `Proposed IC condition from "${d.title}": ${description.trim()}` }];
  });
}

// ---------------------------------------------------------------------------
// IC memo
// ---------------------------------------------------------------------------

function refreshSection(db: DB, s: MemoSection, content: string, generatedBy: MemoSection["generatedBy"]) {
  const memo = db.memos.find((m) => m.id === s.memoId)!;
  s.content = content;
  s.generatedBy = generatedBy;
  s.snapshot = computeSnapshot(db, memo.dealId, s.dependencies);
  s.reviewedBy = undefined;
  s.reviewedAt = undefined;
  s.updatedAt = nowIso();
  const ts = activeTermSet(db, memo.dealId);
  if (ts) memo.termSetId = ts.id;
  if (memo.status === "ready_for_ic") memo.status = "draft";
}

/**
 * Regenerate sections. `contentById` carries AI-written text (live mode);
 * without it the offline generator rebuilds the text from records.
 */
export function regenerateSections(sectionIds: string[], contentById?: Record<string, string>): ActionResult {
  return commit("edit_memo", (db) => {
    const sections = db.memoSections.filter((s) => sectionIds.includes(s.id));
    if (sections.length === 0) return fail("Nothing to regenerate.");
    const dealId = db.memos.find((m) => m.id === sections[0].memoId)!.dealId;
    for (const s of sections) {
      const live = contentById?.[s.id];
      refreshSection(db, s, live ?? offlineSection(db, dealId, s) ?? s.content, live ? "ai" : "ai_offline");
    }
    return [{
      action: "memo.regenerate", entity: { type: "memo", id: sections[0].memoId }, dealId,
      summary: `Regenerated ${sections.map((s) => s.title).join(", ")} (${contentById ? "AI" : "offline"})`,
    }];
  });
}

export function updateSectionContent(sectionId: string, content: string): ActionResult {
  return commit("edit_memo", (db) => {
    const s = db.memoSections.find((x) => x.id === sectionId);
    if (!s) return fail("Section not found.");
    if (!content.trim()) return fail("A section can't be empty.");
    refreshSection(db, s, content, "human");
    const dealId = db.memos.find((m) => m.id === s.memoId)!.dealId;
    return [{ action: "memo.edit", entity: { type: "memo_section", id: s.id }, dealId, summary: `Edited memo section: ${s.title}` }];
  });
}

export function markSectionReviewed(sectionId: string): ActionResult {
  return commit("edit_memo", (db, actor) => {
    const s = db.memoSections.find((x) => x.id === sectionId);
    if (!s) return fail("Section not found.");
    if (sectionIsStale(db, s)) return fail("Regenerate or edit this stale section before reviewing it.");
    s.reviewedBy = actor.id;
    s.reviewedAt = nowIso();
    const dealId = db.memos.find((m) => m.id === s.memoId)!.dealId;
    return [{ action: "memo.review", entity: { type: "memo_section", id: s.id }, dealId, summary: `Reviewed memo section: ${s.title}` }];
  });
}

export function markMemoReady(memoId: string): ActionResult {
  return commit("mark_memo_ready", (db) => {
    const memo = db.memos.find((m) => m.id === memoId);
    if (!memo) return fail("Memo not found.");
    const sections = db.memoSections.filter((s) => s.memoId === memoId);
    const stale = sections.filter((s) => sectionIsStale(db, s));
    if (stale.length) return fail(`Stale sections: ${stale.map((s) => s.title).join(", ")}.`);
    const unreviewed = sections.filter((s) => !s.reviewedBy);
    if (unreviewed.length) return fail(`Not yet reviewed: ${unreviewed.map((s) => s.title).join(", ")}.`);
    memo.status = "ready_for_ic";
    const ts = activeTermSet(db, memo.dealId);
    if (ts) memo.termSetId = ts.id;
    return [{ action: "memo.ready", entity: { type: "memo", id: memo.id }, dealId: memo.dealId, field: "status", before: "draft", after: "ready_for_ic", summary: `Marked the ${memo.memoType} memo v${memo.version} ready for IC (term set v${ts?.version})` }];
  });
}

// ---------------------------------------------------------------------------
// IC & approvals
// ---------------------------------------------------------------------------

const VOTE_LABEL: Record<string, string> = { approve: "Approve", approve_with_conditions: "Approve with conditions", decline: "Decline", abstain: "Abstain", defer: "Defer" };

export function recordVote(icEventId: string, vote: ICEvent["votes"][number]["vote"], comment?: string): ActionResult {
  return commit("record_vote", (db, actor) => {
    const e = db.icEvents.find((x) => x.id === icEventId);
    if (!e) return fail("IC event not found.");
    if (e.status !== "pending") return fail("This committee has already decided.");
    const prev = e.votes.find((v) => v.userId === actor.id);
    e.votes = [...e.votes.filter((v) => v.userId !== actor.id), { userId: actor.id, vote, comment: comment?.trim() || undefined }];
    return [{
      action: "ic.vote", entity: { type: "ic_event", id: e.id }, dealId: e.dealId, field: "vote", before: prev ? VOTE_LABEL[prev.vote] : undefined, after: VOTE_LABEL[vote],
      summary: `${prev ? "Changed vote" : "Voted"}: ${VOTE_LABEL[vote]}${comment?.trim() ? ` ("${comment.trim()}")` : ""}`,
    }];
  });
}

export function askIcQuestion(icEventId: string, question: string): ActionResult {
  return commit("add_note", (db, actor) => {
    const e = db.icEvents.find((x) => x.id === icEventId);
    if (!e) return fail("IC event not found.");
    if (!question.trim()) return fail("Write the question.");
    e.qa.push({ question: question.trim(), askedBy: actor.id });
    return [{ action: "ic.question", entity: { type: "ic_event", id: e.id }, dealId: e.dealId, summary: `Asked at IC: ${question.trim()}` }];
  });
}

export function answerIcQuestion(icEventId: string, index: number, answer: string): ActionResult {
  return commit("edit_memo", (db) => {
    const e = db.icEvents.find((x) => x.id === icEventId);
    const q = e?.qa[index];
    if (!e || !q) return fail("Question not found.");
    if (!answer.trim()) return fail("Write the answer.");
    q.answer = answer.trim();
    return [{ action: "ic.answer", entity: { type: "ic_event", id: e.id }, dealId: e.dealId, summary: `Answered IC question: ${q.question}` }];
  });
}

export function addIcCondition(dealId: string, description: string, type: ICCondition["type"], ownerUserId: string, dueDate?: string): ActionResult {
  return commit("decide_ic", (db) => {
    if (!description.trim()) return fail("Describe the condition.");
    const pending = db.icEvents.find((e) => e.dealId === dealId && e.stage === "final" && e.status === "pending");
    const id = newId("icc");
    db.icConditions.push({ id, dealId, icEventId: pending?.id, description: description.trim(), type, ownerUserId, dueDate, status: "proposed" });
    return [{ action: "ic.condition_add", entity: { type: "ic_condition", id }, dealId, summary: `Added IC condition: ${description.trim()}` }];
  });
}

export function updateIcCondition(id: string, patch: Partial<Pick<ICCondition, "description" | "type" | "ownerUserId" | "dueDate">>): ActionResult {
  return commit("decide_ic", (db) => {
    const c = db.icConditions.find((x) => x.id === id);
    if (!c) return fail("Condition not found.");
    if (c.status === "satisfied") return fail("This condition is already satisfied.");
    const before = c.description;
    Object.assign(c, patch);
    return [{ action: "ic.condition_edit", entity: { type: "ic_condition", id }, dealId: c.dealId, field: "description", before, after: c.description, summary: `Edited IC condition: ${c.description}` }];
  });
}

/** Remove a proposed condition. A linked finding goes back to unmitigated. */
export function removeIcCondition(id: string): ActionResult {
  return commit("decide_ic", (db) => {
    const c = db.icConditions.find((x) => x.id === id);
    if (!c) return fail("Condition not found.");
    if (c.status !== "proposed") return fail("Only proposed conditions can be removed.");
    db.icConditions = db.icConditions.filter((x) => x.id !== id);
    const dd = db.ddItems.find((d) => d.icConditionId === id);
    if (dd) {
      dd.icConditionId = undefined;
      if (dd.mitigant?.startsWith("IC condition proposed")) dd.mitigant = undefined;
      dd.status = "open";
    }
    return [{ action: "ic.condition_remove", entity: { type: "ic_condition", id }, dealId: c.dealId, summary: `Removed proposed IC condition: ${c.description}` }];
  });
}

export function satisfyCondition(id: string, evidence?: string): ActionResult {
  return commit("edit_dd", (db) => {
    const c = db.icConditions.find((x) => x.id === id);
    if (!c) return fail("Condition not found.");
    if (c.status !== "open") return fail(c.status === "proposed" ? "The condition hasn't been approved by IC yet." : "Already satisfied.");
    c.status = "satisfied";
    return [{ action: "ic.condition_satisfy", entity: { type: "ic_condition", id }, dealId: c.dealId, field: "status", before: "open", after: "satisfied", summary: `Satisfied IC condition: ${c.description}${evidence?.trim() ? ` (${evidence.trim()})` : ""}` }];
  });
}

/**
 * Record the committee's decision. Approval locks the active term set as
 * IC-approved and opens the proposed conditions; a decline passes the deal.
 */
export function decideIc(icEventId: string, decision: NonNullable<ICEvent["decision"]>, approvedHold?: number, note?: string): ActionResult {
  return commit("decide_ic", (db) => {
    const e = db.icEvents.find((x) => x.id === icEventId);
    if (!e) return fail("IC event not found.");
    if (e.status !== "pending") return fail("This committee has already decided.");
    if (e.votes.length === 0) return fail("Record at least one vote first.");
    const deal = db.deals.find((d) => d.id === e.dealId)!;
    const conditions = db.icConditions.filter((c) => c.dealId === e.dealId && c.status === "proposed");
    if (decision === "approve_with_conditions" && conditions.length === 0) return fail("Add a condition, or approve without conditions.");
    const at = nowIso();
    const audit: AuditDraft[] = [];

    if (decision === "approve" || decision === "approve_with_conditions") {
      const ts = db.termSets.filter((t) => t.dealId === e.dealId).sort((a, b) => b.version - a.version)[0];
      if (!ts) return fail("There is no term set to approve.");
      if (ts.status === "draft") return fail(`Term set v${ts.version} is still a draft. Issue it or discard it before approval.`);
      ts.status = "locked";
      ts.label = "ic_approved";
      ts.lockedByIcEventId = e.id;
      e.termSetId = ts.id;
      for (const c of conditions) { c.status = "open"; c.icEventId = e.id; }
      const memo = db.memos.find((m) => m.id === e.memoId) ?? db.memos.find((m) => m.dealId === e.dealId && m.memoType === "final");
      if (memo) memo.status = "final";
      audit.push({ action: "termset.lock", entity: { type: "term_set", id: ts.id }, dealId: e.dealId, field: "status", before: "issued", after: "locked", summary: `Term set v${ts.version} locked as IC-approved` });
      if (conditions.length) audit.push({ action: "ic.conditions_open", entity: { type: "ic_event", id: e.id }, dealId: e.dealId, summary: `Opened ${conditions.length} IC condition${conditions.length === 1 ? "" : "s"}: ${conditions.map((c) => c.description).join("; ")}` });
    }
    if (decision === "decline") {
      deal.status = "passed";
      deal.passReason = "credit_quality";
      deal.passNote = note?.trim() || "Declined at final IC.";
      deal.stageEnteredAt = at;
    }
    e.status = "decided";
    e.decision = decision;
    e.decidedAt = at;
    e.approvedHold = decision === "approve" || decision === "approve_with_conditions" ? approvedHold : undefined;
    audit.unshift({
      action: "ic.decide", entity: { type: "ic_event", id: e.id }, dealId: e.dealId, field: "decision", after: decision,
      summary: `${e.stage === "final" ? "Final" : "Screening"} IC decision: ${VOTE_LABEL[decision]}${approvedHold ? ` (hold ${approvedHold.toFixed(1)}M)` : ""}${note?.trim() ? `. ${note.trim()}` : ""}`,
    });
    return audit;
  });
}
