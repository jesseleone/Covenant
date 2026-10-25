import type {
  Covenant, DDItem, Deal, Doc, ExtractedField, FinancialPeriod, ICCondition, ICEvent, Note, StageEvent,
  Stakeholder, Stage, TermSet, Tranche,
} from "@/lib/schema";

// ---------------------------------------------------------------------------
// Compact spec for the eleven "lighter" deals. Project Larch is in larch.ts.
// ---------------------------------------------------------------------------

type TrancheSpec = {
  key: string; name: string; instrument: Tranche["instrument"]; commitment: number; funded: number; hold?: number;
  spread: number; floor?: number; oid?: number; call?: string; maturity: string; amort?: number;
};

type ICSpec = {
  id: string; stage: ICEvent["stage"]; date: string; decision?: ICEvent["decision"];
  qa: { q: string; by: string; a?: string }[]; approvedHold?: number;
};

type DealSpec = {
  deal: Omit<Deal, "tags" | "createdAt" | "stageEnteredAt"> & { tags?: string[] };
  history: [Stage, string][];
  termSetLabel: TermSet["label"]; termSetStatus: TermSet["status"];
  tranches: TrancheSpec[];
  covenant?: [string, number][];
  fin: { revLtm: number; ebitdaLtm?: number; arr?: number; topCustomerPct?: number; recurringPct?: number; periodLabel: string; periodEnd: string };
  ic: ICSpec[];
  stakeholders: [string, string, Stakeholder["side"]][];
};

const T = (d: string) => `${d}T14:00:00.000Z`;

