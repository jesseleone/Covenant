// Offline chat: when no API key is configured (or the call fails), questions
// are matched to one of the supported intents and answered by running the
// same query tools Claude would call. Answers are deterministic and cite
// the records they come from.

import type { DB } from "@/lib/schema";
import { runTool, type ToolCallRecord } from "./query-tools";
import type { ScopeRef } from "./prompts";

type Row = Record<string, unknown> & { cite: string };
type Ctx = { db: DB; calls: ToolCallRecord[] };

const call = <T>(ctx: Ctx, name: string, input: unknown): T => {
  const { result, record } = runTool(ctx.db, name, input);
  ctx.calls.push(record);
  return result as T;
};

const x = (n: unknown) => (typeof n === "number" ? `${n.toFixed(2)}x` : "n/a");
const s = (bps: unknown) => (typeof bps === "number" ? `S+${bps}` : "—");
const m = (n: unknown) => (typeof n === "number" ? `$${n.toFixed(1)}M` : "—");
const pct = (n: unknown) => (typeof n === "number" ? `${n.toFixed(1)}%` : "n/a");
const decision = (r: Row) => {
  const ic = r.lastIcDecision as { decision: string; cite: string } | null;
  return ic ? ic.cite.replace(/\|[^\]]*\]\]$/, `|${ic.decision.replace(/_/g, " ")}]]`) : "—";
};

/** The deal a question is about: an @-scoped deal, or one named in the text. */
function resolveDeal(ctx: Ctx, q: string, scope: ScopeRef[]): string | null {
  const scoped = scope.find((x) => x.type === "deal");
  if (scoped) return scoped.id;
  const named = ctx.db.deals.find((d) => new RegExp(`\\b(project\\s+)?${d.codename}\\b`, "i").test(q));
  if (named) {
    call(ctx, "search_entities", { query: named.name, types: ["deal"] });
    return named.id;
  }
  return null;
}

