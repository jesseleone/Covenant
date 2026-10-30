import { DBSchema, NOTE_LABELS, STAGE_LABELS, type AuditEvent, type DB, type Memo, type MemoSection } from "@/lib/schema";
import { computeSnapshot } from "@/lib/selectors";
import { users } from "./users";
import { companies } from "./companies";
import { affiliations, people } from "./people";
import { buildLightDeals, lightDDItems, lightNotes } from "./deals";
import {
  larchCovenants, larchDDItems, larchDeal, larchDevilsAdvocate, larchDocuments, larchFields, larchICEvents, larchMemo,
  larchMemoSections, larchNotes, larchPeriods, larchStageEvents, larchStakeholders, larchTermSets, larchTranches,
} from "./larch";
import { chatMessages, chatThreads } from "./chat";

/**
 * Bump when the seed changes. The seed is loaded into Postgres by
 * `npm run db:seed` / `db:reset` and by "Reset demo data".
 */
export const SEED_VERSION = 2;

export const TODAY = "2026-10-25";

const beaconMemo: Memo = {
  id: "memo_beacon_final_v1", dealId: "deal_beacon", memoType: "final", version: 1, status: "ready_for_ic", termSetId: "ts_beacon_v1", createdAt: "2026-10-15T16:00:00.000Z",
};

const beaconSections: Omit<MemoSection, "snapshot">[] = [
  {
    id: "ms_beacon_exec", memoId: beaconMemo.id, key: "executive_summary", title: "Executive Summary", order: 1, generatedBy: "ai",
    reviewedBy: "u_elena", reviewedAt: "2026-10-16T15:00:00.000Z", updatedAt: "2026-10-15T16:00:00.000Z",
    dependencies: ["termset:active", "field:recurring_revenue_pct"],
    content: `Fernhill is asked to hold {{tranche:tl.hold}} of a {{metric:facility_size}} unitranche facility supporting Stonecrop Partners' dividend recapitalization of Beacon Pharmacy Solutions, priced at {{tranche:tl.spread}}. Northgate Direct Lending holds the balance.

Beacon's pharmacy management software is mission-critical for independent and regional chains, with {{field:recurring_revenue_pct}} recurring revenue [[cite:document:doc_beacon_cim#p2|CIM p.2]].`,
  },
  {
    id: "ms_beacon_rec", memoId: beaconMemo.id, key: "recommendation", title: "Recommendation", order: 2, generatedBy: "ai",
    reviewedBy: "u_elena", reviewedAt: "2026-10-16T15:00:00.000Z", updatedAt: "2026-10-15T16:00:00.000Z",
    dependencies: ["metric:total_leverage", "metric:cushion_pct"],
    content: `The deal team recommends **approval**. Leverage of {{metric:total_leverage}} is full but within our leverage cap for recurring-revenue borrowers, with {{metric:cushion_pct}} covenant cushion.`,
  },
];

