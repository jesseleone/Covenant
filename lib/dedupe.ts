// Duplicate checks run before a Company or Person is created.
//
// Names are normalized first (case, punctuation, legal suffixes, common
// abbreviations), so "Wren Industrial Services" and "Wren Industrial Svcs."
// are the same name. Fuzzy matching then catches typos and partial names.

import Fuse from "fuse.js";
import type { Company, Person } from "@/lib/schema";

export const DUPLICATE_THRESHOLD = 0.35;

export type Match<T> = { item: T; score: number; matchedOn: string };

const ABBREVIATIONS: Record<string, string> = {
  svcs: "services", svc: "services", srvcs: "services", mgmt: "management", intl: "international", natl: "national",
  mfg: "manufacturing", tech: "technology", grp: "group", hldgs: "holdings", hldg: "holdings", bros: "brothers", "&": "and",
};
const LEGAL_SUFFIXES = new Set(["inc", "llc", "llp", "lp", "ltd", "co", "corp", "corporation", "company", "plc", "the"]);

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " & ")
    .replace(/[.,'’()]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ABBREVIATIONS[t] ?? t)
    .filter((t) => !LEGAL_SUFFIXES.has(t))
    .join(" ");
}

/** 0 for the same normalized name, 0.1 when one name's words all appear in the other, else the fuzzy score. */
function nameScore(query: string, candidate: string, fuzzy: number | undefined): number {
  const a = normalizeName(query), b = normalizeName(candidate);
  if (!a || !b) return 1;
  if (a === b) return 0;
  const ta = a.split(" "), tb = new Set(b.split(" "));
  if (ta.length >= 2 && ta.every((t) => tb.has(t))) return 0.1;
  return fuzzy ?? 1;
}

export function findCompanyMatches(companies: Company[], name: string): Match<Company>[] {
  const q = name.trim();
  if (q.length < 3) return [];
  const rows = companies.flatMap((c) => [c.name, ...c.aliases].map((label) => ({ c, label, norm: normalizeName(label) })));
  const fuse = new Fuse(rows, { keys: ["norm"], includeScore: true, ignoreLocation: true, threshold: 0.45 });
  const fuzzy = new Map(fuse.search(normalizeName(q)).map((r) => [r.refIndex, r.score ?? 1]));
  const scored = rows.map((r, i) => ({ item: r.c, matchedOn: r.label, score: nameScore(q, r.label, fuzzy.get(i)) }));
  return best(scored.filter((m) => m.score <= DUPLICATE_THRESHOLD), (c) => c.id);
}

export function findPersonMatches(people: Person[], name: string, email?: string): Match<Person>[] {
  const out: Match<Person>[] = [];
  const e = email?.trim().toLowerCase();
  if (e) for (const p of people) if (p.email?.toLowerCase() === e) out.push({ item: p, score: 0, matchedOn: p.email! });
  const q = name.trim();
  if (q.length >= 3) {
    const fuse = new Fuse(people, { keys: ["fullName"], includeScore: true, ignoreLocation: true, threshold: 0.45 });
    const fuzzy = new Map(fuse.search(q).map((r) => [r.refIndex, r.score ?? 1]));
    out.push(...people.map((p, i) => ({ item: p, matchedOn: p.fullName, score: nameScore(q, p.fullName, fuzzy.get(i)) })).filter((m) => m.score <= DUPLICATE_THRESHOLD));
  }
  return best(out, (p) => p.id);
}

function best<T>(matches: Match<T>[], key: (t: T) => string): Match<T>[] {
  const top = new Map<string, Match<T>>();
  for (const m of matches) {
    const k = key(m.item);
    const prev = top.get(k);
    if (!prev || m.score < prev.score) top.set(k, m);
  }
  return [...top.values()].sort((a, b) => a.score - b.score);
}
