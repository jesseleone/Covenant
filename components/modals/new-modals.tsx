"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import { Check, ExternalLink, FileText, Loader2, Plus, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { COMPANY_TYPES, DEAL_TYPES, PERSON_TYPES, STRATEGIES, STRATEGY_LABELS, type Company, type DB, type Person } from "@/lib/schema";
import { createCompany, createDeal, createPerson } from "@/lib/client/actions";
import { DUPLICATE_THRESHOLD, findCompanyMatches, findPersonMatches, type Match } from "@/lib/dedupe";
import { SAMPLE_CIM, SAMPLE_CIM_FIELDS } from "@/lib/seed/sample-cim";
import { closeNew, useUI } from "@/lib/ui";
import { useCurrentUser, useDB } from "@/lib/store";
import { currentAffiliation, companyById } from "@/lib/selectors";
import { companyTypeLabel, titleCase } from "@/lib/format";
import { Button, Chip, cn } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/menu";

const input = "h-9 w-full rounded-[10px] border border-border-strong bg-surface px-3 outline-none focus:border-focus";
const label = "mb-1 block text-[12px] text-text-3";

/** Mounted once in the app shell; opened from New, the palette and buttons. */
export function GlobalModals() {
  const modal = useUI((s) => s.modal);
  if (!modal) return null;
  if (modal.kind === "deal") return <NewDealModal key="deal" />;
  if (modal.kind === "company") return <NewCompanyModal key="company" prefillName={modal.prefill?.name} />;
  return <NewPersonModal key="person" />;
}

// ---------------------------------------------------------------------------
// Duplicate card
// ---------------------------------------------------------------------------

function DuplicateCard({ title, detail, href, onUse, onIgnore, useLabel = "Use existing" }: {
  title: string; detail: string; href: string; onUse?: () => void; onIgnore: () => void; useLabel?: string;
}) {
  return (
    <div className="rounded-[12px] border border-warn/40 bg-warn-soft/60 p-3 text-[13px]">
      <div><span className="text-warn">Possible match:</span> <span className="font-medium">{title}</span></div>
      <div className="text-[12px] text-text-2">{detail}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={href} target="_blank" rel="noreferrer" className="flex h-7 items-center gap-1 rounded-[8px] border border-border-strong bg-surface px-2.5 text-[12px] hover:bg-surface-2"><ExternalLink size={12} />Open existing</a>
        {onUse && <Button size="sm" variant="primary" onClick={onUse}><Check size={12} />{useLabel}</Button>}
        <Button size="sm" variant="ghost" onClick={onIgnore}>Create anyway</Button>
      </div>
    </div>
  );
}

const companyDetail = (db: DB, c: Company) => {
  const deals = db.deals.filter((d) => d.borrowerCompanyId === c.id || d.sponsorCompanyId === c.id).length;
  return `${c.types.map(companyTypeLabel).join(", ")} · ${c.hqCity ?? "—"}${c.aliases.length ? ` · also "${c.aliases.join('", "')}"` : ""} · ${deals ? `${deals} deal${deals === 1 ? "" : "s"}` : "no deals yet"}`;
};

// ---------------------------------------------------------------------------
// Company picker with inline create
// ---------------------------------------------------------------------------

function CompanyPicker({ db, value, onChange, placeholder, filter }: {
  db: DB; value: { id?: string; newName?: string }; onChange: (v: { id?: string; newName?: string }) => void; placeholder: string; filter?: (c: Company) => boolean;
}) {
  const [q, setQ] = useState(value.id ? companyById(db, value.id)?.name ?? "" : value.newName ?? "");
  const [open, setOpen] = useState(false);
  const pool = useMemo(() => db.companies.filter(filter ?? (() => true)), [db, filter]);
  const fuse = useMemo(() => new Fuse(pool.flatMap((c) => [c.name, ...c.aliases].map((l) => ({ c, l }))), { keys: ["l"], threshold: 0.4, ignoreLocation: true }), [pool]);
  const results = useMemo(() => {
    const seen = new Set<string>();
    return (q ? fuse.search(q).map((r) => r.item.c) : pool).filter((c) => !seen.has(c.id) && seen.add(c.id)).slice(0, 6);
  }, [q, fuse, pool]);
  return (
    <div className="relative">
      <input className={input} value={q} placeholder={placeholder}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); onChange(e.target.value.trim() ? { newName: e.target.value } : {}); }} />
      {value.id && <Chip tone="success" className="absolute top-1/2 right-2 -translate-y-1/2"><Check size={11} />Existing</Chip>}
      {!value.id && value.newName && <Chip tone="accent" className="absolute top-1/2 right-2 -translate-y-1/2"><Plus size={11} />New</Chip>}
      {open && (results.length > 0 || q.trim()) && (
        <div className="absolute top-full right-0 left-0 z-30 mt-1 max-h-[240px] overflow-y-auto rounded-[12px] border border-border bg-surface p-1 shadow-pop">
          {results.map((c) => (
            <button type="button" key={c.id} onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(c.name); onChange({ id: c.id }); setOpen(false); }}
              className="flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-2">
              <span>{c.name}</span><span className="text-[11px] text-text-3">{c.types.map(companyTypeLabel).join(", ")}</span>
            </button>
          ))}
          {q.trim() && !results.some((c) => c.name.toLowerCase() === q.trim().toLowerCase()) && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange({ newName: q.trim() }); setOpen(false); }}
              className="flex w-full items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-left text-[13px] text-accent hover:bg-surface-2"><Plus size={13} />Create “{q.trim()}”</button>
          )}
        </div>
      )}
    </div>
  );
}