const specs: DealSpec[] = [
  {
    deal: {
      id: "deal_osprey", name: "Project Osprey", codename: "Osprey", borrowerCompanyId: "co_osprey", sponsorCompanyId: "co_corrigan",
      strategy: "cash_flow", dealType: "lbo", stage: "screening", status: "active", requestedSize: 80, fundHoldTarget: 80,
      expectedClose: "2027-01-31", leadUserId: "u_marcus", teamUserIds: ["u_sam", "u_marcus"], riskRating: { value: 3, scale: "1-5 (1=best)" },
      sector: "Dental services (DSO)", sectorTags: ["healthcare", "dental", "physician_services"],
      summary: "Corrigan Bay's buyout of a 62-practice DSO in the Carolinas and Virginia. $80M unitranche requested at 5.6x.",
      thesis: "Dense regional footprint with de novo pipeline; payer mix 70% commercial PPO. Key questions are same-store growth and dentist retention.",
    },
    history: [["sourced", "2026-10-01"], ["screening", "2026-10-09"]],
    termSetLabel: "proposal", termSetStatus: "draft",
    tranches: [
      { key: "tl", name: "Unitranche Term Loan", instrument: "term_loan", commitment: 70, funded: 70, spread: 575, maturity: "2033-01-31" },
      { key: "rcf", name: "Revolver", instrument: "revolver", commitment: 10, funded: 0, spread: 575, maturity: "2032-01-31", amort: 0 },
    ],
    covenant: [["2027-03-31", 7.5], ["2028-03-31", 7.0]],
    fin: { revLtm: 98.0, ebitdaLtm: 12.5, periodLabel: "LTM Aug-26", periodEnd: "2026-08-31" },
    ic: [{ id: "ic_osprey_screen", stage: "screening", date: "2026-10-30", qa: [] }],
    stakeholders: [["co_osprey", "Borrower", "borrower"], ["per_karen_mills", "Borrower CEO", "borrower"], ["per_nathan_brooks", "Sponsor deal lead", "sponsor"], ["per_chloe_ferrante", "Sponsor VP", "sponsor"]],
  },
  {
    deal: {
      id: "deal_quarry", name: "Project Quarry", codename: "Quarry", borrowerCompanyId: "co_quarry", sponsorCompanyId: "co_westmere",
      strategy: "cash_flow", dealType: "lbo", stage: "term_sheet", status: "active", requestedSize: 140, fundHoldTarget: 140,
      expectedClose: "2026-12-20", leadUserId: "u_elena", teamUserIds: ["u_jordan", "u_marcus", "u_elena"], riskRating: { value: 2, scale: "1-5 (1=best)" },
      sector: "Fleet maintenance", sectorTags: ["business_services", "fleet_services", "transportation"],
      summary: "Westmere's acquisition of a fleet maintenance platform serving 2,300 commercial fleets. $140M facility at 4.9x.",
      thesis: "Non-discretionary maintenance with contracted national accounts; low capex model (mobile technicians). Term sheet negotiation on DDTL size.",
    },
    history: [["sourced", "2026-08-04"], ["screening", "2026-08-12"], ["term_sheet", "2026-09-14"]],
    termSetLabel: "term_sheet", termSetStatus: "draft",
    tranches: [
      { key: "tl", name: "First Lien Term Loan", instrument: "term_loan", commitment: 120, funded: 120, spread: 500, maturity: "2032-12-20" },
      { key: "ddtl", name: "Delayed Draw Term Loan", instrument: "ddtl", commitment: 10, funded: 0, spread: 500, maturity: "2032-12-20" },
      { key: "rcf", name: "Revolver", instrument: "revolver", commitment: 10, funded: 0, spread: 500, maturity: "2031-12-20", amort: 0 },
    ],
    covenant: [["2027-03-31", 6.75], ["2028-03-31", 6.25]],
    fin: { revLtm: 168.0, ebitdaLtm: 24.5, topCustomerPct: 9, periodLabel: "LTM Jun-26", periodEnd: "2026-06-30" },
    ic: [{ id: "ic_quarry_screen", stage: "screening", date: "2026-09-10", decision: "approve", qa: [
      { q: "National accounts are 40% of revenue — what are the termination provisions?", by: "u_aisha", a: "60-day convenience termination, but average account tenure is 8 years." },
      { q: "How exposed is the technician workforce to wage inflation?", by: "u_robert", a: "Labor is 52% of COGS; pricing escalators have kept gross margin flat for three years." },
    ] }],
    stakeholders: [["co_quarry", "Borrower", "borrower"], ["per_mark_delaney", "Borrower CEO", "borrower"], ["per_susan_park", "Borrower CFO", "borrower"], ["per_hannah_lowell", "Sponsor deal lead", "sponsor"], ["per_ravi_menon", "Sponsor principal", "sponsor"], ["per_michael_grant", "Banker – sell-side", "advisor"]],
  },
  {
    deal: {
      id: "deal_beacon", name: "Project Beacon", codename: "Beacon", borrowerCompanyId: "co_beacon", sponsorCompanyId: "co_stonecrop",
      strategy: "cash_flow", dealType: "recap", stage: "ic", status: "active", requestedSize: 175, fundHoldTarget: 100,
      expectedClose: "2026-11-25", leadUserId: "u_elena", teamUserIds: ["u_sam", "u_marcus", "u_elena"], riskRating: { value: 3, scale: "1-5 (1=best)" },
      sector: "Pharmacy software", sectorTags: ["software", "healthcare_it", "vertical_saas"],
      summary: "Dividend recapitalization of Stonecrop's pharmacy software platform. $175M unitranche clubbed with Northgate; Fernhill holds $100M.",
      thesis: "91% recurring revenue, 112% net retention, mission-critical compliance workflow. Leverage is full at 6.2x but supported by software-like retention.",
    },
    history: [["sourced", "2026-07-21"], ["screening", "2026-07-29"], ["term_sheet", "2026-09-02"], ["diligence", "2026-09-16"], ["ic", "2026-10-19"]],
    termSetLabel: "term_sheet", termSetStatus: "issued",
    tranches: [
      { key: "tl", name: "Unitranche Term Loan", instrument: "term_loan", commitment: 155, funded: 155, hold: 85, spread: 600, maturity: "2032-11-25" },
      { key: "rcf", name: "Revolver", instrument: "revolver", commitment: 20, funded: 0, hold: 15, spread: 600, maturity: "2031-11-25", amort: 0 },
    ],
    covenant: [["2026-12-31", 8.25], ["2027-12-31", 7.75]],
    fin: { revLtm: 92.0, ebitdaLtm: 25.0, recurringPct: 91, periodLabel: "LTM Jun-26", periodEnd: "2026-06-30" },
    ic: [
      { id: "ic_beacon_screen", stage: "screening", date: "2026-08-27", decision: "approve", qa: [
        { q: "What is gross churn among independent pharmacies?", by: "u_aisha", a: "9% logo churn, mostly from pharmacy closures; net retention 112% from module upsell." },
        { q: "Is a dividend recap at 6.2x consistent with our software guidelines?", by: "u_robert", a: "Within the 6.5x cap for recurring-revenue borrowers; spread +50bps over guideline." },
      ] },
      { id: "ic_beacon_final", stage: "final", date: "2026-10-29", qa: [] },
    ],
    stakeholders: [["co_beacon", "Borrower", "borrower"], ["per_anil_kapoor", "Borrower CEO", "borrower"], ["per_megan_doyle", "Borrower CFO", "borrower"], ["per_daniel_okoye", "Sponsor deal lead", "sponsor"], ["per_erin_castellano", "Sponsor VP", "sponsor"], ["per_grace_nakamura", "Co-lender", "lender"], ["co_northgate", "Co-lender ($75M)", "lender"], ["per_david_kim", "Lender counsel", "advisor"]],
  },
  {
    deal: {
      id: "deal_fjord", name: "Project Fjord", codename: "Fjord", borrowerCompanyId: "co_fjord", sponsorCompanyId: "co_pallister",
      strategy: "cash_flow", dealType: "growth", stage: "sourced", status: "active", requestedSize: 60, fundHoldTarget: 60,
      leadUserId: "u_marcus", teamUserIds: ["u_jordan", "u_marcus"],
      sector: "Supply-chain SaaS", sectorTags: ["software", "supply_chain", "vertical_saas"],
      summary: "Recurring-revenue growth loan for Pallister's TMS software platform. Indicative S+650; EBITDA-negative, underwritten on ARR.",
      thesis: "Early look. $34M ARR growing 28%; would be structured as an ARR loan converting to a leverage covenant in year 3.",
    },
    history: [["sourced", "2026-10-20"]],
    termSetLabel: "proposal", termSetStatus: "draft",
    tranches: [{ key: "tl", name: "Recurring Revenue Term Loan", instrument: "term_loan", commitment: 60, funded: 50, spread: 650, floor: 100, oid: 2.5, maturity: "2032-06-30", amort: 0 }],
    fin: { revLtm: 38.0, arr: 34.0, recurringPct: 89, periodLabel: "LTM Sep-26", periodEnd: "2026-09-30" },
    ic: [],
    stakeholders: [["co_fjord", "Borrower", "borrower"], ["per_erik_sandvik", "Founder & CEO", "borrower"], ["per_julia_novak", "Sponsor deal lead", "sponsor"]],
  },
  {
    deal: {
      id: "deal_cinder", name: "Project Cinder", codename: "Cinder", borrowerCompanyId: "co_cinder", sponsorCompanyId: "co_ashby",
      strategy: "cash_flow", dealType: "lbo", stage: "documentation", status: "active", requestedSize: 95, fundHoldTarget: 95,
      expectedClose: "2026-11-14", leadUserId: "u_elena", teamUserIds: ["u_jordan", "u_sam", "u_elena"], riskRating: { value: 2, scale: "1-5 (1=best)" },
      sector: "Fire & life safety services", sectorTags: ["business_services", "facility_services", "fire_safety"],
      summary: "Ashby Hill's buyout of a fire & life-safety inspection platform. IC approved with conditions on 7 Oct; credit agreement in negotiation.",
      thesis: "Code-mandated inspections drive recurring pull-through repair revenue; second Ashby Hill facility-services deal with Fernhill after Larch screening.",
    },
    history: [["sourced", "2026-07-08"], ["screening", "2026-07-15"], ["term_sheet", "2026-08-19"], ["diligence", "2026-09-01"], ["ic", "2026-10-01"], ["documentation", "2026-10-08"]],
    termSetLabel: "term_sheet", termSetStatus: "issued",
    tranches: [
      { key: "tl", name: "First Lien Term Loan", instrument: "term_loan", commitment: 80, funded: 80, spread: 500, maturity: "2032-11-14" },
      { key: "rcf", name: "Revolver", instrument: "revolver", commitment: 15, funded: 0, spread: 500, maturity: "2031-11-14", amort: 0 },
    ],
    covenant: [["2026-12-31", 6.75], ["2027-12-31", 6.25]],
    fin: { revLtm: 112.0, ebitdaLtm: 16.0, recurringPct: 61, periodLabel: "LTM Jun-26", periodEnd: "2026-06-30" },
    ic: [
      { id: "ic_cinder_screen", stage: "screening", date: "2026-08-12", decision: "approve", qa: [
        { q: "How much revenue is code-mandated inspection versus discretionary repair?", by: "u_robert", a: "Inspection 41%, pull-through repair 38%, installation 21%." },
      ] },
      { id: "ic_cinder_final", stage: "final", date: "2026-10-07", decision: "approve_with_conditions", approvedHold: 95, qa: [
        { q: "Three add-ons closed in 2025 — is integration complete?", by: "u_aisha", a: "Two of three on the common ERP; third migrates in Q1-27. QoE adjusted for one-time integration costs only." },
        { q: "What is technician turnover?", by: "u_robert", a: "22% annualized, in line with peers; licensed inspectors are 60% of the workforce." },
      ] },
    ],
    stakeholders: [["co_cinder", "Borrower", "borrower"], ["per_paul_kowalski", "Borrower CEO", "borrower"], ["per_janet_ruiz", "Borrower CFO", "borrower"], ["per_kevin_moreau", "Sponsor deal lead", "sponsor"], ["per_priya_shah", "Sponsor principal", "sponsor"], ["per_rachel_soto", "QoE provider", "advisor"], ["per_david_kim", "Lender counsel", "advisor"], ["per_amelia_hart", "Lender counsel", "advisor"]],
  },
  {
    deal: {
      id: "deal_alder", name: "Project Alder", codename: "Alder", borrowerCompanyId: "co_alder", sponsorCompanyId: "co_westmere",
      strategy: "cash_flow", dealType: "lbo", stage: "closed", status: "closed", requestedSize: 110, fundHoldTarget: 110,
      closedAt: "2025-11-18", leadUserId: "u_marcus", teamUserIds: ["u_sam", "u_marcus", "u_elena"], riskRating: { value: 2, scale: "1-5 (1=best)" },
      sector: "Environmental testing labs", sectorTags: ["business_services", "testing_inspection", "environmental"],
      summary: "Westmere's buyout of a nine-lab environmental testing network. Closed Nov-2025; performing ahead of the lender case.",
      thesis: "Regulatory-driven testing demand (PFAS) with accreditation barriers to entry.",
    },
    history: [["sourced", "2025-08-05"], ["screening", "2025-08-14"], ["term_sheet", "2025-09-10"], ["diligence", "2025-09-24"], ["ic", "2025-10-22"], ["documentation", "2025-10-29"], ["closed", "2025-11-18"]],
    termSetLabel: "term_sheet", termSetStatus: "issued",
    tranches: [
      { key: "tl", name: "First Lien Term Loan", instrument: "term_loan", commitment: 96, funded: 96, spread: 525, maturity: "2031-11-18" },
      { key: "rcf", name: "Revolver", instrument: "revolver", commitment: 14, funded: 0, spread: 525, maturity: "2030-11-18", amort: 0 },
    ],
    covenant: [["2025-12-31", 6.5], ["2026-12-31", 6.0]],
    fin: { revLtm: 118.0, ebitdaLtm: 20.0, periodLabel: "LTM Jun-25", periodEnd: "2025-06-30" },
    ic: [{ id: "ic_alder_final", stage: "final", date: "2025-10-28", decision: "approve", approvedHold: 110, qa: [
      { q: "Any accreditation lapses across the nine sites?", by: "u_aisha", a: "None in five years; two renewals due 2026 and both on track." },
      { q: "How much of growth is PFAS-driven, and how did we haircut it?", by: "u_robert", a: "About 35% of FY25 growth; the lender case haircuts PFAS volumes by 50%." },
    ] }],
    stakeholders: [["co_alder", "Borrower", "borrower"], ["per_victoria_moss", "Borrower CEO", "borrower"], ["per_hannah_lowell", "Sponsor deal lead", "sponsor"], ["per_david_kim", "Lender counsel", "advisor"]],
  },
  {
    deal: {
      id: "deal_tern", name: "Project Tern", codename: "Tern", borrowerCompanyId: "co_tern", sponsorCompanyId: "co_corrigan",
      strategy: "cash_flow", dealType: "refi", stage: "closed", status: "closed", requestedSize: 70, fundHoldTarget: 70,
      closedAt: "2024-06-21", leadUserId: "u_elena", teamUserIds: ["u_sam", "u_elena"], riskRating: { value: 2, scale: "1-5 (1=best)" },
      sector: "Pest control services", sectorTags: ["business_services", "facility_services", "pest_control"],
      summary: "Refinancing of Corrigan Bay's Southeast pest control platform. Closed Jun-2024; underwritten to QoE EBITDA excluding run-rate add-backs.",
      thesis: "Route-based recurring services with 85% contracted revenue.",
    },
    history: [["sourced", "2024-03-11"], ["screening", "2024-03-19"], ["term_sheet", "2024-04-08"], ["diligence", "2024-04-22"], ["ic", "2024-05-24"], ["documentation", "2024-05-31"], ["closed", "2024-06-21"]],
    termSetLabel: "term_sheet", termSetStatus: "issued",
    tranches: [
      { key: "tl", name: "First Lien Term Loan", instrument: "term_loan", commitment: 60, funded: 60, spread: 550, floor: 100, oid: 2.5, maturity: "2030-06-21" },
      { key: "rcf", name: "Revolver", instrument: "revolver", commitment: 10, funded: 0, spread: 550, floor: 100, maturity: "2029-06-21", amort: 0 },
    ],
    covenant: [["2024-09-30", 7.0], ["2025-09-30", 6.5]],
    fin: { revLtm: 79.0, ebitdaLtm: 11.5, recurringPct: 85, periodLabel: "LTM Mar-24", periodEnd: "2024-03-31" },
    ic: [{ id: "ic_tern_final", stage: "final", date: "2024-05-30", decision: "approve_with_conditions", approvedHold: 70, qa: [
      { q: "How much of the $1.4M add-back bridge is realized versus run-rate?", by: "u_aisha", a: "QoE supported $0.8M as realized. We underwrote to QoE EBITDA and excluded the $0.6M run-rate." },
      { q: "Route density in the new Florida branches?", by: "u_robert", a: "Below mature branches (62% of target stops/route) — included as a downside sensitivity." },
      { q: "Is the CFO staying through the refinancing?", by: "u_robert", a: "Tom Brandt committed through closing and the first two compliance certificates." },
    ] }],
    stakeholders: [["co_tern", "Borrower", "borrower"], ["per_brian_foster", "Borrower CEO", "borrower"], ["per_tom_brandt", "Borrower CFO (at the time)", "borrower"], ["per_nathan_brooks", "Sponsor deal lead", "sponsor"], ["per_rachel_soto", "QoE provider", "advisor"]],
  },
  {
    deal: {
      id: "deal_granite", name: "Project Granite", codename: "Granite", borrowerCompanyId: "co_granite", sponsorCompanyId: "co_pallister",
      strategy: "cash_flow", dealType: "lbo", stage: "closed", status: "closed", requestedSize: 125, fundHoldTarget: 125,
      closedAt: "2023-09-15", leadUserId: "u_elena", teamUserIds: ["u_marcus", "u_elena"], riskRating: { value: 3, scale: "1-5 (1=best)" },
      sector: "Commercial roofing", sectorTags: ["business_services", "facility_services", "roofing"], tags: ["covenant reset"],
      summary: "Pallister's buyout of a commercial roofing platform. Closed Sep-2023 with ~20% covenant cushion; covenant reset amendment in Apr-2025 after re-roof volumes fell.",
      thesis: "Maintenance programs with national property managers; re-roof projects are cyclical.",
    },
    history: [["sourced", "2023-05-15"], ["screening", "2023-05-24"], ["term_sheet", "2023-06-20"], ["diligence", "2023-07-05"], ["ic", "2023-08-18"], ["documentation", "2023-08-25"], ["closed", "2023-09-15"]],
    termSetLabel: "term_sheet", termSetStatus: "issued",
    tranches: [
      { key: "tl", name: "First Lien Term Loan", instrument: "term_loan", commitment: 108, funded: 108, spread: 575, floor: 100, oid: 2.5, maturity: "2029-09-15" },
      { key: "rcf", name: "Revolver", instrument: "revolver", commitment: 17, funded: 0, spread: 575, floor: 100, maturity: "2028-09-15", amort: 0 },
    ],
    covenant: [["2023-12-31", 6.75], ["2024-12-31", 6.25]],
    fin: { revLtm: 165.0, ebitdaLtm: 20.0, periodLabel: "LTM Jun-23", periodEnd: "2023-06-30" },
    ic: [{ id: "ic_granite_final", stage: "final", date: "2023-08-24", decision: "approve", approvedHold: 125, qa: [
      { q: "Covenant cushion is only about 20% at close. If re-roof volumes soften, how quickly do we trip?", by: "u_aisha", a: "Sponsor case delevers to 4.6x within 18 months. We accepted the tighter cushion for +50bps of spread." },
      { q: "How seasonal is liquidity?", by: "u_robert", a: "Q1 trough; the $17M revolver covers the seasonal working-capital swing with 2x headroom." },
    ] }],
    stakeholders: [["co_granite", "Borrower", "borrower"], ["per_steve_carver", "Borrower CEO", "borrower"], ["per_janet_ruiz", "Borrower Controller (at the time)", "borrower"], ["per_simon_achterberg", "Sponsor deal lead", "sponsor"], ["per_david_kim", "Lender counsel", "advisor"]],
  },
  {
    deal: {
      id: "deal_vale", name: "Project Vale", codename: "Vale", borrowerCompanyId: "co_vale", sponsorCompanyId: "co_stonecrop",
      strategy: "cash_flow", dealType: "lbo", stage: "term_sheet", status: "lost", passReason: "lost_to_competitor",
      passNote: "Sponsor chose a bank-led unitranche that cleared at S+475. We held at S+525.",
      requestedSize: 90, fundHoldTarget: 90, leadUserId: "u_marcus", teamUserIds: ["u_jordan", "u_marcus"],
      sector: "Elevator maintenance", sectorTags: ["business_services", "facility_services", "elevator"],
      summary: "Stonecrop's buyout of an independent elevator maintenance company. Lost on price in Mar-2025.",
      thesis: "Regulated, recurring maintenance with high switching costs; modernization upside.",
    },
    history: [["sourced", "2025-01-06"], ["screening", "2025-01-14"], ["term_sheet", "2025-02-10"]],
    termSetLabel: "term_sheet", termSetStatus: "issued",
    tranches: [
      { key: "tl", name: "First Lien Term Loan", instrument: "term_loan", commitment: 80, funded: 80, spread: 525, maturity: "2031-04-15" },
      { key: "rcf", name: "Revolver", instrument: "revolver", commitment: 10, funded: 0, spread: 525, maturity: "2030-04-15", amort: 0 },
    ],
    covenant: [["2025-06-30", 7.25], ["2026-06-30", 6.75]],
    fin: { revLtm: 104.0, ebitdaLtm: 15.1, recurringPct: 74, periodLabel: "LTM Sep-24", periodEnd: "2024-09-30" },
    ic: [{ id: "ic_vale_screen", stage: "screening", date: "2025-01-22", decision: "approve", qa: [
      { q: "What share of technicians are union, and when do contracts renew?", by: "u_aisha", a: "64% IUEC members; master agreement renews 2027." },
      { q: "Does the company have parts access for OEM-proprietary equipment?", by: "u_robert", a: "Yes for 80% of the installed base; the rest is subcontracted." },
    ] }],
    stakeholders: [["co_vale", "Borrower", "borrower"], ["per_ian_mcallister", "Borrower CEO", "borrower"], ["per_daniel_okoye", "Sponsor deal lead", "sponsor"], ["per_michael_grant", "Banker – sell-side", "advisor"]],
  },
  {
    deal: {
      id: "deal_ember", name: "Project Ember", codename: "Ember", borrowerCompanyId: "co_ember", sponsorCompanyId: "co_ashby",
      strategy: "cash_flow", dealType: "lbo", stage: "ic", status: "passed", passReason: "credit_quality",
      passNote: "Top customer (a regional home builder) was 31% of revenue with no contract; the downside case breached the covenant.",
      requestedSize: 85, fundHoldTarget: 85, leadUserId: "u_marcus", teamUserIds: ["u_jordan", "u_marcus", "u_elena"],
      sector: "Residential HVAC", sectorTags: ["business_services", "residential_services", "hvac"],
      summary: "Ashby Hill's buyout of a residential HVAC installer. Declined at final IC in Oct-2024 on customer concentration.",
      thesis: "Replacement-driven demand, but new-construction channel tied to one home builder.",
    },
    history: [["sourced", "2024-07-15"], ["screening", "2024-07-23"], ["term_sheet", "2024-08-14"], ["diligence", "2024-08-28"], ["ic", "2024-09-30"]],
    termSetLabel: "term_sheet", termSetStatus: "issued",
    tranches: [
      { key: "tl", name: "First Lien Term Loan", instrument: "term_loan", commitment: 75, funded: 75, spread: 575, floor: 100, maturity: "2030-10-31" },
      { key: "rcf", name: "Revolver", instrument: "revolver", commitment: 10, funded: 0, spread: 575, floor: 100, maturity: "2029-10-31", amort: 0 },
    ],
    covenant: [["2024-12-31", 7.5], ["2025-12-31", 7.0]],
    fin: { revLtm: 96.0, ebitdaLtm: 12.9, topCustomerPct: 31, periodLabel: "LTM Jun-24", periodEnd: "2024-06-30" },
    ic: [{ id: "ic_ember_final", stage: "final", date: "2024-10-03", decision: "decline", qa: [
      { q: "The top customer is 31% of revenue with no contract. What happens if housing starts fall 20%?", by: "u_aisha", a: "The sponsor case assumes diversification to 22% by 2026; there is no contractual protection." },
      { q: "Where does downside leverage peak?", by: "u_robert", a: "7.4x in the downside case, inside the 7.50x covenant by only 0.1x." },
    ] }],
    stakeholders: [["co_ember", "Borrower", "borrower"], ["per_rick_salazar", "Borrower CEO", "borrower"], ["per_gary_lindqvist", "Borrower COO (at the time)", "borrower"], ["per_kevin_moreau", "Sponsor deal lead", "sponsor"], ["per_michael_grant", "Banker – sell-side", "advisor"]],
  },
  {
    deal: {
      id: "deal_juniper", name: "Project Juniper", codename: "Juniper", borrowerCompanyId: "co_juniper", sponsorCompanyId: "co_corrigan",
      strategy: "cash_flow", dealType: "lbo", stage: "screening", status: "passed", passReason: "sector",
      passNote: "Medicare is 78% of revenue; the proposed 2026 home-health rule cuts rates 2.9%. Outside our healthcare reimbursement appetite.",
      requestedSize: 65, fundHoldTarget: 65, leadUserId: "u_elena", teamUserIds: ["u_sam", "u_elena"],
      sector: "Home health", sectorTags: ["healthcare", "home_health"],
      summary: "Corrigan Bay's buyout of a Florida home health and hospice operator. Declined at screening IC in Feb-2026.",
      thesis: "Demographic tailwinds, but reimbursement risk concentrated in Medicare.",
    },
    history: [["sourced", "2026-02-02"], ["screening", "2026-02-09"]],
    termSetLabel: "proposal", termSetStatus: "draft",
    tranches: [
      { key: "tl", name: "First Lien Term Loan", instrument: "term_loan", commitment: 55, funded: 55, spread: 600, maturity: "2032-03-31" },
      { key: "rcf", name: "Revolver", instrument: "revolver", commitment: 10, funded: 0, spread: 600, maturity: "2031-03-31", amort: 0 },
    ],
    covenant: [["2026-06-30", 7.25]],
    fin: { revLtm: 82.0, ebitdaLtm: 10.0, periodLabel: "LTM Dec-25", periodEnd: "2025-12-31" },
    ic: [{ id: "ic_juniper_screen", stage: "screening", date: "2026-02-18", decision: "decline", qa: [
      { q: "What is our exposure to CMS home-health rate cuts?", by: "u_aisha", a: "Medicare is 78% of revenue; the proposed 2026 rule cuts rates 2.9%, about $1.8M of EBITDA." },
    ] }],
    stakeholders: [["co_juniper", "Borrower", "borrower"], ["per_diane_mercer", "Borrower CEO", "borrower"], ["per_nathan_brooks", "Sponsor deal lead", "sponsor"]],
  },
];

