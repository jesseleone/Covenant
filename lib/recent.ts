"use client";

// Recently opened records, per browser, for the command palette.

export type RecentRef = { type: "deal" | "company" | "person"; id: string };

const KEY = "covenant-recent";

export function getRecent(): RecentRef[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

export function pushRecent(ref: RecentRef) {
  try {
    const next = [ref, ...getRecent().filter((r) => r.id !== ref.id)].slice(0, 8);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}
