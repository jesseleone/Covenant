import { beforeEach, describe, expect, it } from "vitest";
import { moveStage, reopenDeal, setDealOutcome } from "@/lib/actions";
import { resetDemoData, signIn, useDBStore } from "@/lib/store";

const db = () => useDBStore.getState().db;
const deal = (id: string) => db().deals.find((d) => d.id === id)!;

beforeEach(() => {
  resetDemoData();
  signIn("u_jordan");
});

describe("moveStage", () => {
  it("blocks roles that can't enter the stage", () => {
    const r = moveStage("deal_larch", "ic", "test");
    expect(r.ok).toBe(false);
    expect(deal("deal_larch").stage).toBe("diligence");
  });

  it("requires a reason to pass an unmet soft gate, then records the override", () => {
    signIn("u_marcus");
    expect(moveStage("deal_larch", "ic").ok).toBe(false);
    const before = db().auditEvents.length;
    expect(moveStage("deal_larch", "ic", "IC slot this week; memo finalising").ok).toBe(true);
    expect(deal("deal_larch").stage).toBe("ic");
    const se = db().stageEvents.at(-1)!;
    expect(se.overrideReason).toMatch(/IC slot/);
    expect(db().auditEvents.length).toBeGreaterThan(before);
  });

  it("schedules a pending final IC on entering IC", () => {
    signIn("u_marcus");
    moveStage("deal_larch", "ic", "override");
    const ev = db().icEvents.find((e) => e.dealId === "deal_larch" && e.stage === "final");
    expect(ev?.status).toBe("pending");
    expect(ev?.date.slice(0, 10)).toBe("2026-10-29");
    expect(ev?.termSetId).toBe("ts_larch_v1");
  });

  it("never overrides the hard Documentation gate", () => {
    signIn("u_marcus");
    expect(moveStage("deal_beacon", "documentation", "please").ok).toBe(false);
    expect(deal("deal_beacon").stage).toBe("ic");
  });

  it("lets analysts move forward without IC and records a clean move", () => {
    expect(moveStage("deal_osprey", "term_sheet").ok).toBe(true);
    expect(db().stageEvents.at(-1)!.overrideReason).toBeUndefined();
  });
});

describe("outcomes", () => {
  it("requires a reason code and note to pass", () => {
    expect(setDealOutcome("deal_osprey", "passed", "").ok).toBe(false);
    expect(setDealOutcome("deal_osprey", "passed", "Too much PPO exposure").ok).toBe(false);
    expect(setDealOutcome("deal_osprey", "passed", "Too much PPO exposure", "credit_quality").ok).toBe(true);
    expect(deal("deal_osprey").status).toBe("passed");
  });

  it("reopens a passed deal", () => {
    setDealOutcome("deal_osprey", "on_hold", "Sponsor paused the process");
    expect(reopenDeal("deal_osprey").ok).toBe(true);
    expect(deal("deal_osprey").status).toBe("active");
  });
});

describe("extraction review", async () => {
  const { confirmField, confirmAllAbove, correctField } = await import("@/lib/actions");
  const { totalLeverage, sectionIsStale } = await import("@/lib/selectors");
  const field = (id: string) => db().extractedFields.find((f) => f.id === id)!;

  it("confirms a proposed value", () => {
    expect(confirmField("ef_larch_top_customer_pct").ok).toBe(true);
    expect(field("ef_larch_top_customer_pct")).toMatchObject({ status: "confirmed", reviewedBy: "u_jordan" });
  });

  it("bulk-confirms only values at or above the threshold", () => {
    const d = db();
    d.extractedFields.find((f) => f.id === "ef_larch_employees")!.status = "proposed";
    useDBStore.setState({ db: d });
    const r = confirmAllAbove("deal_larch", 0.9);
    expect(r.count).toBe(1);
    expect(field("ef_larch_adj_ebitda_ltm").status).toBe("proposed"); // 0.64 stays for a person
  });

  it("corrects EBITDA from the QoE: new source, quote, history, live metrics and stale memo", () => {
    expect(correctField("ef_larch_adj_ebitda_ltm", 16.3, "doc_larch_qoe", 2, "QoE excludes the pricing run-rate").ok).toBe(true);
    const f = field("ef_larch_adj_ebitda_ltm");
    expect(f).toMatchObject({ value: 16.3, status: "corrected", documentId: "doc_larch_qoe", page: 2 });
    expect(f.correctedFrom).toEqual({ value: 17.5, documentId: "doc_larch_cim", page: 8 });
    expect(f.quote).toMatch(/diligence-adjusted EBITDA of \$16\.3M/);
    expect(totalLeverage(db(), "deal_larch")).toBeCloseTo(5.52, 2);
    expect(db().memoSections.filter((s) => s.memoId === "memo_larch_final_v1" && sectionIsStale(db(), s))).toHaveLength(4);
    expect(db().auditEvents.at(-1)!.summary).toMatch(/\$17\.5M \(CIM p\.8\) → \$16\.3M \(QoE p\.2\)/);
  });

  it("rejects a source page that doesn't exist and blocks IC members", () => {
    expect(correctField("ef_larch_adj_ebitda_ltm", 16.3, "doc_larch_qoe", 9).ok).toBe(false);
    signIn("u_robert");
    expect(confirmField("ef_larch_maintenance_capex").ok).toBe(false);
  });
});