/** The best duplicate for a new company name, if close enough and not dismissed. */
function useCompanyDuplicate(db: DB, name: string | undefined, dismissed: string | null) {
  return useMemo(() => {
    if (!name || name.trim().length < 3) return null;
    const m: Match<Company> | undefined = findCompanyMatches(db.companies, name)[0];
    return m && m.score <= DUPLICATE_THRESHOLD && dismissed !== m.item.id ? m : null;
  }, [db, name, dismissed]);
}

// ---------------------------------------------------------------------------
// New deal
// ---------------------------------------------------------------------------

const EXTRACT_STEPS = ["Parsing 4 pages", "Classifying: Confidential Information Memorandum", `Extracting ${SAMPLE_CIM_FIELDS.length} values with sources`, "Resolving the borrower against existing companies"];

function NewDealModal() {
  const db = useDB();
  const user = useCurrentUser();
  const router = useRouter();
  const [name, setName] = useState("");
  const [borrower, setBorrower] = useState<{ id?: string; newName?: string }>({});
  const [strategy, setStrategy] = useState<(typeof STRATEGIES)[number]>("cash_flow");
  const [dealType, setDealType] = useState<(typeof DEAL_TYPES)[number]>("lbo");
  const [sponsor, setSponsor] = useState("");
  const [size, setSize] = useState("");
  const [close, setClose] = useState("");
  const [lead, setLead] = useState(user?.id ?? "");
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [extracting, setExtracting] = useState<number | null>(null);
  const [sample, setSample] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);
  const dup = useCompanyDuplicate(db, borrower.id ? undefined : borrower.newName, dismissed);
  const sponsors = db.companies.filter((c) => c.types.includes("sponsor"));
  const leads = db.users.filter((u) => ["analyst", "associate", "vp", "md"].includes(u.role));

  /** Simulated extraction: step through the progress list, then pre-fill from the CIM. */
  const startExtraction = () => {
    setExtracting(0);
    EXTRACT_STEPS.forEach((_, i) => setTimeout(() => setExtracting(i + 1), 520 * (i + 1)));
    setTimeout(() => {
      // The borrower is left unresolved so the duplicate check runs.
      setName(SAMPLE_CIM.dealName);
      setBorrower({ newName: SAMPLE_CIM.borrowerName });
      setPickerKey((k) => k + 1);
      setDealType("recap");
      setSize(String(SAMPLE_CIM.requestedSize));
      setSample(true);
      setExtracting(null);
    }, 520 * (EXTRACT_STEPS.length + 1));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await createDeal({
      name, borrowerCompanyId: borrower.id, newBorrowerName: borrower.id ? undefined : borrower.newName, strategy, dealType,
      sponsorCompanyId: sponsor || undefined, requestedSize: size ? Number(size) : undefined, expectedClose: close || undefined, leadUserId: lead || undefined, sampleCim: sample,
    });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Created ${name}`, { description: sample ? `${SAMPLE_CIM_FIELDS.length} extracted values are waiting for review on Financials.` : "Complete the record from its Overview." });
    closeNew();
    router.push(`/deals/${r.id}/overview`);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && closeNew()} title="New deal" description="Only the essentials; the rest is filled in on the deal page." className="w-[min(600px,calc(100vw-32px))]">
      {extracting !== null ? (
        <div className="space-y-2 py-2">
          <div className="flex items-center gap-2 font-medium"><Sparkles size={16} className="text-accent" />Reading the sample CIM…</div>
          {EXTRACT_STEPS.map((s, i) => (
            <div key={s} className={cn("flex items-center gap-2 text-[13px]", i < extracting ? "text-text-2" : i === extracting ? "text-text" : "text-text-3")}>
              {i < extracting ? <Check size={14} className="text-success" /> : i === extracting ? <Loader2 size={14} className="animate-spin" /> : <span className="size-3.5" />}{s}
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3.5">
          {!sample && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={startExtraction} className="flex flex-1 items-center gap-2.5 rounded-[12px] border border-dashed border-accent/50 bg-accent-soft/40 px-3 py-2.5 text-left hover:bg-accent-soft">
                <FileText size={18} className="text-accent" />
                <span className="leading-tight"><span className="block text-[13px] font-medium">Start from a sample CIM</span><span className="text-[12px] text-text-2">Project Wren · AI pre-fills the deal and proposes values</span></span>
              </button>
              <button type="button" disabled title="Live PDF extraction is part of the production build" className="flex items-center gap-2 rounded-[12px] border border-dashed border-border px-3 py-2.5 text-[12px] text-text-3">
                <Upload size={15} />Upload your own CIM<br />(coming next)
              </button>
            </div>
          )}
          {sample && <div className="flex items-center gap-2 rounded-[10px] bg-success-soft px-3 py-2 text-[13px]"><Check size={14} className="text-success" />Pre-filled from the sample CIM. {SAMPLE_CIM_FIELDS.length} values will be added as <span className="font-medium">proposed</span> for review.</div>}

          <label className="block"><span className={label}>Deal name or codename</span><input autoFocus className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Project …" /></label>
          <div>
            <span className={label}>Borrower</span>
            <CompanyPicker key={pickerKey} db={db} value={borrower} onChange={(v) => { setBorrower(v); setDismissed(null); }} placeholder="Search companies or type a new name" />
          </div>
          {dup && (
            <DuplicateCard title={dup.item.name} detail={companyDetail(db, dup.item)} href={`/companies/${dup.item.id}/overview`}
              onUse={() => { setBorrower({ id: dup.item.id }); setPickerKey((k) => k + 1); }} onIgnore={() => setDismissed(dup.item.id)} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={label}>Strategy</span>
              <select className={input} value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)}>{STRATEGIES.map((s) => <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>)}</select>
            </label>
            <label className="block"><span className={label}>Deal type</span>
              <select className={input} value={dealType} onChange={(e) => setDealType(e.target.value as typeof dealType)}>{DEAL_TYPES.map((t) => <option key={t} value={t}>{t === "add_on" ? "Add-on" : t.toUpperCase()}</option>)}</select>
            </label>
            <label className="block"><span className={label}>Sponsor (optional)</span>
              <select className={input} value={sponsor} onChange={(e) => setSponsor(e.target.value)}><option value="">None / founder-owned</option>{sponsors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </label>
            <label className="block"><span className={label}>Requested size ($M, optional)</span><input className={input} inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value.replace(/[^\d.]/g, ""))} /></label>
            <label className="block"><span className={label}>Expected close (optional)</span><input type="date" className={input} value={close} onChange={(e) => setClose(e.target.value)} /></label>
            <label className="block"><span className={label}>Deal lead</span>
              <select className={input} value={lead} onChange={(e) => setLead(e.target.value)}>{leads.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </label>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[12px] text-text-3">Starts at Sourced with an empty proposal term set.</span>
            <div className="flex gap-2"><Button variant="ghost" onClick={closeNew}>Cancel</Button><Button type="submit" variant="primary" disabled={!name.trim() || (!borrower.id && !borrower.newName?.trim()) || !!dup}>Create deal</Button></div>
          </div>
        </form>
      )}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// New company
// ---------------------------------------------------------------------------

function NewCompanyModal({ prefillName }: { prefillName?: string }) {
  const db = useDB();
  const router = useRouter();
  const [name, setName] = useState(prefillName ?? "");
  const [types, setTypes] = useState<Company["types"]>(["borrower"]);
  const [domain, setDomain] = useState("");
  const [sector, setSector] = useState("");
  const [hq, setHq] = useState("");
  const [dismissed, setDismissed] = useState<string | null>(null);
  const byName = useCompanyDuplicate(db, name, dismissed);
  const byDomain = domain.trim().length > 3 ? db.companies.find((c) => c.domain && c.domain.toLowerCase() === domain.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "")) : undefined;
  const dup = byName?.item ?? (byDomain && byDomain.id !== dismissed ? byDomain : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await createCompany({ name, types, domain, sector, hqCity: hq });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Created ${name}`);
    closeNew();
    router.push(`/companies/${r.id}/overview`);
  };
  return (
    <Dialog open onOpenChange={(v) => !v && closeNew()} title="New company">
      <form onSubmit={submit} className="space-y-3.5">
        <label className="block"><span className={label}>Name</span><input autoFocus className={input} value={name} onChange={(e) => { setName(e.target.value); setDismissed(null); }} /></label>
        {dup && <DuplicateCard title={dup.name} detail={`${companyDetail(db, dup)}${byDomain && byDomain.id === dup.id ? " · same domain" : ""}`} href={`/companies/${dup.id}/overview`}
          onUse={() => { closeNew(); router.push(`/companies/${dup.id}/overview`); }} useLabel="Go to it" onIgnore={() => setDismissed(dup.id)} />}
        <div>
          <span className={label}>Type</span>
          <div className="flex flex-wrap gap-1.5">
            {COMPANY_TYPES.map((t) => (
              <button type="button" key={t} onClick={() => setTypes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
                className={cn("h-7 rounded-full border px-2.5 text-[12px]", types.includes(t) ? "border-accent bg-accent-soft text-accent" : "border-border text-text-2 hover:text-text")}>{companyTypeLabel(t)}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className={label}>Website / domain</span><input className={input} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" /></label>
          <label className="block"><span className={label}>Headquarters</span><input className={input} value={hq} onChange={(e) => setHq(e.target.value)} placeholder="City, ST" /></label>
          <label className="col-span-2 block"><span className={label}>Sector</span><input className={input} value={sector} onChange={(e) => setSector(e.target.value)} /></label>
        </div>
        <div className="flex justify-end gap-2 pt-1"><Button variant="ghost" onClick={closeNew}>Cancel</Button><Button type="submit" variant="primary" disabled={!name.trim() || !types.length || !!dup}>Create company</Button></div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// New person
// ---------------------------------------------------------------------------

function NewPersonModal() {
  const db = useDB();
  const user = useCurrentUser();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState<{ id?: string; newName?: string }>({});
  const [type, setType] = useState<Person["personType"]>("management");
  const [owner, setOwner] = useState(user?.id ?? "");
  const [dismissed, setDismissed] = useState<string | null>(null);
  const dup = useMemo(() => {
    const m = findPersonMatches(db.people, name, email)[0];
    return m && m.score <= DUPLICATE_THRESHOLD && m.item.id !== dismissed ? m.item : null;
  }, [db, name, email, dismissed]);
  const dupAff = dup ? currentAffiliation(db, dup.id) : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await createPerson({ fullName: name, companyId: company.id, newCompanyName: company.id ? undefined : company.newName, title, email, personType: type, relationshipOwnerId: owner });
    if (!r.ok) return toast.error(r.error);
    toast.success(`Created ${name}`);
    closeNew();
    router.push(`/people/${r.id}/overview`);
  };
  return (
    <Dialog open onOpenChange={(v) => !v && closeNew()} title="New person">
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className={label}>Full name</span><input autoFocus className={input} value={name} onChange={(e) => { setName(e.target.value); setDismissed(null); }} /></label>
          <label className="block"><span className={label}>Email (optional)</span><input className={input} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setDismissed(null); }} /></label>
        </div>
        {dup && <DuplicateCard title={dup.fullName} detail={`${dupAff?.title ?? ""} @ ${companyById(db, dupAff?.companyId)?.name ?? "—"}${dup.email ? ` · ${dup.email}` : ""}`} href={`/people/${dup.id}/overview`}
          onUse={() => { closeNew(); router.push(`/people/${dup.id}/overview`); }} useLabel="Go to them" onIgnore={() => setDismissed(dup.id)} />}
        <div><span className={label}>Company</span><CompanyPicker db={db} value={company} onChange={setCompany} placeholder="Search companies or type a new one" /></div>
        <div className="grid grid-cols-3 gap-3">
          <label className="block"><span className={label}>Title</span><input className={input} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="block"><span className={label}>Type</span>
            <select className={input} value={type} onChange={(e) => setType(e.target.value as Person["personType"])}>{PERSON_TYPES.filter((t) => t !== "internal").map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select>
          </label>
          <label className="block"><span className={label}>Relationship owner</span>
            <select className={input} value={owner} onChange={(e) => setOwner(e.target.value)}>{db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1"><Button variant="ghost" onClick={closeNew}>Cancel</Button><Button type="submit" variant="primary" disabled={!name.trim() || (!company.id && !company.newName?.trim()) || !!dup}>Create person</Button></div>
      </form>
    </Dialog>
  );
}
