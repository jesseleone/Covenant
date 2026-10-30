// Test helpers for extensions. An extension's test imports from here (and
// from "vitest"): it renders the view with the demo data loaded, signed in as
// a persona, with writes recorded instead of sent to the server.
//
//   import { describe, expect, it } from "vitest";
//   import { renderExtension, screen } from "@/lib/sdk/testing";
//   import View from "./index";
//
//   it("shows every sector", () => {
//     renderExtension(<View />);
//     expect(screen.getByText("Business services")).toBeTruthy();
//   });

import { afterEach, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { buildSeed } from "@/lib/seed";
import type { DB } from "@/lib/schema";
import { useDBStore, useSessionStore } from "@/lib/store";

export { fireEvent, screen, waitFor, within } from "@testing-library/react";

export type RecordedWrite = { action: string; args: unknown[] };
let writes: RecordedWrite[] = [];

/** The demo data, as the app loads it. */
export const demoData = (): DB => buildSeed();

/**
 * Render an extension view with the demo data, signed in as `as`
 * (default: Jordan Reyes, analyst). Writes are recorded, not sent; read them
 * with `recordedWrites()`.
 */
export function renderExtension(ui: React.ReactElement, opts: { as?: string; data?: DB } = {}) {
  writes = [];
  const db = opts.data ?? buildSeed();
  useDBStore.setState({ db });
  useSessionStore.setState({ userId: opts.as ?? "u_jordan" });
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const m = /\/api\/actions\/(\w+)/.exec(String(url));
    if (m) writes.push({ action: m[1], args: JSON.parse(String(init?.body ?? "{}")).args ?? [] });
    return new Response(JSON.stringify({ result: { ok: true } }), { headers: { "content-type": "application/json" } });
  });
  return render(ui);
}

/** The writes the view made since it was rendered, e.g. [{ action: "addNote", args: [...] }]. */
export const recordedWrites = () => writes;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
