// IC memo support: why a section is stale, which queries feed it, and the
// deterministic offline generator used when no AI key is configured.
// Generated text never types a financial figure; it writes tokens that render
// live values (see lib/render/tokens.ts).

import type { DB, MemoSection } from "@/lib/schema";
import {
  activeTermSet, covenantFor, cushionPct, documentById, fieldValue, memoDealId, serializeDependency, termSetsFor, tranchesFor,
} from "@/lib/selectors";
import { docShortName } from "@/lib/render/tokens";
import { fmtDate, fmtPct, fmtUsdM, fmtX, titleCase } from "@/lib/format";
import { covenantSchedule } from "@/lib/terms";

// ---------------------------------------------------------------------------
// Staleness, explained
// ---------------------------------------------------------------------------

export type StaleReason = { dep: string; label: string; before: string; after: string };

const num = (s?: string) => (s === undefined || s === "null" ? null : Number(s));

export function depLabel(db: DB, dealId: string, dep: string): string {
  const [kind, name] = dep.split(":");
  if (kind === "field") return fieldValue(db, dealId, name)?.field.label ?? name;
  if (kind === "metric") return name === "total_leverage" ? "Total leverage" : name === "cushion_pct" ? "Covenant cushion" : titleCase(name);
  if (kind === "termset") return "Active term set";
  if (kind === "covenant") return "Covenant schedule";
  if (dep === "dd:red_flags") return "Red-flag findings";
  if (dep === "dd:open_items") return "Open diligence items";
  return dep;
}

/** Human-readable value for a serialized dependency. */
export function depDisplay(db: DB, dealId: string, dep: string, raw: string | undefined): string {
  if (raw === undefined || raw === "null") return "—";
  const [kind, name] = dep.split(":");
  if (kind === "field") {
    const f = fieldValue(db, dealId, name)?.field;
    const n = num(raw);
    if (f && n !== null && !Number.isNaN(n)) return f.unit === "usd_m" ? fmtUsdM(n) : f.unit === "pct" ? `${n}%` : String(n);
    return raw;
  }
  if (kind === "metric") return name === "cushion_pct" ? fmtPct(num(raw)) : fmtX(num(raw));
  if (kind === "termset") { try { return `v${JSON.parse(raw).v}`; } catch { return raw; } }
  if (kind === "dd") { try { return `${JSON.parse(raw).length} item(s)`; } catch { return raw; } }
  if (kind === "covenant") { try { return (JSON.parse(raw) as { level: number }[]).map((l) => fmtX(l.level)).join(" / "); } catch { return raw; } }
  return raw;
}

export function staleReasons(db: DB, section: MemoSection): StaleReason[] {
  const dealId = memoDealId(db, section);
  if (!dealId) return [];
  return section.dependencies
    .map((dep) => ({ dep, now: serializeDependency(db, dealId, dep), then: section.snapshot[dep] }))
    .filter((x) => x.now !== x.then)
    .map((x) => {
      let after = depDisplay(db, dealId, x.dep, x.now);
      let before = depDisplay(db, dealId, x.dep, x.then);
      if (x.dep.startsWith("termset") && before === after) { before = "earlier terms"; after = `${after} (edited)`; }
      if (x.dep.startsWith("dd:") && before === after) { before = "earlier status"; after = "updated"; }
      return { dep: x.dep, label: depLabel(db, dealId, x.dep), before, after };
    });
}

/** The query tools a regeneration of this section would call (chat uses the same tools). */
export function queriesFor(section: MemoSection, dealId: string): string[] {
  const q = new Set<string>([`get_deal("${dealId}")`]);
  for (const d of section.dependencies) {
    if (d.startsWith("field:") || d.startsWith("metric:")) q.add(`get_financials("${dealId}")`);
    if (d.startsWith("termset") || d.startsWith("covenant") || d === "metric:cushion_pct") q.add(`get_term_set("${dealId}", "active")`);
    if (d.startsWith("dd:")) q.add(`get_dd_items("${dealId}")`);
  }
  if (section.key === "recommendation" || section.key === "key_risks") q.add(`get_ic_events("${dealId}")`);
  return [...q];
}

