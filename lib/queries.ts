// Typed read functions over the DB. The UI uses these, and in a later step the
// chat tools map 1:1 onto them.

import type { DB, Deal, ICEvent, TermSet } from "@/lib/schema";
import { approvedTermSet, activeTermSet, dealById, leadTranche, totalLeverage } from "@/lib/selectors";

export type Precedent = {
  deal: Deal;
  score: number;
  sharedTags: string[];
  leverage: number | null;
  spreadBps: number | null;
  termSet: TermSet | undefined;
  icEvents: ICEvent[];
};

/**
 * Closed or passed deals similar to `dealId`: at least one shared sector tag,
 * size within ±50% and leverage within ±1.0x. Ranked by tag overlap, then size
 * and leverage proximity.
 */
export function findPrecedents(db: DB, dealId: string, limit = 6): Precedent[] {
  const target = dealById(db, dealId);
  if (!target) return [];
  const targetLev = totalLeverage(db, dealId);
  const tags = new Set(target.sectorTags);

  const out: Precedent[] = [];
  for (const d of db.deals) {
    if (d.id === dealId || d.status === "active" || d.status === "on_hold") continue;
    const sharedTags = d.sectorTags.filter((t) => tags.has(t));
    if (sharedTags.length === 0) continue;
    const sizeRatio = d.requestedSize / target.requestedSize;
    if (sizeRatio < 0.5 || sizeRatio > 1.5) continue;
    const ts = approvedTermSet(db, d.id) ?? activeTermSet(db, d.id);
    const lev = totalLeverage(db, d.id, ts?.id);
    if (targetLev !== null && lev !== null && Math.abs(lev - targetLev) > 1.0) continue;

    const union = new Set([...tags, ...d.sectorTags]).size;
    const jaccard = sharedTags.length / union;
    const sizeSim = 1 - Math.abs(1 - sizeRatio);
    const levSim = targetLev !== null && lev !== null ? 1 - Math.abs(lev - targetLev) : 0.5;
    const score = 0.6 * jaccard + 0.2 * sizeSim + 0.2 * levSim;

    out.push({
      deal: d, score, sharedTags, leverage: lev, spreadBps: leadTranche(db, ts?.id)?.spreadBps ?? null, termSet: ts,
      icEvents: db.icEvents.filter((e) => e.dealId === d.id).sort((a, b) => a.date.localeCompare(b.date)),
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
