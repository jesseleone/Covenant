import type { Company } from "@/lib/schema";

type C = Omit<Company, "createdAt"> & { createdAt?: string };

const list: C[] = [
  // Fernhill itself
  { id: "co_fernhill", name: "Fernhill Credit Partners", aliases: ["Fernhill", "FCP"], domain: "fernhillcredit.com", types: ["lender"], sector: "Private credit", hqCity: "New York, NY", hqCountry: "US", description: "Middle-market direct lender focused on sponsor-backed first-lien and unitranche loans." },

  // Borrowers
  { id: "co_larch", name: "Larch Mechanical Holdings", aliases: ["Larch Mechanical", "Larch", "LMH"], domain: "larchmechanical.com", types: ["borrower"], sector: "Commercial HVAC & mechanical services", hqCity: "Columbus, OH", hqCountry: "US", description: "Commercial HVAC, plumbing and mechanical maintenance across 14 Midwest branches; 68% of revenue from recurring maintenance contracts.", ownerUserId: "u_marcus" },
  { id: "co_osprey", name: "Osprey Dental Partners", aliases: ["Osprey Dental", "ODP"], domain: "ospreydental.com", types: ["borrower"], sector: "Dental services (DSO)", hqCity: "Charlotte, NC", hqCountry: "US", description: "Dental support organization with 62 affiliated practices in the Carolinas and Virginia.", ownerUserId: "u_marcus" },
  { id: "co_quarry", name: "Quarry Fleet Services", aliases: ["Quarry Fleet", "QFS"], domain: "quarryfleet.com", types: ["borrower"], sector: "Fleet maintenance", hqCity: "Dallas, TX", hqCountry: "US", description: "Mobile and shop-based maintenance for commercial vehicle fleets.", ownerUserId: "u_elena" },
  { id: "co_beacon", name: "Beacon Pharmacy Solutions", aliases: ["Beacon Pharmacy", "Beacon Rx"], domain: "beaconrx.com", types: ["borrower"], sector: "Pharmacy software", hqCity: "Nashville, TN", hqCountry: "US", description: "Pharmacy management and compliance software; 91% recurring subscription revenue.", ownerUserId: "u_elena" },
  { id: "co_fjord", name: "Fjord Logistics Software", aliases: ["Fjord Logistics", "Fjord"], domain: "fjordlogistics.io", types: ["borrower"], sector: "Supply-chain SaaS", hqCity: "Minneapolis, MN", hqCountry: "US", description: "Transportation management SaaS for mid-size shippers.", ownerUserId: "u_marcus" },
  { id: "co_cinder", name: "Cinder Fire & Safety", aliases: ["Cinder Fire", "Cinder"], domain: "cinderfire.com", types: ["borrower"], sector: "Fire & life safety services", hqCity: "Indianapolis, IN", hqCountry: "US", description: "Inspection, testing and repair of fire and life-safety systems; code-mandated recurring demand.", ownerUserId: "u_elena" },
  { id: "co_alder", name: "Alder Environmental", aliases: ["Alder Environmental Labs", "Alder"], domain: "alderenv.com", types: ["borrower"], sector: "Environmental testing labs", hqCity: "Denver, CO", hqCountry: "US", description: "Network of 9 accredited environmental testing laboratories.", ownerUserId: "u_marcus" },
  { id: "co_tern", name: "Tern Pest Control", aliases: ["Tern Pest", "Tern"], domain: "ternpest.com", types: ["borrower"], sector: "Pest control services", hqCity: "Atlanta, GA", hqCountry: "US", description: "Commercial and residential pest control across the Southeast.", ownerUserId: "u_elena" },
  { id: "co_granite", name: "Granite Roofing Group", aliases: ["Granite Roofing", "GRG"], domain: "graniteroofing.com", types: ["borrower"], sector: "Commercial roofing", hqCity: "Phoenix, AZ", hqCountry: "US", description: "Commercial roofing repair, re-roof and maintenance programs.", ownerUserId: "u_elena" },
  { id: "co_vale", name: "Vale Elevator Services", aliases: ["Vale Elevator", "Vale"], domain: "vale-elevator.com", types: ["borrower"], sector: "Elevator maintenance", hqCity: "Chicago, IL", hqCountry: "US", description: "Independent elevator and escalator maintenance and modernization.", ownerUserId: "u_marcus" },
  { id: "co_ember", name: "Ember HVAC Group", aliases: ["Ember HVAC", "Ember"], domain: "emberhvac.com", types: ["borrower"], sector: "Residential HVAC", hqCity: "St. Louis, MO", hqCountry: "US", description: "Residential HVAC replacement and service; high exposure to one home-builder customer.", ownerUserId: "u_marcus" },
  { id: "co_juniper", name: "Juniper Home Health", aliases: ["Juniper Health", "Juniper"], domain: "juniperhomehealth.com", types: ["borrower"], sector: "Home health", hqCity: "Tampa, FL", hqCountry: "US", description: "Medicare-certified home health and hospice agencies in Florida.", ownerUserId: "u_elena" },
  { id: "co_wren", name: "Wren Industrial Svcs.", aliases: ["Wren Industrial", "Wren Services"], domain: "wrenindustrial.com", types: ["borrower"], sector: "Industrial maintenance services", hqCity: "Pittsburgh, PA", hqCountry: "US", description: "Industrial cleaning and maintenance services. Met at an ACG conference; no live deal yet.", ownerUserId: "u_marcus" },

  // Sponsors
  { id: "co_ashby", name: "Ashby Hill Partners", aliases: ["Ashby Hill", "AHP", "Ashby"], domain: "ashbyhill.com", types: ["sponsor"], sector: "Private equity – services", hqCity: "Chicago, IL", hqCountry: "US", description: "Lower-middle-market PE sponsor focused on essential B2B services. Fund IV ($1.4B).", ownerUserId: "u_elena" },
  { id: "co_corrigan", name: "Corrigan Bay Capital", aliases: ["Corrigan Bay", "CBC"], domain: "corriganbay.com", types: ["sponsor"], sector: "Private equity – healthcare & services", hqCity: "Boston, MA", hqCountry: "US", description: "Healthcare and consumer services sponsor. Fund III ($900M).", ownerUserId: "u_elena" },
  { id: "co_westmere", name: "Westmere Equity", aliases: ["Westmere", "Westmere Equity Partners"], domain: "westmere.com", types: ["sponsor"], sector: "Private equity – industrials", hqCity: "New York, NY", hqCountry: "US", description: "Industrial and environmental services sponsor. Fund V ($2.1B).", ownerUserId: "u_marcus" },
  { id: "co_pallister", name: "Pallister Group", aliases: ["Pallister", "Pallister Capital"], domain: "pallistergroup.com", types: ["sponsor"], sector: "Private equity – generalist", hqCity: "Dallas, TX", hqCountry: "US", description: "Generalist middle-market sponsor; software and building products.", ownerUserId: "u_marcus" },
  { id: "co_stonecrop", name: "Stonecrop Partners", aliases: ["Stonecrop", "SCP"], domain: "stonecrop.com", types: ["sponsor"], sector: "Private equity – software & services", hqCity: "San Francisco, CA", hqCountry: "US", description: "Software and tech-enabled services sponsor. Fund II ($1.1B).", ownerUserId: "u_elena" },

  // Advisors and service providers
  { id: "co_halvorsen", name: "Halvorsen & Co.", aliases: ["Halvorsen", "Halvorsen and Company", "HCo"], domain: "halvorsenco.com", types: ["advisor"], sector: "Investment bank", hqCity: "New York, NY", hqCountry: "US", description: "Middle-market investment bank; frequent sell-side advisor on services deals.", ownerUserId: "u_elena" },
  { id: "co_brightline", name: "Brightline Advisory", aliases: ["Brightline", "Brightline QoE"], domain: "brightlineadvisory.com", types: ["qoe_provider", "advisor"], sector: "Accounting / QoE", hqCity: "Chicago, IL", hqCountry: "US", description: "Quality-of-earnings and financial due diligence provider." },
  { id: "co_pellmarsh", name: "Pell & Marsh LLP", aliases: ["Pell & Marsh", "Pell Marsh"], domain: "pellmarsh.com", types: ["law_firm"], sector: "Law firm", hqCity: "New York, NY", hqCountry: "US", description: "Lender-side finance counsel." },
  { id: "co_darrow", name: "Darrow Kline LLP", aliases: ["Darrow Kline"], domain: "darrowkline.com", types: ["law_firm"], sector: "Law firm", hqCity: "Chicago, IL", hqCountry: "US", description: "Borrower and sponsor-side counsel." },
  { id: "co_keystone", name: "Keystone Agency Services", aliases: ["Keystone Agency", "Keystone"], domain: "keystoneagency.com", types: ["agent"], sector: "Loan agency", hqCity: "Wilmington, DE", hqCountry: "US", description: "Administrative and collateral agent services." },

  // Other lenders
  { id: "co_northgate", name: "Northgate Direct Lending", aliases: ["Northgate", "NDL"], domain: "northgatedl.com", types: ["lender"], sector: "Private credit", hqCity: "Boston, MA", hqCountry: "US", description: "Direct lender; occasional club partner on larger unitranche deals." },
];

export const companies: Company[] = list.map((c) => ({ createdAt: "2023-01-15T14:00:00.000Z", ...c }));