export function answerOffline(db: DB, question: string, scope: ScopeRef[] = []): { text: string; toolCalls: ToolCallRecord[] } {
  const ctx: Ctx = { db, calls: [] };
  const q = question.toLowerCase();
  let text: string;

  if (/(spread|pricing|leverage).*(approv|closed)|(approv|closed).*(spread|leverage)/.test(q)) text = pricingHistory(ctx, q);
  else if (/red.?flag|unresolved|open (finding|issue)s?/.test(q)) text = redFlags(ctx);
  else if (/(what|anything).*(changed|since)|since (the )?(screening|last) ic|what'?s new/.test(q)) text = changes(ctx, q, scope);
  else if (/who do we know|relationship|history with|contacts? at/.test(q)) text = relationships(ctx, question, scope);
  else if (/precedent|comparable|similar deals?|questions? (did )?ic/.test(q)) text = precedents(ctx, q, scope);
  else text = generic(ctx, question, scope);

  return { text, toolCalls: ctx.calls };
}

// ---------------------------------------------------------------------------

function pricingHistory(ctx: Ctx, q: string) {
  const min = Number(q.match(/(?:over|above|>|more than)\s*\$?(\d+)\s*m/)?.[1] ?? 0) || undefined;
  const sector = /services/.test(q) ? "business services" : /healthcare/.test(q) ? "healthcare" : /software/.test(q) ? "software" : undefined;
  const closed = call<Row[]>(ctx, "list_deals", { status: "closed", sectorKeyword: sector, minSize: min });
  const passed = /pass|declin|lost|why not/.test(q) ? call<Row[]>(ctx, "list_deals", { status: "passed_or_lost", sectorKeyword: sector, minSize: min }) : [];
  if (closed.length) call(ctx, "get_ic_events", { dealIds: closed.map((r) => r.id) });

  const scopeText = `${sector ? `${sector} ` : ""}deals${min ? ` over $${min}M` : ""}`;
  const out: string[] = [];
  if (closed.length === 0) out.push(`We have no closed ${scopeText} in the database.`);
  else {
    const levs = closed.map((r) => r.leverageX).filter((v): v is number => typeof v === "number");
    const spreads = closed.map((r) => r.spreadBps).filter((v): v is number => typeof v === "number");
    out.push(`We approved and closed ${closed.length} ${scopeText}, at ${x(Math.min(...levs))}–${x(Math.max(...levs))} leverage and ${s(Math.min(...spreads))}–${s(Math.max(...spreads))}:`);
    out.push(table(["Deal", "Closed", "Size", "Leverage", "Spread", "Cushion at close", "IC decision"],
      closed.map((r) => [r.cite, String(r.closedAt ?? "—").slice(0, 7), m(r.facilitySizeM), x(r.leverageX), s(r.spreadBps), pct(r.cushionPct), decision(r)])));
    const reset = closed.find((r) => ctx.db.deals.find((d) => d.id === r.id)?.tags.includes("covenant reset"));
    if (reset) out.push(`${reset.cite} later needed a covenant reset (Apr 2025); it closed with ${pct(reset.cushionPct)} cushion, the thinnest of the group.`);
  }
  if (passed.length) {
    out.push(`We passed on or lost ${passed.length} comparable ${passed.length === 1 ? "deal" : "deals"}:`);
    out.push(table(["Deal", "Size", "Leverage", "Spread", "Outcome", "Reason"],
      passed.map((r) => [r.cite, m(r.facilitySizeM), x(r.leverageX), s(r.spreadBps), String(r.status), `${r.passReason}: ${r.passNote ?? ""}`])));
  }
  return out.join("\n\n");
}

function redFlags(ctx: Ctx) {
  const active = call<Row[]>(ctx, "list_deals", { status: "active" });
  const rows: string[][] = [];
  for (const d of active) {
    const flags = call<Row[]>(ctx, "get_dd_items", { dealId: d.id, severity: "red_flag" });
    for (const f of flags) {
      const cond = f.icCondition as { description: string; status: string } | null;
      const resolved = cond || f.mitigant;
      rows.push([d.cite, `${f.title} ${f.cite}`, resolved ? (cond ? `IC condition (${cond.status}): ${cond.description}` : String(f.mitigant)) : "**None yet**", String(d.stage)]);
    }
  }
  if (rows.length === 0) return `None of the ${active.length} active deals has a red-flag finding.`;
  const open = rows.filter((r) => r[2] === "**None yet**").length;
  return [
    open ? `${open} red-flag finding${open === 1 ? " is" : "s are"} unresolved across ${active.length} active deals:` : `Every red-flag finding on the ${active.length} active deals has a mitigant or IC condition:`,
    table(["Deal", "Finding", "Mitigant / IC condition", "Stage"], rows),
    open ? "Unresolved red flags block the move to IC until they carry a mitigant or an IC condition." : "",
  ].filter(Boolean).join("\n\n");
}

function changes(ctx: Ctx, q: string, scope: ScopeRef[]) {
  const dealId = resolveDeal(ctx, q, scope);
  if (!dealId) return "Which deal? Mention it with @ (for example @Project Larch) or name it in the question.";
  const deal = call<Row>(ctx, "get_deal", { dealId });
  const h = call<{ sinceLabel: string | null; events: { at: string; who: string; action: string; summary: string }[] }>(ctx, "get_history", { dealId, sinceIso: "last_ic" });
  const groups: [string, RegExp][] = [["Financials", /^field\./], ["Terms", /^termset\./], ["Diligence", /^dd\.|^ic\.condition/], ["Memo", /^memo\./], ["Stage and IC", /^stage\.|^ic\.|^deal\./], ["Notes and documents", /^note\.|^document\./]];
  const out = [`${h.events.length} change${h.events.length === 1 ? "" : "s"} on ${deal.cite} since the ${h.sinceLabel ?? "start of the deal"}:`];
  for (const [label, re] of groups) {
    const ev = h.events.filter((e) => re.test(e.action));
    if (!ev.length) continue;
    // Collapse repeated section reviews into one line.
    const reviews = ev.filter((e) => e.action === "memo.review");
    const rest = ev.filter((e) => e.action !== "memo.review");
    out.push(`**${label}**\n\n${[...rest.map((e) => `- ${e.at} · ${e.summary} (${e.who})`), ...(reviews.length ? [`- ${reviews.length} memo section${reviews.length === 1 ? "" : "s"} reviewed`] : [])].join("\n")}`);
  }
  const ts = call<Row>(ctx, "get_term_set", { dealId, which: "active" });
  out.push(`Current position: leverage ${x(ts.leverageX)}, cushion ${pct(ts.cushionPct)} on term set v${ts.version} (${ts.status}) ${ts.cite}.`);
  return out.join("\n\n");
}

function relationships(ctx: Ctx, question: string, scope: ScopeRef[]) {
  let companyId = scope.find((x) => x.type === "company")?.id;
  if (!companyId) {
    const name = question.match(/(?:at|with)\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*)*)/)?.[1] ?? question;
    const hits = call<Row[]>(ctx, "search_entities", { query: name, types: ["company"] });
    companyId = hits[0]?.id as string | undefined;
  }
  if (!companyId) return "I couldn't find that company in the database.";
  const c = call<{ cite: string; people: Row[]; deals: (Row & { role: string })[] }>(ctx, "get_company", { companyId });
  const current = c.people.filter((p) => p.current);
  const former = c.people.filter((p) => !p.current);
  const out = [`We know ${current.length} ${current.length === 1 ? "person" : "people"} at ${c.cite}${c.deals.length ? ` and have seen ${c.deals.length} of their deals` : ""}.`];
  if (current.length) out.push(table(["Name", "Title", "Relationship owner", "Strength"], current.map((p) => [p.cite, String(p.title), String(p.relationshipOwner ?? "—"), String(p.strength)])));
  if (former.length) out.push(`Former: ${former.map((p) => `${p.cite} (${p.title}, to ${String(p.to ?? "").slice(0, 4)})`).join("; ")}.`);
  if (c.deals.length) {
    out.push("**Deals**");
    out.push(table(["Deal", "Role", "Outcome", "Size", "Leverage", "Spread", "Note"], c.deals.map((d) => [d.cite, d.role, `${d.status}${d.status === "Active" ? ` · ${d.stage}` : ""}`, m(d.facilitySizeM), x(d.leverageX), s(d.spreadBps), d.passReason ? `${d.passReason}: ${d.passNote}` : ""])));
  }
  return out.join("\n\n");
}

