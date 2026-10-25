import type {
  Covenant, DDItem, Deal, DevilsAdvocate, Doc, ExtractedField, FinancialPeriod, ICEvent, Memo, MemoSection, Note,
  StageEvent, Stakeholder, TermSet, Tranche,
} from "@/lib/schema";

const T = (d: string, h = 14) => `${d}T${String(h).padStart(2, "0")}:00:00.000Z`;

export const larchDeal: Deal = {
  id: "deal_larch", name: "Project Larch", codename: "Larch", borrowerCompanyId: "co_larch", sponsorCompanyId: "co_ashby",
  strategy: "cash_flow", dealType: "lbo", stage: "diligence", status: "active", requestedSize: 115, fundHoldTarget: 115,
  expectedClose: "2026-12-15", leadUserId: "u_marcus", teamUserIds: ["u_jordan", "u_sam", "u_marcus", "u_elena"],
  riskRating: { value: 2, scale: "1-5 (1=best)" },
  sector: "Commercial HVAC & mechanical services", sectorTags: ["business_services", "facility_services", "hvac"], tags: ["sponsor: Ashby Hill"],
  summary: "Ashby Hill Partners' $220M acquisition of Larch Mechanical Holdings, a commercial HVAC and mechanical services provider with 14 Midwest branches. Fernhill is asked for a $115M senior secured facility (term loan, DDTL and revolver) at S+525.",
  thesis: "Recurring, code-driven maintenance revenue (68% of sales) with long customer tenure, a dense regional branch network and a sponsor with a strong facility-services track record. Key diligence items: top-customer concentration and the quality of the adjusted EBITDA bridge.",
  createdAt: T("2026-08-20"), stageEnteredAt: T("2026-10-06"),
};

export const larchStageEvents: StageEvent[] = [
  { id: "se_larch_1", dealId: "deal_larch", from: null, to: "sourced", userId: "u_jordan", at: T("2026-08-20") },
  { id: "se_larch_2", dealId: "deal_larch", from: "sourced", to: "screening", userId: "u_marcus", at: T("2026-08-28") },
  { id: "se_larch_3", dealId: "deal_larch", from: "screening", to: "term_sheet", userId: "u_marcus", at: T("2026-09-22") },
  { id: "se_larch_4", dealId: "deal_larch", from: "term_sheet", to: "diligence", userId: "u_marcus", at: T("2026-10-06") },
];

export const larchStakeholders: Stakeholder[] = [
  { id: "sh_larch_1", dealId: "deal_larch", companyId: "co_larch", role: "Borrower", side: "borrower" },
  { id: "sh_larch_2", dealId: "deal_larch", personId: "per_dana_whitfield", role: "Borrower CEO", side: "borrower" },
  { id: "sh_larch_3", dealId: "deal_larch", personId: "per_tom_brandt", role: "Borrower CFO", side: "borrower" },
  { id: "sh_larch_4", dealId: "deal_larch", personId: "per_gary_lindqvist", role: "Borrower COO", side: "borrower" },
  { id: "sh_larch_5", dealId: "deal_larch", personId: "per_kevin_moreau", role: "Sponsor deal lead", side: "sponsor" },
  { id: "sh_larch_6", dealId: "deal_larch", personId: "per_lauren_ito", role: "Sponsor VP", side: "sponsor" },
  { id: "sh_larch_7", dealId: "deal_larch", personId: "per_michael_grant", role: "Banker – sell-side", side: "advisor" },
  { id: "sh_larch_8", dealId: "deal_larch", personId: "per_owen_hartley", role: "Banker – sell-side", side: "advisor" },
  { id: "sh_larch_9", dealId: "deal_larch", personId: "per_rachel_soto", role: "QoE provider", side: "advisor" },
  { id: "sh_larch_10", dealId: "deal_larch", personId: "per_david_kim", role: "Lender counsel", side: "advisor" },
  { id: "sh_larch_11", dealId: "deal_larch", personId: "per_thomas_wu", role: "Borrower counsel", side: "advisor" },
  { id: "sh_larch_12", dealId: "deal_larch", companyId: "co_keystone", role: "Administrative agent", side: "lender" },
];

// ---------------------------------------------------------------------------
// Documents. Extracted-field quotes below appear verbatim on these pages.
// ---------------------------------------------------------------------------

