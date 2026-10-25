"use client";

import { useMemo, useState } from "react";
import { subMonths, parseISO } from "date-fns";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { STAGES, STAGE_LABELS, STRATEGIES, STRATEGY_LABELS, type DB, type Deal, type User } from "@/lib/schema";
import { companyById } from "@/lib/selectors";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/components/ui/primitives";

export type DealFilters = {
  q: string;
  stage: string | null;
  strategy: string | null;
  sponsor: string | null;
  lead: string | null;
  status: string | null;
  quick: "mine" | "at_ic" | "passed_12m" | null;
};

const EMPTY: DealFilters = { q: "", stage: null, strategy: null, sponsor: null, lead: null, status: null, quick: null };

export function useDealFilters(db: DB, user: User | null) {
  const [f, setF] = useState<DealFilters>(EMPTY);
  const set = (patch: Partial<DealFilters>) => setF((prev) => ({ ...prev, ...patch }));
  const cutoff = subMonths(parseISO(db.settings.today), 12).toISOString();

  const deals = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return db.deals.filter((d) => {
      if (q) {
        const hay = [d.name, d.codename, companyById(db, d.borrowerCompanyId)?.name, companyById(db, d.sponsorCompanyId)?.name, d.sector].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (f.stage && !(d.stage === f.stage && (d.status === "active" || (f.stage === "closed" && d.status === "closed")))) return false;
      if (f.strategy && d.strategy !== f.strategy) return false;
      if (f.sponsor && d.sponsorCompanyId !== f.sponsor) return false;
      if (f.lead && d.leadUserId !== f.lead) return false;
      if (f.status === "out" ? !["passed", "lost", "on_hold"].includes(d.status) : f.status && d.status !== f.status) return false;
      if (f.quick === "mine" && !(user && (d.leadUserId === user.id || d.teamUserIds.includes(user.id)))) return false;
      if (f.quick === "at_ic" && !(d.status === "active" && d.stage === "ic")) return false;
      if (f.quick === "passed_12m" && !((d.status === "passed" || d.status === "lost") && lastDecision(db, d) >= cutoff)) return false;
      return true;
    });
  }, [db, f, user, cutoff]);

  const active = JSON.stringify(f) !== JSON.stringify(EMPTY);
  return { f, set, reset: () => setF(EMPTY), deals, active };
}

/** When a passed/lost deal came off the board. */
function lastDecision(db: DB, d: Deal) {
  const ev = db.auditEvents.filter((e) => e.dealId === d.id && (e.action === "deal.pass" || e.action === "deal.outcome")).map((e) => e.at).sort().at(-1);
  return ev ?? d.stageEnteredAt;
}

export function DealFilterBar({ db, filters }: { db: DB; filters: ReturnType<typeof useDealFilters> }) {
  const { f, set, reset, active } = filters;
  const sponsors = db.companies.filter((c) => c.types.includes("sponsor"));
  const leads = db.users.filter((u) => db.deals.some((d) => d.leadUserId === u.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-8 w-[240px] items-center gap-2 rounded-[10px] border border-border bg-surface px-2.5 focus-within:border-focus">
          <Search size={14} className="text-text-3" />
          <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Filter deals…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-text-3" />
        </label>
        <FilterMenu label="Stage" value={f.stage} onChange={(v) => set({ stage: v })} options={STAGES.map((s) => [s, STAGE_LABELS[s]])} />
        <FilterMenu label="Status" value={f.status} onChange={(v) => set({ status: v })} options={[["active", "Active"], ["closed", "Closed"], ["out", "Passed / lost / on hold"]]} />
        <FilterMenu label="Strategy" value={f.strategy} onChange={(v) => set({ strategy: v })} options={STRATEGIES.map((s) => [s, STRATEGY_LABELS[s]])} />
        <FilterMenu label="Sponsor" value={f.sponsor} onChange={(v) => set({ sponsor: v })} options={sponsors.map((c) => [c.id, c.name])} />
        <FilterMenu label="Lead" value={f.lead} onChange={(v) => set({ lead: v })} options={leads.map((u) => [u.id, u.name])} />
        {active && (
          <button onClick={reset} className="flex h-8 items-center gap-1 rounded-[8px] px-2 text-[13px] text-text-3 hover:text-text"><X size={14} />Clear</button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {([["mine", "My deals"], ["at_ic", "At IC"], ["passed_12m", "Passed (last 12 mo)"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => set({ quick: f.quick === k ? null : k })}
            className={cn("h-7 rounded-full border px-3 text-[12px]", f.quick === k ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:text-text")}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterMenu({ label, value, options, onChange }: { label: string; value: string | null; options: (readonly [string, string])[]; onChange: (v: string | null) => void }) {
  const current = options.find(([k]) => k === value)?.[1];
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className={cn("flex h-8 items-center gap-1.5 rounded-[10px] border px-2.5 text-[13px]", value ? "border-accent/50 bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:text-text")}>
          {label}{current && <span className="max-w-[140px] truncate font-medium">: {current}</span>}
          <ChevronDown size={13} className="opacity-70" />
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={() => onChange(null)}><span className="w-4">{!value && <Check size={14} />}</span>Any</MenuItem>
        {options.map(([k, text]) => (
          <MenuItem key={k} onSelect={() => onChange(k)}><span className="w-4">{value === k && <Check size={14} />}</span>{text}</MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
