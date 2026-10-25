import { describe, expect, it } from "vitest";
import type { DB } from "@/lib/schema";
import { buildSeed } from "@/lib/seed";
import { cushionPct, currentCovenantLevel, relationshipStrength, sectionIsStale, totalLeverage } from "@/lib/selectors";

/** Correct Larch's LTM adjusted EBITDA to the QoE figure (what correctField does). */
function correctEbitda(db: DB): DB {
  const next = structuredClone(db);
  const f = next.extractedFields.find((x) => x.id === "ef_larch_adj_ebitda_ltm")!;
  f.correctedFrom = { value: f.value, documentId: f.documentId, page: f.page };
  Object.assign(f, { value: 16.3, documentId: "doc_larch_qoe", page: 2, status: "corrected" });
  return next;
}

/** Add term set v2 with the covenant reset to 7.50x / 7.00x / 6.50x. */
function addV2(db: DB): DB {
  const next = structuredClone(db);
  next.termSets.push({ id: "ts_larch_v2", dealId: "deal_larch", version: 2, label: "term_sheet", status: "issued", parentId: "ts_larch_v1", createdBy: "u_marcus", createdAt: "2026-10-25T15:00:00.000Z" });
  next.tranches.push(...next.tranches.filter((t) => t.termSetId === "ts_larch_v1").map((t) => ({ ...t, id: t.id.replace("v1", "v2"), termSetId: "ts_larch_v2" })));
  next.covenants.push({ ...next.covenants.find((c) => c.id === "cov_larch_v1_lev")!, id: "cov_larch_v2_lev", termSetId: "ts_larch_v2",
    levels: [{ from: "2026-12-31", level: 7.5 }, { from: "2027-12-31", level: 7.0 }, { from: "2028-12-31", level: 6.5 }] });
  return next;
}

describe("leverage and cushion", () => {
  const seed = buildSeed();

  it("computes Larch leverage from funded debt and LTM EBITDA", () => {
    expect(totalLeverage(seed, "deal_larch")).toBeCloseTo(90 / 17.5, 6); // 5.14x
    expect(totalLeverage(correctEbitda(seed), "deal_larch")).toBeCloseTo(90 / 16.3, 6); // 5.52x
  });

  it("cushion moves 26.5% → 21.1% → 26.4%", () => {
    const corrected = correctEbitda(seed);
    expect(cushionPct(seed, "deal_larch")! * 100).toBeCloseTo(26.5, 1);
    expect(cushionPct(corrected, "deal_larch")! * 100).toBeCloseTo(21.1, 1);
    expect(cushionPct(addV2(corrected), "deal_larch")! * 100).toBeCloseTo(26.4, 1);
  });

  it("measures closed deals at their closing date (Granite closed with ~20% cushion)", () => {
    expect(cushionPct(seed, "deal_granite")! * 100).toBeCloseTo(20.0, 1);
  });

  it("uses the covenant level in force, or the first level before the first test", () => {
    const cov = seed.covenants.find((c) => c.id === "cov_larch_v1_lev");
    expect(currentCovenantLevel(cov, "2026-10-25")).toBe(7.0);
    expect(currentCovenantLevel(cov, "2028-01-15")).toBe(6.5);
  });
});

describe("stale detection", () => {
  const seed = buildSeed();
  const stale = (db: DB) => db.memoSections.filter((s) => s.memoId === "memo_larch_final_v1" && sectionIsStale(db, s)).map((s) => s.key).sort();

  it("flags exactly the sections that depend on adjusted EBITDA", () => {
    expect(stale(seed)).toEqual([]);
    expect(stale(correctEbitda(seed))).toEqual(["financial_analysis", "key_risks", "recommendation", "structure_terms"]);
  });

  it("flags term-dependent sections when a new term-set version is added", () => {
    expect(stale(addV2(seed))).toEqual(expect.arrayContaining(["executive_summary", "structure_terms", "recommendation"]));
  });
});

describe("relationship strength", () => {
  it("rates an active deal contact above a person with no history", () => {
    const db = buildSeed();
    expect(relationshipStrength(db, "per_michael_grant")).toBe("strong");
    expect(relationshipStrength(db, "per_frank_wren")).toBe("weak");
  });
});