const cimPages: string[] = [
  // p.1
  `# Larch Mechanical Holdings

## Confidential Information Memorandum

Prepared by Halvorsen & Co. on behalf of Larch Mechanical Holdings and Ashby Hill Partners

August 2026

*Strictly private and confidential. This memorandum has been prepared solely for prospective lenders evaluating the financing of the proposed transaction.*`,
  // p.2
  `## Executive summary

Larch Mechanical Holdings ("Larch" or the "Company") is a leading provider of commercial HVAC, plumbing and mechanical services in the Midwest. The Company maintains, repairs and replaces the critical building systems of hospitals, office buildings, schools and light-industrial facilities.

**Investment highlights**

- Recurring, non-discretionary revenue anchored by multi-year preventive maintenance contracts
- Dense network of 14 branches across four states, supporting route density and technician utilization
- Diversified end markets with long-tenured customer relationships (average tenure of seven years)
- Consistent organic growth and margin expansion since 2022
- Proven management team partnered with Ashby Hill Partners

Ashby Hill Partners has agreed to acquire the Company and is seeking a senior secured credit facility to finance the transaction.`,
  // p.3
  `## Business overview

Founded in 1998 and headquartered in Columbus, Ohio, Larch has grown from a single-branch mechanical contractor into one of the largest independent commercial HVAC service providers in the region.

The Company operates 14 branches across Ohio, Indiana, Michigan and Kentucky. Each branch is led by a general manager with full P&L responsibility, supported by central dispatch, procurement and finance functions in Columbus.

Larch employs approximately 1,150 people, including 820 field technicians. Technician turnover was 18% in the LTM period, below the industry average of roughly 25%.`,
  // p.4
  `## Services and end markets

Larch's services fall into three categories:

| Service line | Share of LTM revenue |
|---|---|
| Recurring maintenance contracts | 68% |
| Pull-through repair | 19% |
| Replacement and retrofit projects | 13% |

Recurring maintenance contracts generated 68% of LTM revenue. Contracts typically run three to five years with annual price escalators, and the Company has achieved a 94% contract renewal rate over the last five years.

End markets: healthcare (34%), commercial office (24%), education (18%), light industrial (15%) and other (9%).`,
  // p.5
  `## Customers

Larch serves more than 2,400 commercial customers. The largest customer, a national healthcare REIT, accounted for 22% of LTM revenue across 41 sites. The relationship began in 2017.

The top 10 customers represented 48% of LTM revenue. Excluding the largest customer, no single customer accounts for more than 4% of revenue.

The master service agreement with the largest customer renews in December 2027. Management expects to renew on substantially similar terms.`,
  // p.6
  `## Management

**Dana Whitfield, Chief Executive Officer.** Joined Larch as CEO in 2016. Previously ran the Midwest region of a national mechanical contractor.

**Tom Brandt, Chief Financial Officer.** Joined in 2023. Previously CFO of Tern Pest Control (2019–2023), where he led finance through a sponsor acquisition and refinancing.

**Gary Lindqvist, Chief Operating Officer.** Joined in 2022 from Ember HVAC Group, where he was COO.

Management will roll approximately $8M of equity into the transaction.`,
  // p.7
  `## Historical financial performance

($ in millions)

| | FY2024A | FY2025A | LTM Jun-26 |
|---|---|---|---|
| Revenue | 121.0 | 134.0 | 142.0 |
| Growth | 9.5% | 10.7% | — |
| Gross profit | 36.3 | 41.5 | 44.6 |
| Adjusted EBITDA | 14.2 | 16.4 | 17.5 |
| Margin | 11.7% | 12.2% | 12.3% |

Growth was approximately two-thirds organic, driven by new maintenance contracts and annual price escalators, with the balance from two tuck-in acquisitions in 2025.`,
  // p.8
  `## Adjusted EBITDA bridge

($ in millions, LTM Jun-26)

| | |
|---|---|
| Reported EBITDA (LTM Jun-26) | 14.4 |
| Owner compensation normalization | 0.9 |
| One-time ERP implementation costs | 1.0 |
| Pricing initiatives (run-rate) | 1.2 |
| Total adjustments | 3.1 |
| Adjusted EBITDA (LTM Jun-26) | 17.5 |

The pricing initiative, launched in March 2026, introduced revised labor rates on maintenance contract renewals. The adjustment reflects the full-year effect of rates already agreed with customers.`,
  // p.9
  `## Capital expenditures and free cash flow

Larch is asset-light. Maintenance capital expenditures were $2.1M in the LTM period, mainly service vehicles and technician tools. Growth capex (new branches and the ERP system) was $1.4M.

| ($M) | FY2024A | FY2025A | LTM Jun-26 |
|---|---|---|---|
| Maintenance capex | 1.8 | 2.0 | 2.1 |
| Growth capex | 0.6 | 1.9 | 1.4 |

Free cash flow conversion (EBITDA less maintenance capex, over EBITDA) has exceeded 85% in each period.`,
  // p.10
  `## Growth strategy and M&A pipeline

- **Organic:** expand maintenance contracts within existing branches; cross-sell building automation.
- **Greenfield:** two new branches planned in Kentucky and western Michigan.
- **M&A:** a pipeline of eight identified tuck-in targets with combined EBITDA of approximately $9M, at expected purchase multiples of 5–7x.`,
  // p.11
  `## Transaction overview

Ashby Hill Partners has agreed to acquire Larch at an implied enterprise value of $220.0M.

| Sources | $M | Uses | $M |
|---|---|---|---|
| First-lien term loan | 90.0 | Purchase of equity | 220.0 |
| Sponsor equity | 136.0 | Fees and expenses | 6.0 |
| **Total** | **226.0** | **Total** | **226.0** |

The transaction is financed with a sponsor equity contribution of $136.0M (including management rollover) and a $90.0M first-lien term loan. A $15.0M delayed-draw term loan and a $10.0M revolver will be undrawn at close.`,
  // p.12
  `## Disclaimer

This Confidential Information Memorandum has been prepared by Halvorsen & Co. solely for informational purposes. It does not purport to be all-inclusive. Neither the Company, Ashby Hill Partners nor Halvorsen & Co. makes any representation or warranty as to the accuracy or completeness of the information contained herein.`,
];

