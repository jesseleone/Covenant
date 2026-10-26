import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/seed";
import { answerOffline } from "@/lib/llm/offline";
import { runTool, TOOL_IMPLS } from "@/lib/llm/query-tools";
import { TOOLS } from "@/lib/llm/tools";

const db = buildSeed();

describe("query tools", () => {
  it("every tool definition has an implementation and vice versa", () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual(Object.keys(TOOL_IMPLS).sort());
  });

  it("list_deals filters by status, sector and size, quoting approved terms", () => {
    const { result, record } = runTool(db, "list_deals", { status: "closed", sectorKeyword: "business services", minSize: 75 });
    const rows = result as { id: string; leverageX: number; cite: string }[];
    expect(rows.map((r) => r.id).sort()).toEqual(["deal_alder", "deal_granite"]);
    expect(rows.find((r) => r.id === "deal_granite")!.leverageX).toBe(5.4);
    expect(rows[0].cite).toMatch(/^\[\[cite:deal:deal_\w+\|Project \w+\]\]$/);
    expect(record).toMatchObject({ name: "list_deals", rowCount: 2, resultSummary: "2 deals" });
  });

  it("resolves aliases and returns history since the last IC", () => {
    const hits = runTool(db, "search_entities", { query: "AHP" }).result as { id: string }[];
    expect(hits[0].id).toBe("co_ashby");
    const h = runTool(db, "get_history", { dealId: "deal_larch", sinceIso: "last_ic" }).result as { sinceLabel: string; events: unknown[] };
    expect(h.sinceLabel).toMatch(/screening IC decision on 2026-09-18/);
    expect(h.events.length).toBeGreaterThan(3);
  });

  it("reports unknown tools and bad ids as errors the model can read", () => {
    expect(runTool(db, "nope", {}).isError).toBe(true);
    expect(runTool(db, "get_deal", { dealId: "deal_missing" }).isError).toBe(true);
  });
});

describe("offline answers to the suggested prompts", () => {
  it("1. pricing on approved services deals and why we passed", () => {
    const a = answerOffline(db, "What leverage and spreads did we approve on services deals over $75M, and why did we pass on similar ones?");
    expect(a.text).toMatch(/Project Alder/);
    expect(a.text).toMatch(/Project Granite/);
    expect(a.text).toMatch(/S\+525/);
    expect(a.text).toMatch(/Project Ember[^\n]*Credit quality/);
    expect(a.text).toMatch(/Project Vale[^\n]*Lost to competitor/);
    expect(a.toolCalls.map((t) => t.name)).toEqual(["list_deals", "list_deals", "get_ic_events"]);
  });

  it("2. unresolved red flags", () => {
    const a = answerOffline(db, "Which active deals have unresolved red flags?");
    expect(a.text).toMatch(/1 red-flag finding is unresolved/);
    expect(a.text).toMatch(/Top customer 22%/);
  });

  it("3. what changed on Larch since screening IC", () => {
    const a = answerOffline(db, "Summarize what changed on Project Larch since screening IC.");
    expect(a.text).toMatch(/since the screening IC decision/);
    expect(a.text).toMatch(/\*\*Terms\*\*/);
    expect(a.toolCalls.map((t) => t.name)).toContain("get_history");
  });

  it("4. who we know at Ashby Hill", () => {
    const a = answerOffline(db, "Who do we know at Ashby Hill, and what's our history with them?");
    expect(a.text).toMatch(/Kevin Moreau/);
    expect(a.text).toMatch(/Project Ember/);
    expect(a.toolCalls[0].name).toBe("search_entities");
  });

  it("5. precedents for Larch with IC questions", () => {
    const a = answerOffline(db, "Find precedents for Project Larch and the questions IC asked.", [{ type: "deal", id: "deal_larch" }]);
    expect(a.text).toMatch(/Project Ember/);
    expect(a.text).toMatch(/covenant reset/);
    expect(a.text).toMatch(/What IC asked/);
  });
});
