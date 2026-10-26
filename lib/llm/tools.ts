// Tool definitions sent to Claude. They map 1:1 onto lib/llm/query-tools.ts.

import type Anthropic from "@anthropic-ai/sdk";

type Tool = Anthropic.Beta.BetaTool;

const obj = (properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: "object" as const, properties, required, additionalProperties: false });

const dealId = { type: "string", description: "Deal id, e.g. deal_larch. Use search_entities to find it from a name." };

export const TOOLS: Tool[] = [
  {
    name: "search_entities",
    description: "Fuzzy search across deals, companies and people by name, alias, codename or email. Use it first to turn names in the question into ids.",
    input_schema: obj({ query: { type: "string" }, types: { type: "array", items: { type: "string", enum: ["deal", "company", "person"] } } }, ["query"]),
  },
  {
    name: "list_deals",
    description: "List deals with stage, status, size, leverage, spread, cushion, pass reason and last IC decision. Leverage, spread and cushion come from the IC-approved term set when there is one. Filter by stage, status (active, closed, passed, lost, on_hold, passed_or_lost), sponsor company id, sector keyword (e.g. 'business services', 'hvac', 'healthcare') and requested size in $M.",
    input_schema: obj({
      stage: { type: "string", enum: ["sourced", "screening", "term_sheet", "diligence", "ic", "documentation", "closed"] },
      status: { type: "string", enum: ["active", "closed", "passed", "lost", "on_hold", "passed_or_lost"] },
      sponsorId: { type: "string" }, sectorKeyword: { type: "string" }, minSize: { type: "number" }, maxSize: { type: "number" },
    }),
  },
  { name: "get_deal", description: "Everything about one deal: summary, thesis, metrics, LTM EBITDA and its source, open red flags, memo status, next IC.", input_schema: obj({ dealId }, ["dealId"]) },
  {
    name: "get_term_set",
    description: "A deal's terms: tranches (commitment, funded, hold, spread, floor, OID, call, maturity) and the leverage covenant schedule, with leverage and cushion for that version. which = 'active' (latest), 'approved' (IC-locked) or a version number.",
    input_schema: obj({ dealId, which: { anyOf: [{ type: "string", enum: ["active", "approved"] }, { type: "number" }] } }, ["dealId"]),
  },
  { name: "get_financials", description: "Extracted financial values with review status (proposed/confirmed/corrected), source page and any correction, plus period spreads by case.", input_schema: obj({ dealId }, ["dealId"]) },
  { name: "get_dd_items", description: "Due-diligence requests and findings for a deal, with severity, status, mitigant and linked IC condition. severity filter: red_flag, high, medium, low.", input_schema: obj({ dealId, severity: { type: "string", enum: ["red_flag", "high", "medium", "low"] } }, ["dealId"]) },
  { name: "get_ic_events", description: "IC committees with decision, votes, Q&A and conditions. Pass dealId, or dealIds for several deals at once.", input_schema: obj({ dealId: { type: "string" }, dealIds: { type: "array", items: { type: "string" } } }) },
  { name: "find_precedents", description: "Closed or passed deals similar to a deal (sector overlap, size within ±50%, leverage within ±1.0x), ranked by similarity, with outcome, pricing, flags and the questions IC asked.", input_schema: obj({ dealId }, ["dealId"]) },
  { name: "get_company", description: "A company: types, sector, people (current and former, with relationship owner and strength) and every deal it was involved in, with role and outcome.", input_schema: obj({ companyId: { type: "string" } }, ["companyId"]) },
  { name: "get_person", description: "A person: role history across companies, relationship owner and strength, and deals they were involved in.", input_schema: obj({ personId: { type: "string" } }, ["personId"]) },
  { name: "get_activity", description: "Notes and meetings involving a deal, company or person, newest first.", input_schema: obj({ type: { type: "string", enum: ["deal", "company", "person"] }, id: { type: "string" }, limit: { type: "number" } }, ["type", "id"]) },
  { name: "get_documents", description: "A deal's documents (CIM, QoE, term sheet, model…) with page counts and the heading of each page.", input_schema: obj({ dealId }, ["dealId"]) },
  { name: "read_document_page", description: "The full text of one document page, with its cite token. Use it to check or quote what a source document says.", input_schema: obj({ documentId: { type: "string" }, page: { type: "number" } }, ["documentId", "page"]) },
  { name: "get_history", description: "A deal's audit trail. sinceIso = an ISO date, or 'last_ic' for everything since the most recent IC decision.", input_schema: obj({ dealId, sinceIso: { type: "string" } }, ["dealId"]) },
];