const qoePages: string[] = [
  `# Larch Mechanical Holdings

## Quality of Earnings – Summary of Findings

Brightline Advisory · Prepared for Ashby Hill Partners and lenders · October 2026

Scope: LTM June 2026 earnings, net working capital and add-back support.`,
  `## Diligence-adjusted EBITDA

($ in millions, LTM Jun-26)

| | Management | Diligence |
|---|---|---|
| Reported EBITDA | 14.4 | 14.4 |
| Owner compensation normalization | 0.9 | 0.9 |
| One-time ERP implementation costs | 1.0 | 1.0 |
| Pricing initiatives (run-rate) | 1.2 | — |
| Adjusted EBITDA | 17.5 | 16.3 |

We arrive at diligence-adjusted EBITDA of $16.3M. We accept the owner compensation and ERP adjustments, which are supported by payroll records and vendor invoices.

We do not accept the $1.2M pricing run-rate adjustment. The revised rates apply only to contracts renewed after March 2026 and are not yet reflected in invoiced revenue; the benefit is not yet realized.`,
  `## Net working capital

Average monthly NWC over the LTM period was $11.4M (8.0% of revenue). We propose an NWC peg of $11.4M. Seasonality is modest; Q1 is the low point because of lower replacement project activity.`,
];

const termSheetPages: string[] = [
  `# Summary of Terms – Larch Mechanical Holdings

Fernhill Credit Partners · Issued 24 September 2026

| Facility | Amount | Pricing |
|---|---|---|
| First-lien term loan | $90.0M | SOFR + 525, 75 bps floor |
| Delayed-draw term loan | $15.0M | SOFR + 525, 75 bps floor; 24-month availability |
| Revolving credit facility | $10.0M | SOFR + 525, 75 bps floor |

- **OID:** 2.0%
- **Call protection:** 102 / 101 / par
- **Maturity:** 15 December 2032 (revolver: 15 December 2031)
- **Amortization:** 1.0% per annum on the term loan`,
  `## Financial covenant

Maximum total net leverage, tested quarterly:

| Test date from | Level |
|---|---|
| 31 Dec 2026 | 7.00x |
| 31 Dec 2027 | 6.50x |
| 31 Dec 2028 | 6.00x |

**Conditions precedent:** satisfactory confirmatory diligence, QoE, KYC and customary documentation.`,
];

const modelPages: string[] = [
  `# Sponsor model – summary

Ashby Hill Partners · September 2026

| ($M) | FY2027E | FY2028E | FY2029E |
|---|---|---|---|
| Revenue | 158.0 | 173.0 | 189.0 |
| Adjusted EBITDA | 20.1 | 22.8 | 25.4 |
| Total leverage | 4.4x | 3.8x | 3.3x |

The sponsor case assumes the pricing initiative is fully realized in FY2027 and two tuck-in acquisitions funded from the DDTL.`,
];

const pages = (arr: string[]) => arr.map((markdown, i) => ({ n: i + 1, markdown }));

export const larchDocuments: Doc[] = [
  { id: "doc_larch_cim", dealId: "deal_larch", docType: "cim", title: "Larch – Confidential Information Memorandum", version: 1, source: "email", pages: pages(cimPages), extractionStatus: "done", uploadedAt: T("2026-08-20", 15) },
  { id: "doc_larch_qoe", dealId: "deal_larch", docType: "qoe", title: "Brightline QoE – Summary of Findings", version: 1, source: "vdr", pages: pages(qoePages), extractionStatus: "done", uploadedAt: T("2026-10-16", 16) },
  { id: "doc_larch_ts", dealId: "deal_larch", docType: "term_sheet", title: "Fernhill Summary of Terms", version: 1, source: "upload", pages: pages(termSheetPages), extractionStatus: "none", uploadedAt: T("2026-09-24", 18) },
  { id: "doc_larch_model", dealId: "deal_larch", docType: "model", title: "Ashby Hill sponsor model – summary", version: 1, source: "vdr", pages: pages(modelPages), extractionStatus: "none", uploadedAt: T("2026-09-10", 13) },
];

// ---------------------------------------------------------------------------
// Extracted fields (22). Three low-confidence fields are still "proposed".
// ---------------------------------------------------------------------------

type F = [key: string, label: string, value: number | string, unit: ExtractedField["unit"], page: number, quote: string, confidence: number, period?: string];

