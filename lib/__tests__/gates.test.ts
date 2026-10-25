import { describe, expect, it } from "vitest";
import type { DB, Deal, Stage } from "@/lib/schema";
import { buildSeed } from "@/lib/seed";
import { evaluateGate, requirementsFor } from "@/lib/gates";

const seed = buildSeed();
const deal = (db: DB, id: string) => db.deals.find((d) => d.id === id)!;
const at = (d: Deal, stage: Stage): Deal => ({ ...d, stage });

describe("stage gates", () => {
  it("screening: borrower and strategy set", () => {
    expect(requirementsFor(seed, deal(seed, "deal_fjord"), "screening")).toEqual([]);
    const missing = { ...deal(seed, "deal_fjord"), borrowerCompanyId: "" };
    expect(requirementsFor(seed, missing, "screening")).toHaveLength(1);
  });

  it("term_sheet: needs a term set with a tranche", () => {
    expect(requirementsFor(seed, deal(seed, "deal_osprey"), "term_sheet")).toEqual([]);
    const db = structuredClone(seed);
    db.tranches = db.tranches.filter((t) => t.termSetId !== "ts_osprey_v1");
    expect(requirementsFor(db, deal(db, "deal_osprey"), "term_sheet")).toHaveLength(1);
  });

  it("diligence: needs an issued term set", () => {
    expect(requirementsFor(seed, deal(seed, "deal_quarry"), "diligence")).toHaveLength(1); // v1 is a draft
    expect(requirementsFor(seed, deal(seed, "deal_larch"), "diligence")).toEqual([]);
  });

  it("ic: memo ready and red flags mitigated or conditioned", () => {
    const unmet = requirementsFor(seed, deal(seed, "deal_larch"), "ic");
    expect(unmet.map((u) => u.label).join(" | ")).toMatch(/ready for IC.*Top customer/);
    const db = structuredClone(seed);
    db.memos.find((m) => m.id === "memo_larch_final_v1")!.status = "ready_for_ic";
    db.ddItems.find((d) => d.id === "dd_larch_conc")!.icConditionId = "icc_x";
    expect(requirementsFor(db, deal(db, "deal_larch"), "ic")).toEqual([]);
  });

  it("documentation is a hard gate requiring final IC approval", () => {
    const g = evaluateGate(seed, deal(seed, "deal_beacon"), "documentation");
    expect(g.ok).toBe(false);
    expect(g.hard).toBe(true);
    expect(requirementsFor(seed, deal(seed, "deal_cinder"), "documentation")).toEqual([]);
  });

  it("closed: pre-close conditions satisfied and KYC cleared", () => {
    const cinder = deal(seed, "deal_cinder");
    expect(requirementsFor(seed, cinder, "closed")).toHaveLength(1); // one open pre-close condition
    const db = structuredClone(seed);
    db.icConditions.find((c) => c.id === "icc_cinder_1")!.status = "satisfied";
    expect(requirementsFor(db, cinder, "closed")).toEqual([]);
  });

  it("checks every stage passed through, and lets deals move backward", () => {
    const fjord = deal(seed, "deal_fjord"); // sourced, draft term set
    const g = evaluateGate(seed, fjord, "ic");
    expect(g.unmet.map((u) => u.label)).toEqual(expect.arrayContaining(["Issue term set v1"]));
    expect(evaluateGate(seed, at(deal(seed, "deal_larch"), "diligence"), "screening").ok).toBe(true);
  });
});
