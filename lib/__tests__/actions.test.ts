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