const fieldSpecs: F[] = [
  ["founded", "Year founded", 1998, "count", 3, "Founded in 1998 and headquartered in Columbus, Ohio", 0.98],
  ["hq", "Headquarters", "Columbus, OH", "text", 3, "Founded in 1998 and headquartered in Columbus, Ohio", 0.97],
  ["branches", "Branches", 14, "count", 3, "The Company operates 14 branches across Ohio, Indiana, Michigan and Kentucky", 0.97],
  ["employees", "Employees", 1150, "count", 3, "Larch employs approximately 1,150 people, including 820 field technicians", 0.95],
  ["recurring_revenue_pct", "Recurring revenue %", 68, "pct", 4, "Recurring maintenance contracts generated 68% of LTM revenue", 0.94],
  ["top_customer_pct", "Top customer % of revenue", 22, "pct", 5, "The largest customer, a national healthcare REIT, accounted for 22% of LTM revenue", 0.71],
  ["top10_customer_pct", "Top 10 customers % of revenue", 48, "pct", 5, "The top 10 customers represented 48% of LTM revenue", 0.93],
  ["msa_renewal_date", "Top-customer MSA renewal", "December 2027", "text", 5, "The master service agreement with the largest customer renews in December 2027", 0.92],
  ["ceo", "CEO", "Dana Whitfield", "text", 6, "Dana Whitfield, Chief Executive Officer", 0.99],
  ["cfo", "CFO", "Tom Brandt", "text", 6, "Tom Brandt, Chief Financial Officer", 0.99],
  ["revenue_fy24", "Revenue FY2024A", 121.0, "usd_m", 7, "Revenue | 121.0 | 134.0 | 142.0", 0.96, "FY2024A"],
  ["revenue_fy25", "Revenue FY2025A", 134.0, "usd_m", 7, "Revenue | 121.0 | 134.0 | 142.0", 0.96, "FY2025A"],
  ["revenue_ltm", "Revenue (LTM)", 142.0, "usd_m", 7, "Revenue | 121.0 | 134.0 | 142.0", 0.96, "LTM Jun-26"],
  ["adj_ebitda_fy24", "Adjusted EBITDA FY2024A", 14.2, "usd_m", 7, "Adjusted EBITDA | 14.2 | 16.4 | 17.5", 0.94, "FY2024A"],
  ["adj_ebitda_fy25", "Adjusted EBITDA FY2025A", 16.4, "usd_m", 7, "Adjusted EBITDA | 14.2 | 16.4 | 17.5", 0.94, "FY2025A"],
  ["adj_ebitda_ltm", "Adjusted EBITDA (LTM)", 17.5, "usd_m", 8, "Adjusted EBITDA (LTM Jun-26) | 17.5", 0.64, "LTM Jun-26"],
  ["reported_ebitda_ltm", "Reported EBITDA (LTM)", 14.4, "usd_m", 8, "Reported EBITDA (LTM Jun-26) | 14.4", 0.93, "LTM Jun-26"],
  ["pricing_addback", "Pricing run-rate add-back", 1.2, "usd_m", 8, "Pricing initiatives (run-rate) | 1.2", 0.91, "LTM Jun-26"],
  ["addback_total", "Total EBITDA adjustments", 3.1, "usd_m", 8, "Total adjustments | 3.1", 0.92, "LTM Jun-26"],
  ["maintenance_capex", "Maintenance capex (LTM)", 2.1, "usd_m", 9, "Maintenance capital expenditures were $2.1M in the LTM period", 0.69, "LTM Jun-26"],
  ["ev", "Enterprise value", 220.0, "usd_m", 11, "implied enterprise value of $220.0M", 0.97],
  ["sponsor_equity", "Sponsor equity", 136.0, "usd_m", 11, "sponsor equity contribution of $136.0M", 0.95],
];

const PROPOSED = new Set(["adj_ebitda_ltm", "top_customer_pct", "maintenance_capex"]);

export const larchFields: ExtractedField[] = fieldSpecs.map(([key, label, value, unit, page, quote, confidence, period]) => ({
  id: `ef_larch_${key}`, dealId: "deal_larch", documentId: "doc_larch_cim", page, quote, fieldKey: key, label, value, unit, period,
  confidence, status: PROPOSED.has(key) ? "proposed" : "confirmed",
  ...(PROPOSED.has(key) ? {} : { reviewedBy: "u_jordan", reviewedAt: T("2026-09-08", 16) }),
}));

export const larchPeriods: FinancialPeriod[] = [
  { id: "fp_larch_fy24", dealId: "deal_larch", companyId: "co_larch", label: "FY2024A", periodEnd: "2024-12-31", periodType: "FY", case: "actual", revenue: 121.0, adjEbitdaFieldKey: "adj_ebitda_fy24", adjEbitda: 14.2, capex: 1.8 },
  { id: "fp_larch_fy25", dealId: "deal_larch", companyId: "co_larch", label: "FY2025A", periodEnd: "2025-12-31", periodType: "FY", case: "actual", revenue: 134.0, adjEbitdaFieldKey: "adj_ebitda_fy25", adjEbitda: 16.4, capex: 2.0 },
  { id: "fp_larch_ltm", dealId: "deal_larch", companyId: "co_larch", label: "LTM Jun-26", periodEnd: "2026-06-30", periodType: "LTM", case: "actual", revenue: 142.0, adjEbitdaFieldKey: "adj_ebitda_ltm", adjEbitda: 17.5, capex: 2.1, interest: 8.1 },
  { id: "fp_larch_fy27_sponsor", dealId: "deal_larch", companyId: "co_larch", label: "FY2027E", periodEnd: "2027-12-31", periodType: "FY", case: "sponsor", revenue: 158.0, adjEbitda: 20.1, capex: 2.4, interest: 8.0 },
  { id: "fp_larch_fy27_base", dealId: "deal_larch", companyId: "co_larch", label: "FY2027E", periodEnd: "2027-12-31", periodType: "FY", case: "lender_base", revenue: 152.0, adjEbitda: 17.4, capex: 2.4, interest: 8.1 },
  { id: "fp_larch_fy27_down", dealId: "deal_larch", companyId: "co_larch", label: "FY2027E", periodEnd: "2027-12-31", periodType: "FY", case: "downside", revenue: 140.0, adjEbitda: 13.9, capex: 2.2, interest: 8.1 },
];

