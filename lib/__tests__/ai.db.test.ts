import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type pg from "pg";
import { sectionIsStale } from "@/lib/selectors";
import { answerChat, regenerateMemo, type ChatEvent } from "@/lib/server/ai";
import { pool } from "@/lib/server/db";
import { readDB, runAction } from "@/lib/server/run";
import { freshDatabase, hasDB, reseed, testPool } from "./db-helper";

// Offline mode: these tests never call Claude.
delete process.env.ANTHROPIC_API_KEY;

describe.skipIf(!hasDB)("chat and memo on the server (offline mode)", () => {
  let p: pg.Pool;
  beforeAll(async () => { p = testPool(); await freshDatabase(p); });
  afterAll(async () => { await p.end(); await pool().end(); });
  beforeEach(async () => { await reseed(p); });

  it("answers a chat turn: creates the thread, saves both messages, reports progress", async () => {
    const events: ChatEvent[] = [];
    await answerChat({ actorId: "u_jordan", title: "Red flags", prompt: "Which active deals have unresolved red flags?", scope: [], live: true }, (e) => events.push(e));
    const thread = events.find((e) => e.type === "thread");
    expect(thread).toBeDefined();
    expect(events.at(-1)).toEqual({ type: "done", mode: "offline" });
    expect(events.some((e) => e.type === "step")).toBe(true);
    const db = await readDB();
    const id = (thread as { id: string }).id;
    expect(db.chatThreads.find((t) => t.id === id)).toMatchObject({ ownerId: "u_jordan", title: "Red flags" });
    const msgs = db.chatMessages.filter((m) => m.threadId === id);
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs[1].mode).toBe("offline");
    expect(msgs[1].toolCalls?.length).toBeGreaterThan(0);
  });

  it("won't answer into someone else's thread", async () => {
    const events: ChatEvent[] = [];
    await answerChat({ actorId: "u_jordan", title: "Mine", prompt: "Which active deals have unresolved red flags?", scope: [], live: false }, (e) => events.push(e));
    const id = (events.find((e) => e.type === "thread") as { id: string }).id;
    const other: ChatEvent[] = [];
    await answerChat({ actorId: "u_marcus", threadId: id, title: "", prompt: "hi", scope: [], live: false }, (e) => other.push(e));
    expect(other).toEqual([{ type: "error", message: "Chat not found." }]);
  });

  it("regenerates stale memo sections offline and clears staleness", async () => {
    await runAction("correctField", ["ef_larch_adj_ebitda_ltm", 16.3, "doc_larch_qoe", 2], "u_jordan");
    let db = await readDB();
    const stale = db.memoSections.filter((s) => sectionIsStale(db, s)).map((s) => s.id);
    expect(stale.length).toBeGreaterThan(0);
    const r = await regenerateMemo("u_jordan", stale);
    expect(r).toMatchObject({ result: { ok: true }, liveCount: 0 });
    db = await readDB();
    expect(db.memoSections.filter((s) => sectionIsStale(db, s))).toHaveLength(0);
  });

  it("refuses memo regeneration for a role without memo rights", async () => {
    const r = await regenerateMemo("u_robert", ["ms_larch_exec"]);
    expect(r.result.ok).toBe(false);
  });
});
