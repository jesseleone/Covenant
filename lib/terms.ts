// Term-set comparison. Used by the Securities compare view and to write a
// readable audit entry when a draft is saved.

import type { Covenant, Tranche } from "@/lib/schema";
import { fmtBps, fmtDate, fmtSpread, fmtUsdM, fmtX } from "@/lib/format";

export type TermsSnapshot = { tranches: Tranche[]; covenants: Covenant[] };

export type TermField = { key: keyof Tranche; label: string; fmt: (v: Tranche[keyof Tranche]) => string };

export const TRANCHE_FIELDS: TermField[] = [
  { key: "commitment", label: "Commitment", fmt: (v) => fmtUsdM(v as number) },
  { key: "fundedAtClose", label: "Funded at close", fmt: (v) => fmtUsdM(v as number) },
  { key: "fundHold", label: "Fernhill hold", fmt: (v) => fmtUsdM(v as number) },
  { key: "lienRank", label: "Lien", fmt: (v) => String(v) },
  { key: "spreadBps", label: "Spread", fmt: (v) => fmtSpread(v as number) },
  { key: "floorBps", label: "Floor", fmt: (v) => fmtBps(v as number) },
  { key: "oidPct", label: "OID", fmt: (v) => `${(v as number).toFixed(1)}%` },
  { key: "pikBps", label: "PIK", fmt: (v) => ((v as number) ? fmtBps(v as number) : "—") },
  { key: "callProtection", label: "Call protection", fmt: (v) => String(v) },
  { key: "maturityDate", label: "Maturity", fmt: (v) => fmtDate(v as string) },
  { key: "amortPctPerYear", label: "Amortization", fmt: (v) => `${v}% / yr` },
];

export const covenantSchedule = (c?: Covenant) =>
  c ? [...c.levels].sort((a, b) => a.from.localeCompare(b.from)).map((l) => fmtX(l.level)).join(" / ") : "—";

export type Change = { section: string; label: string; before: string; after: string };

/** Field-level differences between two term sets, matched by tranche key and covenant metric. */
export function diffTerms(a: TermsSnapshot, b: TermsSnapshot): Change[] {
  const out: Change[] = [];
  const keys = [...new Set([...a.tranches.map((t) => t.key), ...b.tranches.map((t) => t.key)])];
  for (const key of keys) {
    const ta = a.tranches.find((t) => t.key === key);
    const tb = b.tranches.find((t) => t.key === key);
    const name = (tb ?? ta)!.name;
    if (!ta) { out.push({ section: name, label: "Tranche", before: "—", after: `Added (${fmtUsdM(tb!.commitment)})` }); continue; }
    if (!tb) { out.push({ section: name, label: "Tranche", before: fmtUsdM(ta.commitment), after: "Removed" }); continue; }
    for (const f of TRANCHE_FIELDS) {
      if (ta[f.key] !== tb[f.key]) out.push({ section: name, label: f.label, before: f.fmt(ta[f.key]), after: f.fmt(tb[f.key]) });
    }
    if (ta.name !== tb.name) out.push({ section: name, label: "Name", before: ta.name, after: tb.name });
  }
  const metrics = [...new Set([...a.covenants.map((c) => c.metric), ...b.covenants.map((c) => c.metric)])];
  for (const m of metrics) {
    const ca = a.covenants.find((c) => c.metric === m);
    const cb = b.covenants.find((c) => c.metric === m);
    const sa = covenantSchedule(ca), sb = covenantSchedule(cb);
    const datesA = ca?.levels.map((l) => l.from).join(), datesB = cb?.levels.map((l) => l.from).join();
    if (sa !== sb || datesA !== datesB) out.push({ section: "Covenant", label: m === "total_leverage" ? "Max total leverage" : m, before: sa, after: sb });
  }
  return out;
}

export const summarizeChanges = (changes: Change[], max = 4) =>
  changes.length === 0
    ? "no changes"
    : changes.slice(0, max).map((c) => `${c.section === "Covenant" ? "" : `${c.section} `}${c.label.toLowerCase()} ${c.before} → ${c.after}`).join("; ") +
      (changes.length > max ? ` (+${changes.length - max} more)` : "");