// ---------------------------------------------------------------------------
// Terms (term set v1, issued)
// ---------------------------------------------------------------------------

export const larchTermSets: TermSet[] = [
  { id: "ts_larch_v1", dealId: "deal_larch", version: 1, label: "term_sheet", status: "issued", createdBy: "u_marcus", createdAt: T("2026-09-22", 17), note: "Issued to Ashby Hill on 24 Sep." },
];

const tr = (key: string, name: string, instrument: Tranche["instrument"], commitment: number, funded: number, maturity: string, amort: number): Tranche => ({
  id: `tr_larch_v1_${key}`, termSetId: "ts_larch_v1", key, name, instrument, lienRank: "1L", commitment, fundedAtClose: funded,
  fundHold: commitment, baseRate: "SOFR", spreadBps: 525, floorBps: 75, oidPct: 2.0, pikBps: 0, callProtection: "102 / 101 / par",
  maturityDate: maturity, amortPctPerYear: amort,
});

export const larchTranches: Tranche[] = [
  tr("tl", "First Lien Term Loan", "term_loan", 90, 90, "2032-12-15", 1),
  tr("ddtl", "Delayed Draw Term Loan", "ddtl", 15, 0, "2032-12-15", 1),
  tr("rcf", "Revolver", "revolver", 10, 0, "2031-12-15", 0),
];

export const larchCovenants: Covenant[] = [
  {
    id: "cov_larch_v1_lev", termSetId: "ts_larch_v1", metric: "total_leverage", operator: "max", testFrequency: "quarterly",
    levels: [{ from: "2026-12-31", level: 7.0 }, { from: "2027-12-31", level: 6.5 }, { from: "2028-12-31", level: 6.0 }],
    notes: "Total net leverage; equity cure limited to 2 in any 4 quarters.",
  },
];

// ---------------------------------------------------------------------------
// Due diligence (10)
// ---------------------------------------------------------------------------

export const larchDDItems: DDItem[] = [
  { id: "dd_larch_qoe", dealId: "deal_larch", workstream: "qoe", kind: "finding", title: "$1.2M pricing run-rate add-back rejected by QoE", detail: "Brightline does not accept the pricing initiative run-rate adjustment: revised rates apply only to contracts renewed after March 2026 and are not yet in invoiced revenue. Diligence-adjusted EBITDA is $16.3M versus $17.5M in the CIM.", severity: "high", status: "open", memoSectionKey: "financial_analysis", ownerUserId: "u_jordan" },
  { id: "dd_larch_conc", dealId: "deal_larch", workstream: "commercial", kind: "finding", title: "Top customer 22% of revenue; MSA renews Dec-2027 (~14 months)", detail: "The largest customer (national healthcare REIT, 41 sites) is 22% of LTM revenue. Its master service agreement renews in December 2027, about 14 months after close.", severity: "red_flag", status: "open", memoSectionKey: "key_risks", ownerUserId: "u_sam" },
  { id: "dd_larch_legal", dealId: "deal_larch", workstream: "legal", kind: "finding", title: "Two minor wage-and-hour claims", detail: "Two pending claims by former technicians in Ohio.", severity: "low", status: "accepted", mitigant: "Covered by EPL insurance; aggregate exposure below $0.3M.", ownerUserId: "u_jordan" },
  { id: "dd_larch_ins", dealId: "deal_larch", workstream: "insurance", kind: "request", title: "Insurance review", detail: "Broker review of GL, auto, EPL and umbrella programs.", status: "closed", ownerUserId: "u_jordan" },
  { id: "dd_larch_env", dealId: "deal_larch", workstream: "environmental", kind: "request", title: "Phase I ESA – HQ and three owned branches", detail: "No recognized environmental conditions identified.", status: "closed", ownerUserId: "u_jordan" },
  { id: "dd_larch_kyc", dealId: "deal_larch", workstream: "kyc", kind: "request", title: "KYC – borrower and sponsor", detail: "KYC/AML on Larch, its owners and Ashby Hill Fund IV. Cleared.", status: "closed", ownerUserId: "u_sam" },
  { id: "dd_larch_bg", dealId: "deal_larch", workstream: "background", kind: "request", title: "Background checks – CEO, CFO, COO", detail: "No adverse findings.", status: "closed", ownerUserId: "u_sam" },
  { id: "dd_larch_it", dealId: "deal_larch", workstream: "it", kind: "request", title: "IT security assessment", detail: "Third-party review of ERP, dispatch system and backup/recovery.", status: "open", ownerUserId: "u_jordan", dueDate: "2026-11-06" },
  { id: "dd_larch_tax", dealId: "deal_larch", workstream: "tax", kind: "request", title: "Tax structure memo", detail: "Sponsor tax structure and any step-up benefits.", status: "open", ownerUserId: "u_sam", dueDate: "2026-11-10" },
  { id: "dd_larch_lien", dealId: "deal_larch", workstream: "collateral", kind: "request", title: "UCC lien searches (OH, IN, MI, KY)", detail: "Lien, judgment and tax lien searches requested from Pell & Marsh.", status: "open", ownerUserId: "u_jordan", dueDate: "2026-11-13" },
];

