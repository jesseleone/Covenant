import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/seed";
import { viewFor } from "@/lib/server/run";
import { resetAllowed } from "@/lib/server/seed";

describe("what each person receives", () => {
  const db = buildSeed();

  it("only their own chat threads and messages", () => {
    const view = viewFor(db, "u_marcus");
    expect(view.chatThreads.length).toBeGreaterThan(0);
    expect(view.chatThreads.every((t) => t.ownerId === "u_marcus")).toBe(true);
    const mine = new Set(view.chatThreads.map((t) => t.id));
    expect(view.chatMessages.every((m) => mine.has(m.threadId))).toBe(true);
    expect(view.chatMessages.length).toBeLessThan(db.chatMessages.length);
  });

  it("everything else unchanged", () => {
    const view = viewFor(db, "u_robert");
    for (const key of Object.keys(db) as (keyof typeof db)[]) {
      if (key !== "chatThreads" && key !== "chatMessages") expect(view[key], key).toBe(db[key]);
    }
  });
});

describe("reset demo data", () => {
  it("is allowed in development, refused in production unless switched on", () => {
    expect(resetAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(resetAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(resetAllowed({ NODE_ENV: "production", COVENANT_ALLOW_RESET: "1" })).toBe(true);
    expect(resetAllowed({ NODE_ENV: "development", COVENANT_ALLOW_RESET: "0" })).toBe(false);
  });
});