// ---------------------------------------------------------------------------
// Build records from specs
// ---------------------------------------------------------------------------

const ICMEMBERS = ["u_robert", "u_aisha"];

export function buildLightDeals() {
  const deals: Deal[] = [];
  const stageEvents: StageEvent[] = [];
  const stakeholders: Stakeholder[] = [];
  const termSets: TermSet[] = [];
  const tranches: Tranche[] = [];
  const covenants: Covenant[] = [];
  const documents: Doc[] = [];
  const extractedFields: ExtractedField[] = [];
  const financialPeriods: FinancialPeriod[] = [];
  const icEvents: ICEvent[] = [];
  const icConditions: ICCondition[] = [];

  for (const s of specs) {
    const d = s.deal;
    const slug = d.id.slice(5);
    const lastEntered = s.history[s.history.length - 1][1];
    deals.push({
      ...d,
      tags: d.tags ?? [],
      createdAt: T(s.history[0][1]),
      stageEnteredAt: T(lastEntered),
    });

    // Stage history
    s.history.forEach(([stage, date], i) => {
      stageEvents.push({
        id: `se_${slug}_${i + 1}`, dealId: d.id, from: i === 0 ? null : s.history[i - 1][0], to: stage,
        userId: i === 0 ? d.teamUserIds[0] : d.leadUserId, at: T(date),
      });
    });

    // Stakeholders
    s.stakeholders.forEach(([ref, role, side], i) => {
      stakeholders.push({
        id: `sh_${slug}_${i + 1}`, dealId: d.id, role, side,
        ...(ref.startsWith("per_") ? { personId: ref } : { companyId: ref }),
      });
    });

    // Term set v1; a final IC approval locks it in place (as decideIc does in the app)
    const approval = s.ic.find((e) => e.stage === "final" && (e.decision === "approve" || e.decision === "approve_with_conditions"));
    const v1: TermSet = {
      id: `ts_${slug}_v1`, dealId: d.id, version: 1,
      label: approval ? "ic_approved" : s.termSetLabel, status: approval ? "locked" : s.termSetStatus,
      lockedByIcEventId: approval?.id,
      createdBy: d.leadUserId, createdAt: T(s.history[Math.min(1, s.history.length - 1)][1]),
    };
    termSets.push(v1);
    for (const ts of [v1]) {
      s.tranches.forEach((t) => {
        tranches.push({
          id: `tr_${slug}_v${ts.version}_${t.key}`, termSetId: ts.id, key: t.key, name: t.name, instrument: t.instrument,
          lienRank: "1L", commitment: t.commitment, fundedAtClose: t.funded, fundHold: t.hold ?? t.commitment, baseRate: "SOFR",
          spreadBps: t.spread, floorBps: t.floor ?? 75, oidPct: t.oid ?? 2.0, pikBps: 0,
          callProtection: t.call ?? "102 / 101 / par", maturityDate: t.maturity, amortPctPerYear: t.amort ?? 1,
        });
      });
      if (s.covenant) {
        covenants.push({
          id: `cov_${slug}_v${ts.version}_lev`, termSetId: ts.id, metric: "total_leverage", operator: "max",
          levels: s.covenant.map(([from, level]) => ({ from, level })), testFrequency: "quarterly",
        });
      }
    }

    // A short CIM with the headline figures, and the fields extracted from it
    const company = d.borrowerCompanyId;
    const docId = `doc_${slug}_cim`;
    const f = s.fin;
    const finLines = [
      `${f.periodLabel} revenue of $${f.revLtm.toFixed(1)}M.`,
      f.ebitdaLtm !== undefined ? `${f.periodLabel} Adjusted EBITDA of $${f.ebitdaLtm.toFixed(1)}M.` : null,
      f.arr !== undefined ? `Annual recurring revenue (ARR) of $${f.arr.toFixed(1)}M.` : null,
      f.recurringPct !== undefined ? `Recurring revenue represents ${f.recurringPct}% of total revenue.` : null,
      f.topCustomerPct !== undefined ? `The largest customer represents ${f.topCustomerPct}% of revenue.` : null,
    ].filter(Boolean) as string[];
    documents.push({
      id: docId, dealId: d.id, docType: "cim", title: `${d.codename} – Confidential Information Memorandum`, version: 1,
      source: "email", extractionStatus: "done", uploadedAt: T(s.history[0][1]),
      pages: [
        { n: 1, markdown: `# ${d.name}\n\n## Confidential Information Memorandum\n\n${d.summary}\n\n${d.thesis}` },
        { n: 2, markdown: `## Financial summary\n\n${finLines.map((l) => `- ${l}`).join("\n")}` },
      ],
    });
    const field = (key: string, label: string, value: number, unit: ExtractedField["unit"], quote: string): ExtractedField => ({
      id: `ef_${slug}_${key}`, dealId: d.id, documentId: docId, page: 2, quote, fieldKey: key, label, value, unit,
      period: unit === "usd_m" ? f.periodLabel : undefined, confidence: 0.95, status: "confirmed",
      reviewedBy: d.teamUserIds[0], reviewedAt: T(s.history[0][1]),
    });
    extractedFields.push(field("revenue_ltm", "Revenue (LTM)", f.revLtm, "usd_m", finLines[0]));
    if (f.ebitdaLtm !== undefined) extractedFields.push(field("adj_ebitda_ltm", "Adjusted EBITDA (LTM)", f.ebitdaLtm, "usd_m", finLines[1]));
    if (f.arr !== undefined) extractedFields.push(field("arr", "Annual recurring revenue", f.arr, "usd_m", finLines.find((l) => l.startsWith("Annual"))!));
    if (f.recurringPct !== undefined) extractedFields.push(field("recurring_revenue_pct", "Recurring revenue %", f.recurringPct, "pct", finLines.find((l) => l.startsWith("Recurring"))!));
    if (f.topCustomerPct !== undefined) extractedFields.push(field("top_customer_pct", "Top customer % of revenue", f.topCustomerPct, "pct", finLines.find((l) => l.startsWith("The largest"))!));

    financialPeriods.push({
      id: `fp_${slug}_ltm`, dealId: d.id, companyId: company, label: f.periodLabel, periodEnd: f.periodEnd, periodType: "LTM",
      case: "actual", revenue: f.revLtm, adjEbitdaFieldKey: f.ebitdaLtm !== undefined ? "adj_ebitda_ltm" : undefined,
      adjEbitda: f.ebitdaLtm ?? 0, capex: +(f.revLtm * 0.018).toFixed(1),
    });

    // IC events
    for (const e of s.ic) {
      const decided = !!e.decision;
      const vote = e.decision === "decline" ? "decline" : e.decision === "approve_with_conditions" ? "approve_with_conditions" : "approve";
      icEvents.push({
        id: e.id, dealId: d.id, stage: e.stage, date: T(e.date), status: decided ? "decided" : "pending", decision: e.decision,
        termSetId: e.stage === "final" ? v1.id : undefined,
        votes: decided ? ICMEMBERS.map((userId) => ({ userId, vote })) : [],
        qa: e.qa.map((x) => ({ question: x.q, askedBy: x.by, answer: x.a })),
        approvedHold: e.approvedHold, decidedAt: decided ? T(e.date) : undefined,
      });
    }
  }

  // Conditions on the two approve-with-conditions decisions
  icConditions.push(
    { id: "icc_tern_1", dealId: "deal_tern", icEventId: "ic_tern_final", description: "QoE bring-down for Q1-24 before funding", type: "pre_close", ownerUserId: "u_sam", dueDate: "2024-06-14", status: "satisfied" },
    { id: "icc_cinder_1", dealId: "deal_cinder", icEventId: "ic_cinder_final", description: "Bring-down of Q3-26 financials and covenant compliance certificate", type: "pre_close", ownerUserId: "u_jordan", dueDate: "2026-11-07", status: "open" },
    { id: "icc_cinder_2", dealId: "deal_cinder", icEventId: "ic_cinder_final", description: "Quarterly backlog and inspection-renewal reporting for the first four quarters", type: "post_close", ownerUserId: "u_elena", status: "open" },
  );

  // A memo for Beacon so the deal can sit at IC consistently
  // (built in seed/index.ts together with Larch's memo).

  return { deals, stageEvents, stakeholders, termSets, tranches, covenants, documents, extractedFields, financialPeriods, icEvents, icConditions };
}