// ---------------------------------------------------------------------------
// IC: screening decision (approve) and devil's advocate questions
// ---------------------------------------------------------------------------

export const larchICEvents: ICEvent[] = [
  {
    id: "ic_larch_screen", dealId: "deal_larch", stage: "screening", date: T("2026-09-18", 15), status: "decided", decision: "approve",
    votes: [{ userId: "u_robert", vote: "approve" }, { userId: "u_aisha", vote: "approve", comment: "Approve to term sheet; concentration must be diligenced." }],
    qa: [
      { question: "How sticky are the maintenance contracts that make up 68% of revenue?", askedBy: "u_robert", answer: "Average tenure is seven years and the five-year renewal rate is 94%." },
      { question: "The bridge relies on a $1.2M pricing run-rate. How will we validate it?", askedBy: "u_aisha", answer: "Brightline is engaged for the QoE; results expected mid-October." },
      { question: "The top customer is 22% of revenue. When does its contract renew?", askedBy: "u_aisha", answer: "December 2027. Diligence will include a customer call and a review of the MSA." },
    ],
    decidedAt: T("2026-09-18", 16),
  },
];

export const larchDevilsAdvocate: DevilsAdvocate[] = [
  { id: "da_larch_1", dealId: "deal_larch", question: "If the top customer does not renew in Dec-2027, what is pro forma leverage and covenant headroom?", rationale: "Ember was declined with a 31% customer and no contract. Larch's exposure is lower but the renewal falls inside the first covenant step-down.", precedentDealIds: ["deal_ember"] },
  { id: "da_larch_2", dealId: "deal_larch", question: "Granite needed a covenant reset 18 months after close at a similar cushion. Why is Larch different?", rationale: "Granite closed with ~20% cushion and reset its covenant in Apr-2025 when re-roof volumes fell.", precedentDealIds: ["deal_granite"] },
  { id: "da_larch_3", dealId: "deal_larch", question: "How much of the add-back bridge is realized versus run-rate, and what does the QoE support?", rationale: "On Tern we underwrote to QoE EBITDA and excluded run-rate add-backs.", precedentDealIds: ["deal_tern"] },
];

// ---------------------------------------------------------------------------
// Memo: final v1 (draft). Numbers are tokens, never typed.
// ---------------------------------------------------------------------------

export const larchMemo: Memo = {
  id: "memo_larch_final_v1", dealId: "deal_larch", memoType: "final", version: 1, status: "draft", termSetId: "ts_larch_v1", createdAt: T("2026-10-12", 18),
};

type S = Omit<MemoSection, "memoId" | "snapshot" | "updatedAt" | "generatedBy"> & { generatedBy?: MemoSection["generatedBy"] };