function precedents(ctx: Ctx, q: string, scope: ScopeRef[]) {
  const dealId = resolveDeal(ctx, q, scope);
  if (!dealId) return "Which deal should I find precedents for? Mention it with @.";
  const deal = call<Row>(ctx, "get_deal", { dealId });
  const ps = call<(Row & { icQuestions: { question: string; answer: string | null; askedBy: string; date: string }[]; similarity: number; topCustomerPct: unknown; tags: string[] })[]>(ctx, "find_precedents", { dealId });
  if (!ps.length) return `No closed or passed deals are close enough to ${deal.cite} to count as precedents.`;
  const out = [
    `${ps.length} precedents for ${deal.cite}, ranked by similarity (sector, size and leverage):`,
    table(["Deal", "Outcome", "Leverage", "Spread", "Match", "Flag"], ps.map((p) => [p.cite, `${p.status}${p.passReason ? ` (${p.passReason})` : ""}`, x(p.leverageX), s(p.spreadBps), `${Math.round(p.similarity * 100)}%`,
      [p.tags.join(", "), p.topCustomerPct ? `top customer ${p.topCustomerPct}%` : ""].filter(Boolean).join("; ")])),
    "**What IC asked on them**",
    ps.flatMap((p) => p.icQuestions.slice(0, 2).map((qq) => `- ${p.cite} · *${qq.question}* ${qq.answer ? `→ ${qq.answer}` : ""} (${qq.askedBy}, ${qq.date})`)).join("\n"),
  ];
  return out.join("\n\n");
}

function generic(ctx: Ctx, question: string, scope: ScopeRef[]) {
  const scoped = scope.find((x) => x.type === "deal");
  if (scoped) {
    const d = call<Row & { summary: string; openRedFlags: string[]; memo: { status: string } | null; nextIc: string | null }>(ctx, "get_deal", { dealId: scoped.id });
    return [`${d.cite}: ${d.summary}`,
      `Stage ${d.stage}, ${m(d.facilitySizeM)} at ${s(d.spreadBps)}, leverage ${x(d.leverageX)}, cushion ${pct(d.cushionPct)}.${d.openRedFlags.length ? ` Open red flags: ${d.openRedFlags.join("; ")}.` : ""}${d.nextIc ? ` Next IC ${d.nextIc}.` : ""}`,
      "_Offline mode answers a fixed set of question types. Add an API key for open-ended questions._"].join("\n\n");
  }
  const words = question.replace(/[^\w\s&.-]/g, " ").split(/\s+/).filter((w) => w.length > 3 && /^[A-Z]/.test(w));
  const hits = call<Row[]>(ctx, "search_entities", { query: words.join(" ") || question });
  if (!hits.length) return "I couldn't match that to anything in the database. In offline mode I can answer: pricing and leverage on approved deals, open red flags, what changed on a deal, who we know at a company, and precedents for a deal.";
  return [`Records matching your question:`, table(["Match", "Type", "Detail"], hits.map((h) => [h.cite, String(h.type), String(h.detail)])),
    "_Offline mode answers a fixed set of question types. Add an API key for open-ended questions._"].join("\n\n");
}

function table(head: string[], rows: string[][]) {
  return [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map((c) => c.replace(/\|(?![^[]*\]\])/g, "/")).join(" | ")} |`)].join("\n");
}