/** Diligence items on the lighter deals. */
export const lightDDItems: DDItem[] = [
  { id: "dd_beacon_1", dealId: "deal_beacon", workstream: "commercial", kind: "finding", title: "9% logo churn among independent pharmacies", detail: "Churn concentrated in pharmacy closures; net retention 112% offsets.", severity: "high", status: "mitigated", mitigant: "Cohort analysis shows closures, not competitive losses; covenant set on net retention reporting." },
  { id: "dd_beacon_2", dealId: "deal_beacon", workstream: "kyc", kind: "request", title: "KYC – borrower and sponsor", detail: "Standard KYC/AML.", status: "closed" },
  { id: "dd_cinder_1", dealId: "deal_cinder", workstream: "qoe", kind: "finding", title: "Integration costs treated as one-time", detail: "QoE accepted $0.7M of integration add-backs for three 2025 add-ons.", severity: "medium", status: "accepted", mitigant: "Third add-on ERP migration tracked as a post-close reporting item." },
  { id: "dd_cinder_2", dealId: "deal_cinder", workstream: "kyc", kind: "request", title: "KYC – borrower and sponsor", detail: "Standard KYC/AML.", status: "closed" },
  { id: "dd_quarry_1", dealId: "deal_quarry", workstream: "qoe", kind: "request", title: "QoE report", detail: "Sell-side QoE received; buy-side bring-down requested.", status: "open", ownerUserId: "u_jordan", dueDate: "2026-11-06" },
  { id: "dd_ember_1", dealId: "deal_ember", workstream: "commercial", kind: "finding", title: "Top customer 31% of revenue, no contract", detail: "Regional home builder; purchase orders only.", severity: "red_flag", status: "open" },
];

