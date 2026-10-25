// Memo and chat text never contains typed numbers. It carries tokens that are
// resolved against the DB at render time:
//   {{field:adj_ebitda_ltm}}  {{metric:total_leverage}}  {{tranche:tl.spread}}
//   {{covenant:total_leverage.current}}  [[cite:document:doc_larch_cim#p5|CIM p.5]]

import type { DB } from "@/lib/schema";
import {
  activeTermSet, covenantFor, currentCovenantLevel, cushionPct, documentById, facilitySize, fieldValue, fundedDebt,
  numField, totalLeverage, tranchesFor,
} from "@/lib/selectors";
import { fmtBps, fmtFieldValue, fmtMonthYear, fmtPct, fmtSpread, fmtUsdM, fmtX } from "@/lib/format";

export type Cite = { label: string; href: string };
export type Resolved = { text: string; cite?: Cite; unconfirmed?: boolean };

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "token"; token: string; resolved: Resolved }
  | { kind: "cite"; target: string; cite: Cite };

const TOKEN_RE = /\{\{([a-z_]+:[^}]+)\}\}|\[\[cite:([^|\]]+)\|([^\]]+)\]\]/g;

/** Route for a citation target such as `document:doc_larch_cim#p5` or `deal:deal_larch`. */
export function citeHref(db: DB, target: string): string {
  const [type, rest] = [target.slice(0, target.indexOf(":")), target.slice(target.indexOf(":") + 1)];
  const [id, anchor] = rest.split("#");
  switch (type) {
    case "document": {
      const doc = documentById(db, id);
      const page = anchor?.startsWith("p") ? anchor.slice(1) : undefined;
      return doc ? `/deals/${doc.dealId}/documents?doc=${id}${page ? `&page=${page}` : ""}` : "#";
    }
    case "deal": return `/deals/${id}/overview`;
    case "company": return `/companies/${id}/overview`;
    case "person": return `/people/${id}/overview`;
    case "term_set": {
      const ts = db.termSets.find((t) => t.id === id);
      return ts ? `/deals/${ts.dealId}/securities?v=${ts.version}` : "#";
    }
    case "ic_event": {
      const e = db.icEvents.find((x) => x.id === id);
      return e ? `/deals/${e.dealId}/ic` : "#";
    }
    case "dd_item": {
      const d = db.ddItems.find((x) => x.id === id);
      return d ? `/deals/${d.dealId}/diligence` : "#";
    }
    default: return "#";
  }
}

export function resolveToken(db: DB, dealId: string, token: string): Resolved {
  const [kind, path] = [token.slice(0, token.indexOf(":")), token.slice(token.indexOf(":") + 1)];
  const ts = activeTermSet(db, dealId);
  const tsCite: Cite | undefined = ts ? { label: `Term set v${ts.version}`, href: `/deals/${dealId}/securities?v=${ts.version}` } : undefined;
  const finCite: Cite = { label: "Financials", href: `/deals/${dealId}/financials` };

  if (kind === "field") {
    const v = fieldValue(db, dealId, path);
    if (!v) return { text: "[missing]" };
    // documentId/page always point at the current source (for a corrected
    // field, the correcting document; the original is kept in correctedFrom).
    const label = `${docShortName(documentById(db, v.field.documentId)?.docType)} p.${v.field.page}`;
    return {
      text: fmtFieldValue(v.field),
      cite: { label, href: `/deals/${dealId}/financials?field=${v.field.fieldKey}` },
      unconfirmed: v.unconfirmed,
    };
  }

  if (kind === "metric") {
    const unconfirmed = !!fieldValue(db, dealId, "adj_ebitda_ltm")?.unconfirmed;
    switch (path) {
      case "total_leverage": return { text: fmtX(totalLeverage(db, dealId)), cite: finCite, unconfirmed };
      case "cushion_pct": return { text: fmtPct(cushionPct(db, dealId)), cite: tsCite, unconfirmed };
      case "funded_debt": return { text: fmtUsdM(fundedDebt(db, ts?.id)), cite: tsCite };
      case "facility_size": return { text: fmtUsdM(facilitySize(db, ts?.id)), cite: tsCite };
      case "ev_multiple": {
        const ev = numField(db, dealId, "ev"); const e = numField(db, dealId, "adj_ebitda_ltm");
        return { text: ev && e ? fmtX(ev / e, 1) : "n/a", cite: finCite, unconfirmed };
      }
      case "ebitda_margin": {
        const r = numField(db, dealId, "revenue_ltm"); const e = numField(db, dealId, "adj_ebitda_ltm");
        return { text: r && e ? fmtPct(e / r) : "n/a", cite: finCite, unconfirmed };
      }
    }
    return { text: "[unknown metric]" };
  }

  if (kind === "tranche") {
    const [key, attr] = path.split(".");
    const t = tranchesFor(db, ts?.id).find((x) => x.key === key);
    if (!t) return { text: "[no tranche]" };
    const text = {
      spread: fmtSpread(t.spreadBps), floor: fmtBps(t.floorBps), oid: `${t.oidPct.toFixed(1)}%`,
      commitment: fmtUsdM(t.commitment), funded: fmtUsdM(t.fundedAtClose), maturity: fmtMonthYear(t.maturityDate),
      call: t.callProtection, hold: fmtUsdM(t.fundHold),
    }[attr] ?? "[unknown]";
    return { text, cite: tsCite };
  }

  if (kind === "covenant") {
    const [metric, attr] = path.split(".");
    const cov = covenantFor(db, ts?.id, metric as "total_leverage");
    if (!cov) return { text: "[no covenant]" };
    if (attr === "current") return { text: fmtX(currentCovenantLevel(cov, db.settings.today)), cite: tsCite };
    if (attr === "schedule") return { text: cov.levels.map((l) => fmtX(l.level)).join(" / "), cite: tsCite };
    return { text: "[unknown]" };
  }

  return { text: `[${token}]` };
}

export function docShortName(docType?: string) {
  switch (docType) {
    case "cim": return "CIM";
    case "qoe": return "QoE";
    case "model": return "Model";
    case "term_sheet": return "Term sheet";
    case "credit_agreement": return "Credit agreement";
    default: return "Doc";
  }
}

export function segment(db: DB, dealId: string | undefined, content: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of content.matchAll(TOKEN_RE)) {
    if (m.index! > last) out.push({ kind: "text", text: content.slice(last, m.index) });
    if (m[1]) out.push({ kind: "token", token: m[1], resolved: dealId ? resolveToken(db, dealId, m[1]) : { text: `[${m[1]}]` } });
    else out.push({ kind: "cite", target: m[2], cite: { label: m[3], href: citeHref(db, m[2]) } });
    last = m.index! + m[0].length;
  }
  if (last < content.length) out.push({ kind: "text", text: content.slice(last) });
  return out;
}

/** Resolve tokens into plain Markdown: values inline, citations as links. */
export function renderMarkdown(db: DB, dealId: string | undefined, content: string): string {
  return segment(db, dealId, content)
    .map((s) => (s.kind === "text" ? s.text : s.kind === "token" ? s.resolved.text : `[${s.cite.label}](${s.cite.href})`))
    .join("");
}
