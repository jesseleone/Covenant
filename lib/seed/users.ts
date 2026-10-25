import type { User } from "@/lib/schema";

export const users: User[] = [
  { id: "u_jordan", name: "Jordan Reyes", email: "jordan.reyes@fernhillcredit.com", role: "analyst", title: "Analyst", initials: "JR" },
  { id: "u_sam", name: "Sam Patel", email: "sam.patel@fernhillcredit.com", role: "associate", title: "Associate", initials: "SP" },
  { id: "u_marcus", name: "Marcus Chen", email: "marcus.chen@fernhillcredit.com", role: "vp", title: "Vice President", initials: "MC" },
  { id: "u_elena", name: "Elena Duarte", email: "elena.duarte@fernhillcredit.com", role: "md", title: "Managing Director", initials: "ED" },
  { id: "u_robert", name: "Robert Hale", email: "robert.hale@fernhillcredit.com", role: "ic_member", title: "CIO & IC Chair", initials: "RH" },
  { id: "u_aisha", name: "Aisha Okafor", email: "aisha.okafor@fernhillcredit.com", role: "ic_member", title: "Chief Risk Officer", initials: "AO" },
];

/** Quick-pick personas on the login screen and in the persona switcher. */
export const DEMO_PERSONAS: { userId: string; label: string }[] = [
  { userId: "u_jordan", label: "Analyst" },
  { userId: "u_marcus", label: "VP" },
  { userId: "u_elena", label: "MD" },
  { userId: "u_robert", label: "IC" },
];