function buildAudit(db: Omit<DB, "auditEvents">): AuditEvent[] {
  const out: AuditEvent[] = [];
  let n = 0;
  const add = (e: Omit<AuditEvent, "id">) => out.push({ id: `ae_${String(++n).padStart(4, "0")}`, ...e });

  for (const se of db.stageEvents) {
    add({
      actorId: se.userId, action: se.from ? "stage.move" : "deal.create", entity: { type: "deal", id: se.dealId }, dealId: se.dealId,
      field: se.from ? "stage" : undefined, before: se.from ? STAGE_LABELS[se.from] : undefined, after: STAGE_LABELS[se.to], at: se.at,
      summary: se.from ? `Moved from ${STAGE_LABELS[se.from]} to ${STAGE_LABELS[se.to]}` : "Created the deal at Sourced",
    });
  }
  for (const d of db.deals) {
    if (d.status === "passed" || d.status === "lost") {
      const last = db.stageEvents.filter((s) => s.dealId === d.id).sort((a, b) => a.at.localeCompare(b.at)).at(-1);
      const at = db.icEvents.filter((e) => e.dealId === d.id && e.status === "decided").map((e) => e.decidedAt!).sort().at(-1) ?? last?.at ?? d.createdAt;
      const passedAt = d.id === "deal_vale" ? "2025-03-12T14:00:00.000Z" : at;
      add({ actorId: d.leadUserId, action: "deal.pass", entity: { type: "deal", id: d.id }, dealId: d.id, field: "status", before: "Active", after: d.status === "lost" ? "Lost" : "Passed", at: passedAt, summary: `Marked ${d.status === "lost" ? "lost" : "passed"}: ${d.passNote ?? ""}` });
    }
  }
  for (const doc of db.documents) {
    add({ actorId: db.deals.find((d) => d.id === doc.dealId)!.teamUserIds[0], action: "document.upload", entity: { type: "document", id: doc.id }, dealId: doc.dealId, at: doc.uploadedAt, summary: `Added document: ${doc.title}` });
  }
  for (const e of db.icEvents.filter((x) => x.status === "decided")) {
    add({ actorId: "u_robert", action: "ic.decide", entity: { type: "ic_event", id: e.id }, dealId: e.dealId, field: "decision", after: e.decision, at: e.decidedAt!, summary: `${e.stage === "final" ? "Final" : "Screening"} IC decision: ${e.decision!.replace(/_/g, " ")}` });
    const locked = db.termSets.find((t) => t.lockedByIcEventId === e.id);
    if (locked) add({ actorId: "u_robert", action: "termset.lock", entity: { type: "term_set", id: locked.id }, dealId: e.dealId, at: e.decidedAt!, summary: `Term set v${locked.version} locked as IC-approved` });
  }
  for (const note of db.notes.filter((x) => x.subject.type === "deal")) {
    add({ actorId: note.authorId, action: "note.add", entity: { type: "note", id: note.id }, dealId: note.subject.id, at: note.createdAt, summary: `Added a note (${NOTE_LABELS[note.noteType]})` });
  }

  // Project Larch specifics
  const L = "deal_larch";
  add({ actorId: "u_jordan", action: "field.confirm_bulk", entity: { type: "document", id: "doc_larch_cim" }, dealId: L, at: "2026-09-08T16:00:00.000Z", summary: "Confirmed 19 extracted values from the CIM (confidence ≥ 0.90)" });
  add({ actorId: "u_marcus", action: "termset.create", entity: { type: "term_set", id: "ts_larch_v1" }, dealId: L, at: "2026-09-22T17:00:00.000Z", summary: "Created term set v1 (term sheet)" });
  add({ actorId: "u_marcus", action: "termset.issue", entity: { type: "term_set", id: "ts_larch_v1" }, dealId: L, field: "status", before: "draft", after: "issued", at: "2026-09-24T18:00:00.000Z", summary: "Issued term set v1 to Ashby Hill" });
  add({ actorId: "u_jordan", action: "memo.generate", entity: { type: "memo", id: "memo_larch_final_v1" }, dealId: L, at: "2026-10-12T18:00:00.000Z", summary: "Generated final IC memo v1 (8 sections)" });
  add({ actorId: "u_jordan", action: "dd.add", entity: { type: "dd_item", id: "dd_larch_qoe" }, dealId: L, at: "2026-10-16T18:30:00.000Z", summary: "Added QoE finding: $1.2M pricing run-rate add-back rejected" });
  add({ actorId: "u_sam", action: "dd.add", entity: { type: "dd_item", id: "dd_larch_conc" }, dealId: L, at: "2026-10-17T15:00:00.000Z", summary: "Added red-flag finding: top customer 22% of revenue" });
  add({ actorId: "u_sam", action: "memo.review", entity: { type: "memo", id: "memo_larch_final_v1" }, dealId: L, at: "2026-10-13T15:00:00.000Z", summary: "Reviewed memo sections: Executive Summary, Investment Thesis" });

  return out.sort((a, b) => a.at.localeCompare(b.at));
}

export function buildSeed(): DB {
  const light = buildLightDeals();

  const base: Omit<DB, "auditEvents"> = {
    users,
    companies,
    people,
    affiliations,
    deals: [larchDeal, ...light.deals],
    stakeholders: [...larchStakeholders, ...light.stakeholders],
    stageEvents: [...larchStageEvents, ...light.stageEvents],
    notes: [...larchNotes, ...lightNotes],
    documents: [...larchDocuments, ...light.documents],
    extractedFields: [...larchFields, ...light.extractedFields],
    financialPeriods: [...larchPeriods, ...light.financialPeriods],
    termSets: [...larchTermSets, ...light.termSets],
    tranches: [...larchTranches, ...light.tranches],
    covenants: [...larchCovenants, ...light.covenants],
    ddItems: [...larchDDItems, ...lightDDItems],
    memos: [larchMemo, beaconMemo],
    memoSections: [],
    icEvents: [...larchICEvents, ...light.icEvents].map((e) => (e.id === "ic_beacon_final" ? { ...e, memoId: beaconMemo.id } : e)),
    icConditions: light.icConditions,
    devilsAdvocate: larchDevilsAdvocate,
    chatThreads,
    chatMessages,
    settings: { coverageCushionGuidelinePct: 25, today: TODAY },
  };

  // Snapshots are taken against the seed itself, so nothing starts stale.
  const withAudit: DB = { ...base, auditEvents: buildAudit(base) };
  withAudit.memoSections = [...larchMemoSections, ...beaconSections].map((s) => {
    const dealId = withAudit.memos.find((m) => m.id === s.memoId)!.dealId;
    return { ...s, snapshot: computeSnapshot(withAudit, dealId, s.dependencies) };
  });

  return DBSchema.parse(withAudit);
}