const sections: S[] = [
  {
    id: "ms_larch_exec", key: "executive_summary", title: "Executive Summary", order: 1, reviewedBy: "u_sam", reviewedAt: T("2026-10-13", 15),
    dependencies: ["termset:active", "field:revenue_ltm", "field:recurring_revenue_pct"],
    content: `Fernhill is asked to provide a {{metric:facility_size}} senior secured credit facility to support Ashby Hill Partners' acquisition of Larch Mechanical Holdings ("Larch"), a commercial HVAC and mechanical services provider headquartered in Columbus, Ohio. The facility comprises a {{tranche:tl.commitment}} first-lien term loan, a {{tranche:ddtl.commitment}} delayed-draw term loan for tuck-in acquisitions and a {{tranche:rcf.commitment}} revolver, priced at {{tranche:tl.spread}} with a {{tranche:tl.floor}} floor and {{tranche:tl.oid}} OID. Fernhill would hold the full facility.

Larch generated {{field:revenue_ltm}} of LTM revenue, with {{field:recurring_revenue_pct}} from recurring maintenance contracts [[cite:document:doc_larch_cim#p4|CIM p.4]]. It is a leader in a fragmented, non-discretionary end market and is run by a long-tenured management team.

The deal team recommends approval subject to the conditions in the Recommendation section. The key considerations are customer concentration, the quality of the adjusted EBITDA bridge and covenant headroom, each discussed below.`,
  },
  {
    id: "ms_larch_thesis", key: "investment_thesis", title: "Investment Thesis", order: 2, reviewedBy: "u_sam", reviewedAt: T("2026-10-13", 15),
    dependencies: ["field:recurring_revenue_pct", "field:branches", "field:employees", "field:sponsor_equity"],
    content: `1. **Recurring, non-discretionary revenue.** {{field:recurring_revenue_pct}} of revenue comes from multi-year preventive maintenance contracts with an average customer tenure of seven years and a 94% renewal rate [[cite:document:doc_larch_cim#p4|CIM p.4]]. Commercial buildings cannot defer HVAC maintenance without breaching code and lease obligations.
2. **Dense regional platform.** {{field:branches}} branches and about {{field:employees}} employees across four Midwest states give Larch route density and technician scale that smaller competitors lack [[cite:document:doc_larch_cim#p3|CIM p.3]].
3. **Experienced sponsor.** Ashby Hill has owned five facility-services platforms. Fernhill has reviewed three of its deals, including Cinder (approved) and Ember (declined on concentration).
4. **Equity cushion.** Sponsor equity of {{field:sponsor_equity}} sits beneath our first-lien debt [[cite:document:doc_larch_cim#p11|CIM p.11]], and maintenance revenue held flat through 2020.`,
  },
  {
    id: "ms_larch_company", key: "company_overview", title: "Company Overview", order: 3, reviewedBy: "u_jordan", reviewedAt: T("2026-10-13", 11),
    dependencies: ["field:founded", "field:hq", "field:branches", "field:employees", "field:ceo", "field:cfo"],
    content: `Larch was founded in {{field:founded}} and is headquartered in {{field:hq}} [[cite:document:doc_larch_cim#p3|CIM p.3]]. It provides preventive maintenance, repair and replacement of commercial HVAC, plumbing and building-automation systems for hospitals, offices, schools and light-industrial customers through {{field:branches}} branches in Ohio, Indiana, Michigan and Kentucky.

The company employs approximately {{field:employees}} people, including 820 field technicians. Revenue is split between recurring maintenance contracts, repair work pulled through from those contracts, and replacement projects [[cite:document:doc_larch_cim#p4|CIM p.4]].

Management is led by {{field:ceo}} (CEO since 2016) and {{field:cfo}} (CFO since 2023), who was previously CFO of Tern Pest Control, a Fernhill borrower since 2024 [[cite:document:doc_larch_cim#p6|CIM p.6]]. COO Gary Lindqvist joined in 2022 from Ember HVAC Group.`,
  },
  {
    id: "ms_larch_fin", key: "financial_analysis", title: "Financial Analysis", order: 4,
    dependencies: ["field:revenue_fy24", "field:revenue_fy25", "field:revenue_ltm", "field:adj_ebitda_fy24", "field:adj_ebitda_fy25", "field:adj_ebitda_ltm", "field:maintenance_capex", "metric:total_leverage"],
    content: `Revenue grew from {{field:revenue_fy24}} in FY2024 to {{field:revenue_fy25}} in FY2025 and {{field:revenue_ltm}} for the LTM period ended June 2026 [[cite:document:doc_larch_cim#p7|CIM p.7]]. About two-thirds of growth was organic, driven by new maintenance contracts and price escalators.

Adjusted EBITDA was {{field:adj_ebitda_fy24}} in FY2024 and {{field:adj_ebitda_fy25}} in FY2025. We underwrite LTM adjusted EBITDA of {{field:adj_ebitda_ltm}}, a {{metric:ebitda_margin}} margin. The CIM bridge from reported EBITDA adds back owner compensation normalization, one-time ERP costs and a run-rate benefit from pricing initiatives [[cite:document:doc_larch_cim#p8|CIM p.8]].

Maintenance capex is light at {{field:maintenance_capex}} [[cite:document:doc_larch_cim#p9|CIM p.9]], supporting free cash flow conversion above 85%.

On these figures, total leverage at close is {{metric:total_leverage}} on funded debt of {{metric:funded_debt}}, and the purchase price implies {{metric:ev_multiple}} adjusted EBITDA.`,
  },
  {
    id: "ms_larch_terms", key: "structure_terms", title: "Structure & Terms", order: 5, reviewedBy: "u_marcus", reviewedAt: T("2026-10-14", 10),
    dependencies: ["termset:active", "metric:total_leverage", "metric:cushion_pct"],
    content: `The proposed facility totals {{metric:facility_size}}:

| Tranche | Commitment | Pricing |
|---|---|---|
| First-lien term loan | {{tranche:tl.commitment}} | {{tranche:tl.spread}} |
| Delayed-draw term loan | {{tranche:ddtl.commitment}} | {{tranche:ddtl.spread}} |
| Revolver | {{tranche:rcf.commitment}} | {{tranche:rcf.spread}} |

All tranches are first lien with a {{tranche:tl.floor}} SOFR floor, {{tranche:tl.oid}} OID and call protection of {{tranche:tl.call}}. The term loan matures in {{tranche:tl.maturity}} and amortizes 1% a year. The DDTL is available for 24 months for tuck-in acquisitions, subject to a pro forma leverage test.

A maximum total leverage covenant is tested quarterly, stepping down {{covenant:total_leverage.schedule}}. At close, leverage of {{metric:total_leverage}} against the first test level of {{covenant:total_leverage.current}} leaves {{metric:cushion_pct}} cushion, against our 25% guideline.`,
  },
  {
    id: "ms_larch_risks", key: "key_risks", title: "Key Risks & Mitigants", order: 6,
    dependencies: ["dd:red_flags", "field:top_customer_pct", "field:msa_renewal_date", "field:pricing_addback", "metric:cushion_pct"],
    content: `**Customer concentration (red flag).** The largest customer, a national healthcare REIT, accounts for {{field:top_customer_pct}} of revenue, and its master service agreement renews in {{field:msa_renewal_date}} [[cite:document:doc_larch_cim#p5|CIM p.5]], about 14 months after close. *Mitigant:* the relationship spans 41 sites and nine years. A customer reference call and review of the renewal terms are proposed before closing.

**Quality of the EBITDA bridge.** The CIM bridge includes {{field:pricing_addback}} of run-rate pricing benefit that is not yet realized [[cite:document:doc_larch_cim#p8|CIM p.8]]. *Mitigant:* the QoE, not the CIM, is the source of truth for underwriting EBITDA.

**Covenant headroom.** Cushion against the opening covenant level is {{metric:cushion_pct}}. Losing the top customer without replacement would put the covenant under pressure within the first year.

**Technician labor.** Wage inflation of 4–5% a year is passed through via contract escalators. Technician turnover is 18%, below the industry average.`,
  },
  {
    id: "ms_larch_dd", key: "diligence_status", title: "Diligence Status", order: 7, reviewedBy: "u_jordan", reviewedAt: T("2026-10-16", 17),
    dependencies: ["dd:open_items"],
    content: `Third-party diligence is substantially complete:

- **Quality of earnings (Brightline Advisory):** report received. See Financial Analysis for the treatment of add-backs [[cite:document:doc_larch_qoe#p2|QoE p.2]].
- **Legal:** two minor wage-and-hour claims; insured, with aggregate exposure below $0.3M.
- **Insurance, environmental (Phase I clean), background checks and KYC:** complete with no findings.
- **Open items:** IT security assessment (due 6 Nov), tax structure memo (due 10 Nov) and UCC lien searches in four states.

Red-flag findings must carry a mitigant or an IC condition before the deal is submitted to final IC.`,
  },
  {
    id: "ms_larch_rec", key: "recommendation", title: "Recommendation", order: 8,
    dependencies: ["metric:total_leverage", "metric:cushion_pct", "termset:active"],
    content: `The deal team recommends **approval** of a {{metric:facility_size}} senior secured facility to Larch Mechanical Holdings at {{tranche:tl.spread}}, with Fernhill holding the full amount.

The credit is supported by recurring maintenance revenue, an experienced sponsor and a substantial equity cushion. At {{metric:total_leverage}} total leverage and {{metric:cushion_pct}} covenant cushion, the structure is within our guidelines for sponsor-backed services credits.

Recommended conditions:

1. Customer reference call with the top customer and review of MSA renewal terms before close.
2. Underwriting EBITDA to follow the QoE, not the CIM bridge.
3. Customary closing conditions, including lien searches and the IT security assessment.`,
  },
];

