import type { Affiliation, Person } from "@/lib/schema";

type P = {
  id: string;
  name: string;
  type: Person["personType"];
  email?: string;
  phone?: string;
  owner?: string;
  bio?: string;
  /** Role history, oldest first. The last entry without `end` is current. */
  roles: { co: string; title: string; start?: string; end?: string }[];
};

const list: P[] = [
  // Larch Mechanical
  { id: "per_dana_whitfield", name: "Dana Whitfield", type: "management", email: "dwhitfield@larchmechanical.com", owner: "u_marcus", bio: "CEO of Larch since 2016. Previously ran the Midwest region of a national mechanical contractor.", roles: [{ co: "co_larch", title: "Chief Executive Officer", start: "2016-03-01" }] },
  { id: "per_tom_brandt", name: "Tom Brandt", type: "management", email: "tbrandt@larchmechanical.com", owner: "u_marcus", bio: "CFO of Larch since 2023. Ran finance at Tern Pest Control through its 2019 sponsor acquisition and 2024 refinancing.", roles: [{ co: "co_tern", title: "Chief Financial Officer", start: "2019-02-01", end: "2023-05-31" }, { co: "co_larch", title: "Chief Financial Officer", start: "2023-06-15" }] },
  { id: "per_gary_lindqvist", name: "Gary Lindqvist", type: "management", email: "glindqvist@larchmechanical.com", owner: "u_jordan", bio: "COO responsible for branch operations and technician recruiting.", roles: [{ co: "co_ember", title: "Chief Operating Officer", start: "2017-01-01", end: "2021-12-31" }, { co: "co_larch", title: "Chief Operating Officer", start: "2022-02-01" }] },

  // Ashby Hill
  { id: "per_kevin_moreau", name: "Kevin Moreau", type: "sponsor", email: "kmoreau@ashbyhill.com", owner: "u_elena", bio: "Partner leading Ashby Hill's facility services vertical.", roles: [{ co: "co_westmere", title: "Principal", start: "2012-06-01", end: "2017-03-31" }, { co: "co_ashby", title: "Partner", start: "2017-04-01" }] },
  { id: "per_lauren_ito", name: "Lauren Ito", type: "sponsor", email: "lito@ashbyhill.com", owner: "u_marcus", roles: [{ co: "co_halvorsen", title: "Analyst", start: "2018-07-01", end: "2021-06-30" }, { co: "co_ashby", title: "Vice President", start: "2021-08-01" }] },
  { id: "per_priya_shah", name: "Priya Shah", type: "sponsor", email: "pshah@ashbyhill.com", owner: "u_sam", roles: [{ co: "co_ashby", title: "Principal", start: "2019-09-01" }] },

  // Corrigan Bay
  { id: "per_nathan_brooks", name: "Nathan Brooks", type: "sponsor", email: "nbrooks@corriganbay.com", owner: "u_elena", roles: [{ co: "co_corrigan", title: "Managing Partner", start: "2011-01-01" }] },
  { id: "per_chloe_ferrante", name: "Chloe Ferrante", type: "sponsor", email: "cferrante@corriganbay.com", owner: "u_sam", roles: [{ co: "co_corrigan", title: "Vice President", start: "2020-05-01" }] },

  // Westmere
  { id: "per_hannah_lowell", name: "Hannah Lowell", type: "sponsor", email: "hlowell@westmere.com", owner: "u_elena", roles: [{ co: "co_westmere", title: "Partner", start: "2014-01-01" }] },
  { id: "per_ravi_menon", name: "Ravi Menon", type: "sponsor", email: "rmenon@westmere.com", owner: "u_marcus", roles: [{ co: "co_westmere", title: "Principal", start: "2018-03-01" }] },

  // Pallister
  { id: "per_simon_achterberg", name: "Simon Achterberg", type: "sponsor", email: "sachterberg@pallistergroup.com", owner: "u_elena", roles: [{ co: "co_pallister", title: "Partner", start: "2013-01-01" }] },
  { id: "per_julia_novak", name: "Julia Novak", type: "sponsor", email: "jnovak@pallistergroup.com", owner: "u_marcus", roles: [{ co: "co_pallister", title: "Vice President", start: "2021-01-01" }] },

  // Stonecrop
  { id: "per_daniel_okoye", name: "Daniel Okoye", type: "sponsor", email: "dokoye@stonecrop.com", owner: "u_elena", roles: [{ co: "co_stonecrop", title: "Partner", start: "2015-01-01" }] },
  { id: "per_erin_castellano", name: "Erin Castellano", type: "sponsor", email: "ecastellano@stonecrop.com", owner: "u_marcus", roles: [{ co: "co_pellmarsh", title: "Associate", start: "2016-09-01", end: "2020-08-31" }, { co: "co_stonecrop", title: "Vice President", start: "2020-10-01" }] },

  // Halvorsen & Co.
  { id: "per_michael_grant", name: "Michael Grant", type: "banker", email: "mgrant@halvorsenco.com", phone: "+1 212 555 0148", owner: "u_elena", bio: "Managing Director covering business services. Sell-side banker on Larch, Quarry, Vale and Ember.", roles: [{ co: "co_halvorsen", title: "Managing Director", start: "2010-01-01" }] },
  { id: "per_sofia_lindgren", name: "Sofia Lindgren", type: "banker", email: "slindgren@halvorsenco.com", owner: "u_marcus", roles: [{ co: "co_halvorsen", title: "Director", start: "2017-01-01" }] },
  { id: "per_owen_hartley", name: "Owen Hartley", type: "banker", email: "ohartley@halvorsenco.com", owner: "u_jordan", bio: "Former Fernhill associate (2019–2022); now a VP on Halvorsen's services coverage team.", roles: [{ co: "co_fernhill", title: "Associate", start: "2019-07-01", end: "2022-06-30" }, { co: "co_halvorsen", title: "Vice President", start: "2022-08-01" }] },

  // Other lenders
  { id: "per_grace_nakamura", name: "Grace Nakamura", type: "lender", email: "gnakamura@northgatedl.com", owner: "u_elena", bio: "MD at Northgate; club partner on Beacon.", roles: [{ co: "co_northgate", title: "Managing Director", start: "2016-01-01" }] },

  // Brightline Advisory
  { id: "per_rachel_soto", name: "Rachel Soto", type: "advisor", email: "rsoto@brightlineadvisory.com", owner: "u_marcus", bio: "Transaction services partner; led QoE on Larch, Tern and Cinder.", roles: [{ co: "co_brightline", title: "Partner", start: "2015-01-01" }] },
  { id: "per_ben_adler", name: "Ben Adler", type: "advisor", email: "badler@brightlineadvisory.com", owner: "u_jordan", roles: [{ co: "co_brightline", title: "Manager", start: "2020-01-01" }] },

  // Law firms and agent
  { id: "per_david_kim", name: "David Kim", type: "advisor", email: "dkim@pellmarsh.com", owner: "u_elena", bio: "Finance partner; Fernhill's go-to lender counsel.", roles: [{ co: "co_pellmarsh", title: "Partner", start: "2012-01-01" }] },
  { id: "per_amelia_hart", name: "Amelia Hart", type: "advisor", email: "ahart@pellmarsh.com", owner: "u_sam", roles: [{ co: "co_pellmarsh", title: "Senior Associate", start: "2021-01-01" }] },
  { id: "per_thomas_wu", name: "Thomas Wu", type: "advisor", email: "twu@darrowkline.com", owner: "u_marcus", roles: [{ co: "co_darrow", title: "Partner", start: "2014-01-01" }] },
  { id: "per_laura_bianchi", name: "Laura Bianchi", type: "lender", email: "lbianchi@keystoneagency.com", owner: "u_sam", roles: [{ co: "co_keystone", title: "Agency Officer", start: "2019-01-01" }] },

  // Borrower management – other deals
  { id: "per_karen_mills", name: "Dr. Karen Mills", type: "management", email: "kmills@ospreydental.com", owner: "u_marcus", roles: [{ co: "co_osprey", title: "Chief Executive Officer", start: "2018-01-01" }] },
  { id: "per_mark_delaney", name: "Mark Delaney", type: "management", email: "mdelaney@quarryfleet.com", owner: "u_elena", roles: [{ co: "co_quarry", title: "Chief Executive Officer", start: "2015-01-01" }] },
  { id: "per_susan_park", name: "Susan Park", type: "management", email: "spark@quarryfleet.com", owner: "u_sam", roles: [{ co: "co_quarry", title: "Chief Financial Officer", start: "2021-01-01" }] },
  { id: "per_anil_kapoor", name: "Anil Kapoor", type: "management", email: "akapoor@beaconrx.com", owner: "u_elena", roles: [{ co: "co_beacon", title: "Chief Executive Officer", start: "2017-01-01" }] },
  { id: "per_megan_doyle", name: "Megan Doyle", type: "management", email: "mdoyle@beaconrx.com", owner: "u_sam", roles: [{ co: "co_beacon", title: "Chief Financial Officer", start: "2022-01-01" }] },
  { id: "per_erik_sandvik", name: "Erik Sandvik", type: "management", email: "erik@fjordlogistics.io", owner: "u_marcus", roles: [{ co: "co_fjord", title: "Founder & CEO", start: "2014-01-01" }] },
  { id: "per_paul_kowalski", name: "Paul Kowalski", type: "management", email: "pkowalski@cinderfire.com", owner: "u_elena", roles: [{ co: "co_cinder", title: "Chief Executive Officer", start: "2019-01-01" }] },
  { id: "per_janet_ruiz", name: "Janet Ruiz", type: "management", email: "jruiz@cinderfire.com", owner: "u_sam", bio: "CFO of Cinder; previously Controller at Granite Roofing during its 2023 buyout.", roles: [{ co: "co_granite", title: "Corporate Controller", start: "2018-04-01", end: "2022-09-30" }, { co: "co_cinder", title: "Chief Financial Officer", start: "2022-11-01" }] },
  { id: "per_victoria_moss", name: "Victoria Moss", type: "management", email: "vmoss@alderenv.com", owner: "u_marcus", roles: [{ co: "co_alder", title: "Chief Executive Officer", start: "2016-01-01" }] },
  { id: "per_brian_foster", name: "Brian Foster", type: "management", email: "bfoster@ternpest.com", owner: "u_elena", roles: [{ co: "co_tern", title: "Chief Executive Officer", start: "2012-01-01" }] },
  { id: "per_lisa_morgan", name: "Lisa Morgan", type: "management", email: "lmorgan@ternpest.com", owner: "u_sam", roles: [{ co: "co_tern", title: "Chief Financial Officer", start: "2023-06-01" }] },
  { id: "per_steve_carver", name: "Steve Carver", type: "management", email: "scarver@graniteroofing.com", owner: "u_elena", roles: [{ co: "co_granite", title: "Chief Executive Officer", start: "2010-01-01" }] },
  { id: "per_ian_mcallister", name: "Ian McAllister", type: "management", email: "imcallister@vale-elevator.com", owner: "u_marcus", roles: [{ co: "co_vale", title: "Chief Executive Officer", start: "2013-01-01" }] },
  { id: "per_rick_salazar", name: "Rick Salazar", type: "management", email: "rsalazar@emberhvac.com", owner: "u_marcus", roles: [{ co: "co_ember", title: "Chief Executive Officer", start: "2011-01-01" }] },
  { id: "per_diane_mercer", name: "Diane Mercer", type: "management", email: "dmercer@juniperhomehealth.com", owner: "u_elena", roles: [{ co: "co_juniper", title: "Chief Executive Officer", start: "2015-01-01" }] },
  { id: "per_frank_wren", name: "Frank Wren", type: "management", email: "frank@wrenindustrial.com", owner: "u_marcus", roles: [{ co: "co_wren", title: "Founder & CEO", start: "2002-01-01" }] },
];

export const people: Person[] = list.map((p) => ({
  id: p.id,
  fullName: p.name,
  email: p.email,
  phone: p.phone,
  personType: p.type,
  relationshipOwnerId: p.owner,
  bio: p.bio,
  createdAt: "2023-02-01T14:00:00.000Z",
}));

export const affiliations: Affiliation[] = list.flatMap((p) =>
  p.roles.map((r, i) => ({
    id: `aff_${p.id.slice(4)}_${i + 1}`,
    personId: p.id,
    companyId: r.co,
    title: r.title,
    startDate: r.start,
    endDate: r.end,
    isCurrent: !r.end,
  })),
);
