import type { ChatMessage, ChatThread } from "@/lib/schema";

export const chatThreads: ChatThread[] = [
  { id: "th_ashby", title: "Ashby Hill relationship", ownerId: "u_jordan", createdAt: "2026-10-20T15:02:00.000Z" },
  { id: "th_services_pricing", title: "Pricing on closed services deals", ownerId: "u_marcus", createdAt: "2026-10-22T18:40:00.000Z" },
];

export const chatMessages: ChatMessage[] = [
  { id: "cm_ashby_1", threadId: "th_ashby", role: "user", content: "Who do we know at Ashby Hill, and what's our history with them?", createdAt: "2026-10-20T15:02:00.000Z" },
  {
    id: "cm_ashby_2", threadId: "th_ashby", role: "assistant", mode: "offline", createdAt: "2026-10-20T15:02:06.000Z",
    content: `We have three contacts at [[cite:company:co_ashby|Ashby Hill Partners]] and have seen three of their deals.

**People**

| Name | Title | Relationship owner |
|---|---|---|
| [[cite:person:per_kevin_moreau|Kevin Moreau]] | Partner | Elena Duarte |
| [[cite:person:per_lauren_ito|Lauren Ito]] | Vice President | Marcus Chen |
| [[cite:person:per_priya_shah|Priya Shah]] | Principal | Sam Patel |

**Deals**

| Deal | Stage / outcome | Size |
|---|---|---|
| [[cite:deal:deal_larch|Project Larch]] | Diligence | $115.0M |
| [[cite:deal:deal_cinder|Project Cinder]] | Documentation (IC approved with conditions) | $95.0M |
| [[cite:deal:deal_ember|Project Ember]] | Passed – credit quality (top customer 31%) | $85.0M |`,
    toolCalls: [
      { name: "search_entities", input: { query: "Ashby Hill" }, resultSummary: "1 company: Ashby Hill Partners", rowCount: 1 },
      { name: "get_company", input: { companyId: "co_ashby" }, resultSummary: "3 affiliated people, 3 deals", rowCount: 6 },
    ],
  },
  { id: "cm_sp_1", threadId: "th_services_pricing", role: "user", content: "What spreads and leverage did we approve on closed services deals?", createdAt: "2026-10-22T18:40:00.000Z" },
  {
    id: "cm_sp_2", threadId: "th_services_pricing", role: "assistant", mode: "offline", createdAt: "2026-10-22T18:40:07.000Z",
    content: `Three closed services deals, all first-lien:

| Deal | Closed | Leverage | Spread | IC decision |
|---|---|---|---|---|
| [[cite:deal:deal_alder|Project Alder]] | Nov 2025 | 4.80x | S+525 | [[cite:ic_event:ic_alder_final|Approve]] |
| [[cite:deal:deal_tern|Project Tern]] | Jun 2024 | 5.22x | S+550 | [[cite:ic_event:ic_tern_final|Approve with conditions]] |
| [[cite:deal:deal_granite|Project Granite]] | Sep 2023 | 5.40x | S+575 | [[cite:ic_event:ic_granite_final|Approve]] |

Granite later needed a covenant reset (Apr 2025), having closed with about 20% cushion.`,
    toolCalls: [
      { name: "list_deals", input: { status: "closed", sectorKeyword: "business_services" }, resultSummary: "3 deals", rowCount: 3 },
      { name: "get_ic_events", input: { dealIds: ["deal_alder", "deal_tern", "deal_granite"] }, resultSummary: "3 final IC decisions", rowCount: 3 },
    ],
  },
];