export const larchMemoSections: Omit<MemoSection, "snapshot">[] = sections.map((s) => ({
  ...s, memoId: larchMemo.id, generatedBy: s.generatedBy ?? "ai", updatedAt: T("2026-10-12", 18),
}));

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export const larchNotes: Note[] = [
  { id: "note_larch_1", subject: { type: "deal", id: "deal_larch" }, noteType: "screening", authorId: "u_jordan", pinned: false, createdAt: T("2026-08-24", 15),
    body: "Intro call with @Michael Grant (Halvorsen). Ashby Hill has signed an LOI at about $220M EV. Limited process with four lenders. Banker guiding to S+525–550 and 5.0–5.25x.",
    mentions: [{ type: "person", id: "per_michael_grant" }, { type: "company", id: "co_ashby" }] },
  { id: "note_larch_2", subject: { type: "deal", id: "deal_larch" }, noteType: "meeting", authorId: "u_marcus", pinned: false, createdAt: T("2026-09-09", 20),
    body: "Management meeting in Columbus with @Dana Whitfield and @Tom Brandt. Strong branch-level KPIs; technician utilization 81%. Tom walked through the add-back bridge: the pricing initiative started in March, so only about three months are in the LTM.",
    mentions: [{ type: "person", id: "per_dana_whitfield" }, { type: "person", id: "per_tom_brandt" }] },
  { id: "note_larch_3", subject: { type: "deal", id: "deal_larch" }, noteType: "call", authorId: "u_marcus", pinned: false, createdAt: T("2026-09-29", 17),
    body: "Call with @Kevin Moreau and @Lauren Ito. Ashby wants a $20M DDTL; we offered $15M. They accept a 7.00x opening covenant if we hold S+525.",
    mentions: [{ type: "person", id: "per_kevin_moreau" }, { type: "person", id: "per_lauren_ito" }] },
  { id: "note_larch_4", subject: { type: "deal", id: "deal_larch" }, noteType: "meeting", authorId: "u_jordan", pinned: true, createdAt: T("2026-10-16", 18),
    body: "Brightline QoE readout with @Rachel Soto: diligence-adjusted EBITDA $16.3M. They rejected the $1.2M pricing run-rate as unrealized and accepted the other add-backs. NWC peg $11.4M.",
    mentions: [{ type: "person", id: "per_rachel_soto" }, { type: "company", id: "co_brightline" }] },
  { id: "note_larch_5", subject: { type: "deal", id: "deal_larch" }, noteType: "ic", authorId: "u_sam", pinned: false, createdAt: T("2026-10-21", 19),
    body: "IC prep. Precedents: @Project Granite (covenant reset at ~20% cushion), @Project Ember (31% concentration, declined), @Project Tern (underwrote to QoE only). Expect Aisha to push on concentration.",
    mentions: [{ type: "deal", id: "deal_granite" }, { type: "deal", id: "deal_ember" }, { type: "deal", id: "deal_tern" }] },
];