// ---------------------------------------------------------------------------
// Offline generator
// ---------------------------------------------------------------------------

const cite = (db: DB, docId: string, page: number) => `[[cite:document:${docId}#p${page}|${docShortName(documentById(db, docId)?.docType)} p.${page}]]`;

/**
 * Rebuild a section from current records. Returns `null` when there is no
 * template for the section, in which case the existing text is kept and only
 * its snapshot is refreshed.
 */
export function offlineSection(db: DB, dealId: string, section: MemoSection): string | null {
  const deal = db.deals.find((d) => d.id === dealId)!;
  const ts = activeTermSet(db, dealId);
  const v1 = termSetsFor(db, dealId)[0];
  const guide = db.settings.coverageCushionGuidelinePct;
  const cushion = cushionPct(db, dealId);
  const vsGuide = cushion === null ? "" : cushion * 100 >= guide ? `, above our ${guide}% guideline` : `, below our ${guide}% guideline`;
  const ebitda = fieldValue(db, dealId, "adj_ebitda_ltm");
  const corrected = ebitda?.field.status === "corrected";
  const ebitdaSrc = ebitda ? cite(db, ebitda.field.documentId, ebitda.field.page) : "";
  const findings = db.ddItems.filter((d) => d.dealId === dealId && d.kind === "finding" && (d.severity === "red_flag" || d.severity === "high"));
  const conditions = db.icConditions.filter((c) => c.dealId === dealId && c.status !== "satisfied");
  const tr = tranchesFor(db, ts?.id);
  const has = (k: string) => tr.some((t) => t.key === k);
  const covChanged = ts && v1 && ts.id !== v1.id && covenantSchedule(covenantFor(db, ts.id)) !== covenantSchedule(covenantFor(db, v1.id));

  switch (section.key) {
    case "financial_analysis": {
      const bridge = corrected
        ? `We underwrite LTM adjusted EBITDA of {{field:adj_ebitda_ltm}}, a {{metric:ebitda_margin}} margin, which is the diligence-adjusted figure from the quality of earnings ${ebitdaSrc}. The QoE accepts the owner compensation and one-time ERP add-backs but excludes the {{field:pricing_addback}} pricing run-rate, which is not yet in invoiced revenue. The CIM's higher figure ${cite(db, ebitda!.field.correctedFrom!.documentId, ebitda!.field.correctedFrom!.page)} is not used for underwriting.`
        : `We underwrite LTM adjusted EBITDA of {{field:adj_ebitda_ltm}}, a {{metric:ebitda_margin}} margin ${ebitdaSrc}.${ebitda?.unconfirmed ? " This figure is still awaiting confirmation against the QoE." : ""}`;
      return [
        `Revenue grew from {{field:revenue_fy24}} in FY2024 to {{field:revenue_fy25}} in FY2025 and {{field:revenue_ltm}} for the LTM period ${cite(db, fieldValue(db, dealId, "revenue_ltm")?.field.documentId ?? "", fieldValue(db, dealId, "revenue_ltm")?.field.page ?? 1)}. Adjusted EBITDA was {{field:adj_ebitda_fy24}} in FY2024 and {{field:adj_ebitda_fy25}} in FY2025.`,
        bridge,
        fieldValue(db, dealId, "maintenance_capex") ? `Maintenance capex is light at {{field:maintenance_capex}}, supporting strong free cash flow conversion.` : "",
        `On this basis, total leverage at close is {{metric:total_leverage}} on funded debt of {{metric:funded_debt}}, and the purchase price implies {{metric:ev_multiple}} adjusted EBITDA.`,
      ].filter(Boolean).join("\n\n");
    }

    case "structure_terms": {
      const rows = tr.map((t) => `| ${t.name} | {{tranche:${t.key}.commitment}} | {{tranche:${t.key}.funded}} | {{tranche:${t.key}.spread}} |`).join("\n");
      const lead = has("tl") ? "tl" : tr[0]?.key;
      return [
        `Term set v${ts?.version} (${ts ? titleCase(ts.label).toLowerCase() : ""}, ${ts?.status}) totals {{metric:facility_size}}:`,
        `| Tranche | Commitment | Funded at close | Pricing |\n|---|---|---|---|\n${rows}`,
        lead ? `Pricing carries a {{tranche:${lead}.floor}} SOFR floor and {{tranche:${lead}.oid}} OID, with call protection of {{tranche:${lead}.call}}. The term loan matures in {{tranche:${lead}.maturity}}.` : "",
        covenantFor(db, ts?.id)
          ? `A maximum total leverage covenant is tested quarterly at {{covenant:total_leverage.schedule}}.${covChanged ? ` Term set v${ts!.version} resets this schedule from v${v1!.version} to restore headroom.` : ""} Leverage at close of {{metric:total_leverage}} against the opening level of {{covenant:total_leverage.current}} leaves {{metric:cushion_pct}} cushion${vsGuide}.`
          : "There is no maintenance financial covenant.",
      ].filter(Boolean).join("\n\n");
    }

    case "key_risks": {
      const items = findings.map((d) => {
        const cond = db.icConditions.find((c) => c.id === d.icConditionId);
        const mit = cond ? `IC condition proposed: ${cond.description.charAt(0).toLowerCase()}${cond.description.slice(1)}.` : d.mitigant ? d.mitigant : "None yet; to be resolved before final IC.";
        return `**${d.title}${d.severity === "red_flag" ? " (red flag)" : ""}.** ${d.detail} *Mitigant:* ${mit} [[cite:dd_item:${d.id}|DD · ${d.workstream === "qoe" ? "QoE" : titleCase(d.workstream)}]]`;
      });
      items.push(`**Covenant headroom.** Cushion against the opening covenant level is {{metric:cushion_pct}}${vsGuide}.${covChanged ? ` This reflects the covenant reset in term set v${ts!.version}.` : ""}`);
      return items.join("\n\n");
    }

    case "diligence_status": {
      const dd = db.ddItems.filter((d) => d.dealId === dealId);
      const closed = dd.filter((d) => d.status === "closed" || d.status === "accepted");
      const open = dd.filter((d) => d.kind === "request" && (d.status === "open" || d.status === "received"));
      const qoe = db.documents.find((d) => d.dealId === dealId && d.docType === "qoe");
      return [
        `Diligence is ${open.length === 0 ? "complete" : "substantially complete"}: ${closed.length} of ${dd.length} items are closed or accepted.`,
        qoe ? `- **Quality of earnings:** report received ${cite(db, qoe.id, Math.min(2, qoe.pages.length))}; see Financial Analysis.` : "",
        ...findings.map((d) => `- **${d.title}:** ${d.icConditionId ? "IC condition proposed" : d.mitigant ? "mitigated" : d.status}.`),
        open.length ? `- **Open requests:** ${open.map((d) => `${d.title}${d.dueDate ? ` (due ${fmtDate(d.dueDate)})` : ""}`).join("; ")}.` : "",
      ].filter(Boolean).join("\n");
    }

    case "recommendation": {
      const list = [
        ...conditions.map((c) => `${c.description} (${c.type === "pre_close" ? "pre-close" : c.type === "post_close" ? "post-close" : "terms"}).`),
        ...(corrected ? ["Underwriting EBITDA to follow the QoE, not the CIM bridge."] : []),
        "Customary closing conditions, including completion of open diligence requests.",
      ];
      return [
        `The deal team recommends **approval** of a {{metric:facility_size}} senior secured facility to ${db.companies.find((c) => c.id === deal.borrowerCompanyId)?.name} at {{tranche:${has("tl") ? "tl" : tr[0]?.key}.spread}}, under term set v${ts?.version}.`,
        `At {{metric:total_leverage}} total leverage and {{metric:cushion_pct}} covenant cushion${vsGuide}, the structure is consistent with our guidelines for sponsor-backed services credits.`,
        `Recommended conditions:\n\n${list.map((l, i) => `${i + 1}. ${l}`).join("\n")}`,
      ].join("\n\n");
    }

    default:
      return null;
  }
}
