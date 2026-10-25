// Duplicate checks run before a Company or Person is created.

import Fuse from "fuse.js";
import type { Company, Person } from "@/lib/schema";

export const DUPLICATE_THRESHOLD = 0.35;

export type Match<T> = { item: T; score: number; matchedOn: string };

export function findCompanyMatches(companies: Company[], name: string): Match<Company>[] {
  const q = name.trim();
  if (q.length < 3) return [];
  const rows = companies.flatMap((c) => [c.name, ...c.aliases].map((label) => ({ c, label })));
  const fuse = new Fuse(rows, { keys: ["label"], includeScore: true, ignoreLocation: true, threshold: DUPLICATE_THRESHOLD });
  return dedupeByItem(fuse.search(q).map((r) => ({ item: r.item.c, score: r.score ?? 1, matchedOn: r.item.label })), (c) => c.id);
}

export function findPersonMatches(people: Person[], name: string, email?: string): Match<Person>[] {
  const out: Match<Person>[] = [];
  const e = email?.trim().toLowerCase();
  if (e) for (const p of people) if (p.email?.toLowerCase() === e) out.push({ item: p, score: 0, matchedOn: p.email! });
  const q = name.trim();
  if (q.length >= 3) {
    const fuse = new Fuse(people, { keys: ["fullName"], includeScore: true, ignoreLocation: true, threshold: DUPLICATE_THRESHOLD });
    out.push(...fuse.search(q).map((r) => ({ item: r.item, score: r.score ?? 1, matchedOn: r.item.fullName })));
  }
  return dedupeByItem(out, (p) => p.id);
}

function dedupeByItem<T>(matches: Match<T>[], key: (t: T) => string): Match<T>[] {
  const best = new Map<string, Match<T>>();
  for (const m of matches) {
    const k = key(m.item);
    const prev = best.get(k);
    if (!prev || m.score < prev.score) best.set(k, m);
  }
  return [...best.values()].sort((a, b) => a.score - b.score);
}