describe("term sets", async () => {
  const { createTermSetVersion, saveTermSetDraft, issueTermSet, discardTermSetDraft, correctField } = await import("@/lib/actions");
  const { cushionPct, activeTermSet } = await import("@/lib/selectors");

  it("only VPs/MDs create versions; a new version copies tranches and covenants as a draft", () => {
    expect(createTermSetVersion("deal_larch").ok).toBe(false); // analyst
    signIn("u_marcus");
    const r = createTermSetVersion("deal_larch");
    expect(r.ok).toBe(true);
    const ts = db().termSets.find((t) => t.id === r.termSetId)!;
    expect(ts).toMatchObject({ version: 2, status: "draft", parentId: "ts_larch_v1", label: "term_sheet" });
    expect(db().tranches.filter((t) => t.termSetId === ts.id)).toHaveLength(3);
    expect(createTermSetVersion("deal_larch").ok).toBe(false); // draft already open
  });

  it("covenant reset to 7.50x restores cushion to ~26.4% after the EBITDA correction", () => {
    correctField("ef_larch_adj_ebitda_ltm", 16.3, "doc_larch_qoe", 2);
    signIn("u_marcus");
    const { termSetId } = createTermSetVersion("deal_larch");
    const tr = db().tranches.filter((t) => t.termSetId === termSetId);
    const cov = db().covenants.filter((c) => c.termSetId === termSetId).map((c) => ({
      ...c, levels: [{ from: "2026-12-31", level: 7.5 }, { from: "2027-12-31", level: 7.0 }, { from: "2028-12-31", level: 6.5 }],
    }));
    expect(saveTermSetDraft(termSetId!, tr, cov).ok).toBe(true);
    expect(db().auditEvents.at(-1)!.summary).toMatch(/7\.00x \/ 6\.50x \/ 6\.00x → 7\.50x \/ 7\.00x \/ 6\.50x/);
    expect(cushionPct(db(), "deal_larch")! * 100).toBeCloseTo(26.4, 1);
    expect(issueTermSet(termSetId!).ok).toBe(true);
    expect(activeTermSet(db(), "deal_larch")).toMatchObject({ version: 2, status: "issued" });
    expect(saveTermSetDraft(termSetId!, tr, cov).ok).toBe(false); // issued is read-only
  });

  it("validates tranches and can discard a draft", () => {
    signIn("u_marcus");
    const { termSetId } = createTermSetVersion("deal_larch");
    const tr = db().tranches.filter((t) => t.termSetId === termSetId).map((t) => (t.key === "tl" ? { ...t, fundedAtClose: 200 } : t));
    expect(saveTermSetDraft(termSetId!, tr, []).ok).toBe(false);
    expect(discardTermSetDraft(termSetId!).ok).toBe(true);
    expect(activeTermSet(db(), "deal_larch")?.version).toBe(1);
  });
});

describe("diligence and memo", async () => {
  const { proposeIcCondition, correctField, regenerateSections, markSectionReviewed, markMemoReady, updateSectionContent } = await import("@/lib/actions");
  const { sectionIsStale } = await import("@/lib/selectors");
  const { requirementsFor } = await import("@/lib/gates");
  const { staleReasons } = await import("@/lib/memo");
  const { renderMarkdown } = await import("@/lib/render/tokens");
  const larchSections = () => db().memoSections.filter((s) => s.memoId === "memo_larch_final_v1");

  it("proposes an IC condition from a red flag, which satisfies that part of the IC gate", () => {
    expect(proposeIcCondition("dd_larch_conc", "Customer reference call with top customer and review of MSA renewal terms prior to close", "pre_close", "u_sam").ok).toBe(true);
    const dd = db().ddItems.find((d) => d.id === "dd_larch_conc")!;
    const cond = db().icConditions.find((c) => c.id === dd.icConditionId)!;
    expect(cond).toMatchObject({ status: "proposed", sourceDdItemId: "dd_larch_conc", type: "pre_close" });
    expect(requirementsFor(db(), deal("deal_larch"), "ic").map((u) => u.label)).toEqual(["Final IC memo marked ready for IC"]);
  });

  it("explains staleness and clears it on regeneration, with text that reflects the QoE", () => {
    correctField("ef_larch_adj_ebitda_ltm", 16.3, "doc_larch_qoe", 2);
    const fin = larchSections().find((s) => s.key === "financial_analysis")!;
    expect(staleReasons(db(), fin).find((r) => r.dep === "field:adj_ebitda_ltm")).toMatchObject({ before: "$17.5M", after: "$16.3M" });
    const stale = larchSections().filter((s) => sectionIsStale(db(), s)).map((s) => s.id);
    expect(regenerateSections(stale).ok).toBe(true);
    expect(larchSections().filter((s) => sectionIsStale(db(), s))).toHaveLength(0);
    const regenerated = larchSections().find((s) => s.key === "financial_analysis")!;
    expect(regenerated.generatedBy).toBe("ai_offline");
    expect(regenerated.reviewedBy).toBeUndefined();
    const md = renderMarkdown(db(), "deal_larch", regenerated.content);
    expect(md).toMatch(/\$16\.3M/);
    expect(md).toMatch(/QoE p\.2/);
    expect(regenerated.content).not.toMatch(/16\.3|17\.5/); // figures are tokens, never typed
  });

  it("requires every section fresh and reviewed before a VP marks the memo ready", () => {
    signIn("u_marcus");
    expect(markMemoReady("memo_larch_final_v1").ok).toBe(false);
    for (const s of larchSections()) expect(markSectionReviewed(s.id).ok).toBe(true);
    signIn("u_jordan");
    expect(markMemoReady("memo_larch_final_v1").ok).toBe(false); // analyst
    signIn("u_marcus");
    expect(markMemoReady("memo_larch_final_v1").ok).toBe(true);
    expect(db().memos.find((m) => m.id === "memo_larch_final_v1")!.status).toBe("ready_for_ic");
    updateSectionContent(larchSections()[0].id, "Edited text.");
    expect(db().memos.find((m) => m.id === "memo_larch_final_v1")!.status).toBe("draft");
  });
});
