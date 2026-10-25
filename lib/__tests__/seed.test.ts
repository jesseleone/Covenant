import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/seed";
import { sectionIsStale } from "@/lib/selectors";

const db = buildSeed();

describe("seed", () => {
  it("validates and has the expected volume", () => {
    expect(db.deals).toHaveLength(12);
    expect(db.companies.length).toBeGreaterThanOrEqual(25);
    expect(db.people.length).toBeGreaterThanOrEqual(40);
    expect(db.extractedFields.filter((f) => f.dealId === "deal_larch")).toHaveLength(22);
    expect(db.ddItems.filter((d) => d.dealId === "deal_larch")).toHaveLength(10);
    expect(db.memoSections.filter((s) => s.memoId === "memo_larch_final_v1")).toHaveLength(8);
  });

  it("places 3 deals in the Passed / Lost lane", () => {
    expect(db.deals.filter((d) => d.status === "passed" || d.status === "lost")).toHaveLength(3);
  });

  it("every extracted-field quote appears verbatim on its cited page", () => {
    for (const f of db.extractedFields) {
      const doc = db.documents.find((d) => d.id === f.documentId);
      const page = doc?.pages.find((p) => p.n === f.page);
      expect(page?.markdown, `${f.id} → ${f.documentId} p.${f.page}`).toContain(f.quote);
    }
  });

  it("every reference resolves", () => {
    const ids = (arr: { id: string }[]) => new Set(arr.map((x) => x.id));
    const deals = ids(db.deals), companies = ids(db.companies), people = ids(db.people), users = ids(db.users), termSets = ids(db.termSets);
    for (const d of db.deals) {
      expect(companies.has(d.borrowerCompanyId)).toBe(true);
      if (d.sponsorCompanyId) expect(companies.has(d.sponsorCompanyId)).toBe(true);
      expect(users.has(d.leadUserId)).toBe(true);
    }
    for (const a of db.affiliations) expect(people.has(a.personId) && companies.has(a.companyId), a.id).toBe(true);
    for (const s of db.stakeholders) {
      expect(deals.has(s.dealId)).toBe(true);
      expect(s.personId ? people.has(s.personId) : companies.has(s.companyId!), s.id).toBe(true);
    }
    for (const t of db.tranches) expect(termSets.has(t.termSetId)).toBe(true);
    for (const n of db.notes) for (const m of [n.subject, ...n.mentions]) {
      const set = m.type === "deal" ? deals : m.type === "company" ? companies : people;
      expect(set.has(m.id), `${n.id} → ${m.id}`).toBe(true);
    }
  });

  it("starts with no stale memo sections", () => {
    for (const s of db.memoSections) expect(sectionIsStale(db, s), s.id).toBe(false);
  });

  it("gives at least five people a role history", () => {
    const counts = new Map<string, number>();
    for (const a of db.affiliations) counts.set(a.personId, (counts.get(a.personId) ?? 0) + 1);
    expect([...counts.values()].filter((n) => n > 1).length).toBeGreaterThanOrEqual(5);
  });
});
