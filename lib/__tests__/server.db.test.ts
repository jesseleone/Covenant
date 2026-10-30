import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type pg from "pg";
import * as A from "@/lib/actions";
import { createThread, addChatMessage, deleteThread } from "@/lib/chat";
import { withContext, type DataContext } from "@/lib/core/commit";
import { buildSeed } from "@/lib/seed";
import { cushionPct, sectionIsStale, totalLeverage } from "@/lib/selectors";
import { loadDB, saveDiff } from "@/lib/server/repo";
import { runAction, runWithDB } from "@/lib/server/run";
import { freshDatabase, hasDB, reseed, testPool } from "./db-helper";

describe.skipIf(!hasDB)("Postgres backend", () => {
  let p: pg.Pool;
  const read = async () => { const c = await p.connect(); try { return await loadDB(c); } finally { c.release(); } };

  beforeAll(async () => { p = testPool(); await freshDatabase(p); });
  afterAll(async () => { await p.end(); });
  beforeEach(async () => { await reseed(p); });

  it("stores the demo seed exactly: loading it back gives the same data", async () => {
    const db = await read();
    expect(db).toEqual(buildSeed());
    expect(db.deals).toHaveLength(12);
    expect(db.companies).toHaveLength(25);
    expect(db.people).toHaveLength(40);
    expect(totalLeverage(db, "deal_larch")).toBeCloseTo(90 / 17.5, 6);
    expect(cushionPct(db, "deal_larch")! * 100).toBeCloseTo(26.5, 1);
  });

  it("runs an action in a transaction and writes an audit row", async () => {
    const r = await runAction("correctField", ["ef_larch_adj_ebitda_ltm", 16.3, "doc_larch_qoe", 2, "QoE figure"], "u_jordan", p);
    expect(r).toEqual({ ok: true });
    const db = await read();
    expect(totalLeverage(db, "deal_larch")).toBeCloseTo(90 / 16.3, 6);
    expect(db.memoSections.filter((s) => sectionIsStale(db, s)).length).toBeGreaterThan(0);
    const { rows } = await p.query("SELECT actor_id, summary FROM audit_event WHERE action = 'field.correct'");
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_id).toBe("u_jordan");
  });

  it("enforces permissions on the server and leaves the data untouched on refusal", async () => {
    const before = await read();
    const r = await runAction("issueTermSet", ["ts_larch_v1"], "u_jordan", p);
    expect(r).toMatchObject({ ok: false });
    expect(await read()).toEqual(before);
    expect(await runAction("addNote", [{ type: "deal", id: "deal_larch" }, "hi", "general"], "nobody", p)).toEqual({ ok: false, error: "Not signed in." });
  });

  it("refuses edits to an issued term set at the database level too", async () => {
    await expect(p.query("UPDATE tranche SET spread_bps = 1 WHERE term_set_id = 'ts_larch_v1'")).rejects.toThrow(/cannot be edited/);
  });

  it("keeps audit events append-only", async () => {
    await expect(p.query("UPDATE audit_event SET summary = 'x'")).rejects.toThrow(/append-only/);
    await expect(p.query("DELETE FROM audit_event")).rejects.toThrow(/append-only/);
  });

  it("only lets a chat's owner delete it", async () => {
    const id = await runWithDB("u_jordan", () => createThread("Mine"), p);
    expect(await runAction("deleteThread", [id], "u_marcus", p)).toMatchObject({ ok: false });
    expect(await runAction("deleteThread", [id], "u_jordan", p)).toEqual({ ok: true });
  });

  it("saves every kind of change: what's loaded back equals what the actions produced", async () => {
    // Run a long sequence of actions in memory against one loaded copy, saving
    // the diff after each, then compare with a fresh load. Covers inserts,
    // updates and deletes, and every child table.
    const c = await p.connect();
    try {
      await c.query("BEGIN");
      const ctx: DataContext = { db: await loadDB(c), actorId: "u_jordan" };
      const step = async <T>(actor: string, fn: () => T): Promise<T> => {
        const before = ctx.db;
        ctx.actorId = actor;
        const r = withContext(ctx, fn);
        expect(r, fn.toString()).not.toMatchObject({ ok: false });
        await saveDiff(c, before, ctx.db);
        return r;
      };
      await step("u_jordan", () => A.correctField("ef_larch_adj_ebitda_ltm", 16.3, "doc_larch_qoe", 2));
      await step("u_jordan", () => A.addNote({ type: "deal", id: "deal_larch" }, "Spoke to @Tom", "call", [{ type: "person", id: "per_tom_brandt" }]));
      const created = await step("u_jordan", () => A.createDeal({ name: "Project Test", newBorrowerName: "Test Co", strategy: "cash_flow", dealType: "lbo", requestedSize: 50, sampleCim: true }));
      await step("u_jordan", () => A.confirmAllAbove(created.id!));
      await step("u_jordan", () => A.addStakeholder("deal_larch", { companyId: "co_ashby", role: "Co-sponsor", side: "sponsor" }));
      const sh = ctx.db.stakeholders.at(-1)!.id;
      await step("u_jordan", () => A.removeStakeholder(sh));
      const v2 = await step("u_marcus", () => A.createTermSetVersion("deal_larch"));
      const tranches = ctx.db.tranches.filter((t) => t.termSetId === v2.termSetId);
      const covenants = ctx.db.covenants.filter((x) => x.termSetId === v2.termSetId).map((x) => ({ ...x, levels: [{ from: "2026-12-31", level: 7.5 }, { from: "2027-12-31", level: 7.0 }, { from: "2028-12-31", level: 6.5 }] }));
      await step("u_marcus", () => A.saveTermSetDraft(v2.termSetId!, tranches, covenants));
      await step("u_marcus", () => A.issueTermSet(v2.termSetId!));
      const v3 = await step("u_marcus", () => A.createTermSetVersion("deal_larch"));
      await step("u_marcus", () => A.discardTermSetDraft(v3.termSetId!));
      const flag = ctx.db.ddItems.find((d) => d.dealId === "deal_larch" && d.severity === "red_flag" && !d.icConditionId)!;
      await step("u_jordan", () => A.proposeIcCondition(flag.id, "Top customer contract extended before close", "pre_close", "u_marcus"));
      const stale = ctx.db.memoSections.filter((s) => sectionIsStale(ctx.db, s)).map((s) => s.id);
      await step("u_jordan", () => A.regenerateSections(stale));
      for (const s of ctx.db.memoSections.filter((x) => x.memoId === "memo_larch_final_v1")) await step("u_jordan", () => A.markSectionReviewed(s.id));
      await step("u_marcus", () => A.markMemoReady("memo_larch_final_v1"));
      await step("u_marcus", () => A.moveStage("deal_larch", "ic"));
      const ic = ctx.db.icEvents.find((e) => e.dealId === "deal_larch" && e.status === "pending")!;
      await step("u_robert", () => A.askIcQuestion(ic.id, "What if the top customer leaves?"));
      await step("u_marcus", () => A.answerIcQuestion(ic.id, 0, "Covenant headroom absorbs it."));
      await step("u_robert", () => A.recordVote(ic.id, "approve_with_conditions", "Subject to the contract extension"));
      await step("u_robert", () => A.decideIc(ic.id, "approve_with_conditions", 60));
      await step("u_robert", () => A.moveStage("deal_larch", "documentation"));
      const th = await step("u_jordan", () => createThread("Scratch"));
      await step("u_jordan", () => addChatMessage(th, { role: "user", content: "hi", toolCalls: [{ name: "x", input: { a: [1] }, resultSummary: "ok", rowCount: 1 }] }));
      await step("u_jordan", () => deleteThread(th));

      expect(await loadDB(c)).toEqual(ctx.db);
      expect(ctx.db.termSets.find((t) => t.id === v2.termSetId)?.status).toBe("locked");
      await c.query("ROLLBACK");
    } finally {
      c.release();
    }
  });
});
