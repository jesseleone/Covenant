// The sample CIM offered by "Start from a sample CIM". Its borrower name,
// "Wren Industrial Services", deliberately differs from the existing company
// record "Wren Industrial Svcs." so the duplicate check has something to catch.

import type { ExtractedField } from "@/lib/schema";

export const SAMPLE_CIM = {
  title: "Wren – Confidential Information Memorandum",
  dealName: "Project Wren",
  borrowerName: "Wren Industrial Services",
  sector: "Industrial maintenance services",
  sectorTags: ["business_services", "industrial_services"],
  requestedSize: 55,
  pages: [
    `# Wren Industrial Services

## Confidential Information Memorandum

Prepared by Halvorsen & Co. · October 2026

Wren Industrial Services ("Wren") provides industrial cleaning, maintenance and shutdown services to manufacturing, energy and food-processing plants in western Pennsylvania, Ohio and West Virginia.`,
    `## Business overview

Wren was founded in 2002 and is headquartered in Pittsburgh, Pennsylvania. The company operates 6 branches and employs approximately 480 people.

Recurring service agreements represent 55% of LTM revenue; the balance is project and turnaround work. The largest customer, a regional steel producer, accounted for 12% of LTM revenue.`,
    `## Financial summary

($ in millions)

| | FY2024A | FY2025A | LTM Sep-26 |
|---|---|---|---|
| Revenue | 52.0 | 58.5 | 64.0 |
| Adjusted EBITDA | 7.4 | 8.6 | 9.8 |

LTM revenue of $64.0M and adjusted EBITDA of $9.8M reflect two branch openings in 2025.`,
    `## Transaction overview

The founder is seeking a partial recapitalization at an implied enterprise value of $78.0M. The company is seeking a senior secured credit facility of $55.0M, comprising a term loan and a revolver.`,
  ],
};

type F = [key: string, label: string, value: number | string, unit: ExtractedField["unit"], page: number, quote: string, confidence: number, period?: string];

/** The values "extraction" proposes from the sample CIM (all start as proposed). */
export const SAMPLE_CIM_FIELDS: F[] = [
  ["founded", "Year founded", 2002, "count", 2, "Wren was founded in 2002 and is headquartered in Pittsburgh, Pennsylvania", 0.97],
  ["hq", "Headquarters", "Pittsburgh, PA", "text", 2, "Wren was founded in 2002 and is headquartered in Pittsburgh, Pennsylvania", 0.96],
  ["branches", "Branches", 6, "count", 2, "The company operates 6 branches and employs approximately 480 people", 0.95],
  ["employees", "Employees", 480, "count", 2, "The company operates 6 branches and employs approximately 480 people", 0.93],
  ["recurring_revenue_pct", "Recurring revenue %", 55, "pct", 2, "Recurring service agreements represent 55% of LTM revenue", 0.91],
  ["top_customer_pct", "Top customer % of revenue", 12, "pct", 2, "The largest customer, a regional steel producer, accounted for 12% of LTM revenue", 0.78],
  ["revenue_ltm", "Revenue (LTM)", 64.0, "usd_m", 3, "LTM revenue of $64.0M and adjusted EBITDA of $9.8M", 0.94, "LTM Sep-26"],
  ["adj_ebitda_ltm", "Adjusted EBITDA (LTM)", 9.8, "usd_m", 3, "LTM revenue of $64.0M and adjusted EBITDA of $9.8M", 0.72, "LTM Sep-26"],
  ["ev", "Enterprise value", 78.0, "usd_m", 4, "implied enterprise value of $78.0M", 0.9],
  ["requested_facility", "Requested facility", 55.0, "usd_m", 4, "senior secured credit facility of $55.0M", 0.88],
];