/** Notes on the lighter deals, companies and people. */
export const lightNotes: Note[] = [
  { id: "note_quarry_1", subject: { type: "deal", id: "deal_quarry" }, body: "Westmere pushing for a $25M DDTL. We are at $10M; will flex to $15M with a 4.5x incurrence test.", noteType: "call", authorId: "u_elena", pinned: true, mentions: [{ type: "person", id: "per_hannah_lowell" }], createdAt: T("2026-09-30") },
  { id: "note_beacon_1", subject: { type: "deal", id: "deal_beacon" }, body: "Northgate confirmed $75M of the $175M. Agency with Keystone.", noteType: "call", authorId: "u_elena", pinned: false, mentions: [{ type: "company", id: "co_northgate" }, { type: "person", id: "per_grace_nakamura" }], createdAt: T("2026-10-02") },
  { id: "note_ashby_1", subject: { type: "company", id: "co_ashby" }, body: "Annual relationship review with Ashby Hill. They expect 4–5 platform deals in 2027, mostly facility services. Larch and Cinder are the current live opportunities; Ember (2024) declined on concentration and they took it well.", noteType: "meeting", authorId: "u_elena", pinned: true, mentions: [{ type: "person", id: "per_kevin_moreau" }, { type: "deal", id: "deal_larch" }, { type: "deal", id: "deal_cinder" }, { type: "deal", id: "deal_ember" }], createdAt: T("2026-06-12") },
  { id: "note_grant_1", subject: { type: "person", id: "per_michael_grant" }, body: "Michael flagged two more services processes launching in Q1. He values our speed on Larch screening.", noteType: "call", authorId: "u_marcus", pinned: false, mentions: [{ type: "company", id: "co_halvorsen" }], createdAt: T("2026-10-14") },
  { id: "note_granite_1", subject: { type: "deal", id: "deal_granite" }, body: "Covenant reset amendment signed: leverage covenant reset to 7.25x through Q4-25 for 50bps amendment fee and $10M sponsor equity cure. Re-roof volumes fell 18% in 2024.", noteType: "general", authorId: "u_elena", pinned: true, mentions: [{ type: "company", id: "co_pallister" }], createdAt: T("2025-04-11") },
];
