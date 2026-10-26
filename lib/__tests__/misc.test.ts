import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/seed";
import { can, canMoveStage } from "@/lib/permissions";
import { findCompanyMatches, findPersonMatches } from "@/lib/dedupe";
import { findPrecedents } from "@/lib/queries";
import { renderMarkdown } from "@/lib/render/tokens";

const db = buildSeed();

describe("permissions", () => {
  it("analysts work the deal but can't move into IC or touch terms", () => {
    expect(can("analyst", "review_field")).toBe(true);
    expect(can("analyst", "edit_terms")).toBe(false);
    expect(canMoveStage("analyst", "diligence")).toBe(true);
    expect(canMoveStage("analyst", "ic")).toBe(false);
  });
  it("VPs and MDs issue terms and move into IC", () => {
    expect(can("vp", "issue_terms")).toBe(true);
    expect(can("md", "mark_memo_ready")).toBe(true);
    expect(canMoveStage("vp", "ic")).toBe(true);
  });
  it("IC members decide but can't edit terms; they may move approved deals to Documentation", () => {
    expect(can("ic_member", "decide_ic")).toBe(true);
    expect(can("ic_member", "edit_terms")).toBe(false);
    expect(canMoveStage("ic_member", "documentation")).toBe(true);
    expect(canMoveStage("ic_member", "diligence")).toBe(false);
  });
});

describe("duplicate matcher", () => {
  it("finds Wren Industrial Svcs. from 'Wren Industrial Services'", () => {
    expect(findCompanyMatches(db.companies, "Wren Industrial Services")[0]?.item.id).toBe("co_wren");
  });
  it("matches aliases", () => {
    expect(findCompanyMatches(db.companies, "Wren Services")[0]?.item.id).toBe("co_wren");
    expect(findCompanyMatches(db.companies, "Halvorsen")[0]?.item.id).toBe("co_halvorsen");
  });
  it("matches people by email and name", () => {
    expect(findPersonMatches(db.people, "", "MGRANT@halvorsenco.com")[0]?.item.id).toBe("per_michael_grant");
    expect(findPersonMatches(db.people, "Tom Brant")[0]?.item.id).toBe("per_tom_brandt");
  });
  it("does not flag unrelated names", () => {
    expect(findCompanyMatches(db.companies, "Zephyr Aerospace")).toEqual([]);
  });
});

describe("precedents", () => {
  it("uses only closed or passed deals and includes Ember, Granite, Tern and Alder", () => {
    const p = findPrecedents(db, "deal_larch");
    expect(p.every((x) => x.deal.status !== "active")).toBe(true);
    expect(p.map((x) => x.deal.id)).toEqual(expect.arrayContaining(["deal_ember", "deal_granite", "deal_tern", "deal_alder"]));
    expect(p.map((x) => x.deal.id)).not.toContain("deal_juniper");
    for (let i = 1; i < p.length; i++) expect(p[i - 1].score).toBeGreaterThanOrEqual(p[i].score);
  });
});

describe("memo tokens", () => {
  it("resolves tokens to live values", () => {
    const s = db.memoSections.find((x) => x.id === "ms_larch_terms")!;
    const md = renderMarkdown(db, "deal_larch", s.content);
    expect(md).toContain("$115.0M");
    expect(md).toContain("S+525");
    expect(md).toContain("5.14x");
    expect(md).toContain("26.5%");
    expect(md).not.toMatch(/\{\{|\[missing|\[unknown|\[no /);
  });
  it("leaves no unresolved tokens in any seeded section", () => {
    for (const s of db.memoSections) {
      const dealId = db.memos.find((m) => m.id === s.memoId)!.dealId;
      expect(renderMarkdown(db, dealId, s.content), s.id).not.toMatch(/\{\{|\[missing|\[unknown|\[no /);
    }
  });
});

describe("memo figure guard", async () => {
  const { typedFigures } = await import("@/lib/memo");
  it("flags typed money, multiples and spreads but not tokens or percentages", () => {
    expect(typedFigures("Leverage of {{metric:total_leverage}} at {{tranche:tl.spread}}, 94% renewal, cushion vs 25% guideline.")).toEqual([]);
    expect(typedFigures("EBITDA of $16.3M gives 5.52x at S+525.")).toEqual(["$16.3M", "5.52x", "S+525"]);
  });
  it("the seeded memo has no typed figures", () => {
    for (const s of db.memoSections) expect(typedFigures(s.content), s.id).toEqual([]);
  });
});
