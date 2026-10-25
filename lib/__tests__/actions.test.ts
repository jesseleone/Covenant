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
