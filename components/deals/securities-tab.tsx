"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GitCompareArrows, Lock, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { LIEN_RANKS, type Covenant, type DB, type Deal, type TermSet, type Tranche } from "@/lib/schema";
import { createTermSetVersion, discardTermSetDraft, issueTermSet, saveTermSetDraft } from "@/lib/actions";
import { can } from "@/lib/permissions";
import { newId, useCurrentUser } from "@/lib/store";
import { currentCovenantLevel, metricsAsOf, numField, termSetsFor, userById } from "@/lib/selectors";
import { TRANCHE_FIELDS, covenantSchedule, diffTerms } from "@/lib/terms";
import { fmtBps, fmtDate, fmtMonthYear, fmtPct, fmtSpread, fmtUsdM, fmtX, titleCase, termSetLabel } from "@/lib/format";
import { Button, Card, EmptyState, Label, Section, cn } from "@/components/ui/primitives";
import { Dialog, Tip } from "@/components/ui/menu";

type Terms = { tranches: Tranche[]; covenants: Covenant[] };

const termsOf = (db: DB, ts: TermSet): Terms => ({
  tranches: db.tranches.filter((t) => t.termSetId === ts.id),
  covenants: db.covenants.filter((c) => c.termSetId === ts.id),
});

/** Leverage and cushion for a set of terms (saved or being edited). */
function metricsFor(db: DB, deal: Deal, terms: Terms) {
  const ebitda = numField(db, deal.id, "adj_ebitda_ltm");
  const funded = terms.tranches.reduce((s, t) => s + (Number(t.fundedAtClose) || 0), 0);
  const leverage = ebitda ? funded / ebitda : null;
  const cov = terms.covenants.find((c) => c.metric === "total_leverage");
  const level = currentCovenantLevel(cov, metricsAsOf(db, deal.id));
  return {
    facility: terms.tranches.reduce((s, t) => s + (Number(t.commitment) || 0), 0),
    hold: terms.tranches.reduce((s, t) => s + (Number(t.fundHold) || 0), 0),
    funded, leverage, level, cov,
    cushion: leverage !== null && level ? 1 - leverage / level : null,
  };
}

export function SecuritiesTab({ db, deal }: { db: DB; deal: Deal }) {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sets = termSetsFor(db, deal.id);
  const latest = sets.at(-1);
  const selected = sets.find((t) => t.version === Number(params.get("v"))) ?? latest;
  const [compare, setCompare] = useState(params.get("compare") === "1");
  const canEdit = !!user && can(user.role, "edit_terms");

  if (!selected || !latest) return <EmptyState title="No term set yet">Draft proposed terms to start.</EmptyState>;

  const go = (v: number, extra = "") => router.replace(`${pathname}?v=${v}${extra}`, { scroll: false });

  const onNewVersion = () => {
    const r = createTermSetVersion(deal.id);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Created v${latest.version + 1} as a draft`, { description: "Edit the terms, then save and issue." });
    setCompare(false);
    go(latest.version + 1);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Term-set versions">
          {[...sets].reverse().map((t) => (
            <button key={t.id} role="tab" aria-selected={t.id === selected.id} onClick={() => { setCompare(false); go(t.version); }}
              className={cn("flex h-8 items-center gap-1.5 rounded-[10px] border px-2.5 text-[13px]", t.id === selected.id && !compare ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:text-text")}>
              {t.status === "locked" && <Lock size={12} />}
              <span className="font-medium">v{t.version}</span>
              <span className="text-[12px] opacity-80">{termSetLabel(t.label)}</span>
              <span className="text-[11px] opacity-70">· {t.status}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {sets.length > 1 && (
            <Button variant={compare ? "secondary" : "outline"} size="sm" onClick={() => setCompare((c) => !c)}>
              <GitCompareArrows size={14} />{compare ? "Exit compare" : "Compare versions"}
            </Button>
          )}
          {canEdit ? (
            <Button variant="primary" size="sm" onClick={onNewVersion} disabled={latest.status === "draft"} title={latest.status === "draft" ? `v${latest.version} is still a draft` : undefined}>
              <Plus size={14} />New version
            </Button>
          ) : (
            <Tip content="Only a VP or MD can create term-set versions" side="left"><span><Button size="sm" variant="outline" disabled><Plus size={14} />New version</Button></span></Tip>
          )}
        </div>
      </div>

      {compare ? (
        <CompareView db={db} deal={deal} sets={sets} />
      ) : (
        <VersionView key={selected.id + (selected.status === "draft" ? db.tranches.filter((t) => t.termSetId === selected.id).map((t) => t.id).join() : "")}
          db={db} deal={deal} ts={selected} editable={canEdit && selected.status === "draft"} latest={selected.id === latest.id} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One version: tranches, covenant and headroom, sources & uses
// ---------------------------------------------------------------------------

function VersionView({ db, deal, ts, editable, latest }: { db: DB; deal: Deal; ts: TermSet; editable: boolean; latest: boolean }) {
  const saved = useMemo(() => termsOf(db, ts), [db, ts]);
  const [draft, setDraft] = useState<Terms>(() => structuredClone(saved));
  const [confirmIssue, setConfirmIssue] = useState(false);
  const terms = editable ? draft : saved;
  const dirty = editable && diffTerms(saved, draft).length > 0;
  const m = metricsFor(db, deal, terms);
  const savedM = metricsFor(db, deal, saved);
  const lockedBy = db.icEvents.find((e) => e.id === ts.lockedByIcEventId);
  const parent = db.termSets.find((t) => t.id === ts.parentId);
  const creator = userById(db, ts.createdBy);

  const setTranche = (id: string, patch: Partial<Tranche>) =>
    setDraft((d) => ({ ...d, tranches: d.tranches.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const setLevels = (covId: string, levels: Covenant["levels"]) =>
    setDraft((d) => ({ ...d, covenants: d.covenants.map((c) => (c.id === covId ? { ...c, levels } : c)) }));

  const save = () => {
    const r = saveTermSetDraft(ts.id, draft.tranches, draft.covenants);
    if (!r.ok) { toast.error(r.error); return false; }
    toast.success(`Saved v${ts.version}`);
    return true;
  };
  const issue = () => {
    if (dirty && !save()) return;
    const r = issueTermSet(ts.id);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Issued term set v${ts.version}`, { description: "It is now read-only. Create a new version to change it." });
    setConfirmIssue(false);
  };
  const discard = () => {
    const r = discardTermSetDraft(ts.id);
    if (!r.ok) return toast.error(r.error);
    toast(`Discarded draft v${ts.version}`);
  };

  return (
    <div className="space-y-5">
      {ts.status === "locked" && (
        <div className="flex items-center gap-2 rounded-[12px] border border-success/30 bg-success-soft px-4 py-2.5 text-[13px]">
          <Lock size={15} className="text-success" />
          <span><span className="font-medium">Locked · IC-approved</span>{lockedBy?.decidedAt && ` on ${fmtDate(lockedBy.decidedAt)}`}. Read-only; changes need a new version and a new approval.</span>
        </div>
      )}
      {editable && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-accent/30 bg-accent-soft/60 px-4 py-2.5 text-[13px]">
          <span><span className="font-medium">Draft v{ts.version}</span> · copied from v{parent?.version}. {dirty ? "Unsaved changes; figures below update as you type." : "Edit any value below."}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={discard}><Trash2 size={13} />Discard draft</Button>
            {dirty && <Button size="sm" variant="ghost" onClick={() => setDraft(structuredClone(saved))}><X size={13} />Revert</Button>}
            <Button size="sm" variant="outline" disabled={!dirty} onClick={save}>Save draft</Button>
            <Button size="sm" variant="primary" onClick={() => setConfirmIssue(true)}>Issue v{ts.version}</Button>
          </div>
        </div>
      )}
      {!editable && ts.status === "draft" && (
        <div className="rounded-[12px] border border-border bg-surface-2/50 px-4 py-2.5 text-[13px] text-text-2">Draft v{ts.version}, being edited by the VP / MD. Read-only for your role.</div>
      )}

      <Section title="Facilities" actions={editable && (
        <Button size="sm" variant="ghost" onClick={() => setDraft((d) => ({ ...d, tranches: [...d.tranches, blankTranche(ts.id, d.tranches)] }))}><Plus size={13} />Add tranche</Button>
      )}>
        <TrancheTable tranches={terms.tranches} editable={editable} onChange={setTranche}
          onRemove={(id) => setDraft((d) => ({ ...d, tranches: d.tranches.filter((t) => t.id !== id) }))} />
      </Section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {terms.covenants.map((c) => (
            <CovenantPanel key={c.id} db={db} cov={c} leverage={m.leverage} editable={editable} onChange={(levels) => setLevels(c.id, levels)} />
          ))}
          {terms.covenants.length === 0 && <Card className="p-4 text-text-3">No financial covenant (covenant-lite or ARR structure).</Card>}
        </div>

        <aside className="space-y-4">
          <Card className="space-y-3 p-4">
            <Label>Key figures · v{ts.version}{dirty && " (unsaved)"}</Label>
            <Figure label="Facility size" value={fmtUsdM(m.facility)} prev={dirty ? fmtUsdM(savedM.facility) : undefined} />
            <Figure label="Fernhill hold" value={fmtUsdM(m.hold)} prev={dirty ? fmtUsdM(savedM.hold) : undefined} />
            <Figure label="Funded at close" value={fmtUsdM(m.funded)} prev={dirty ? fmtUsdM(savedM.funded) : undefined} />
            <Figure label="Total leverage" value={fmtX(m.leverage)} prev={dirty ? fmtX(savedM.leverage) : undefined} />
            <Figure label="Covenant cushion" value={fmtPct(m.cushion)} prev={dirty ? fmtPct(savedM.cushion) : undefined}
              tone={m.cushion === null ? undefined : m.cushion * 100 < db.settings.coverageCushionGuidelinePct ? "warn" : "success"} />
            <p className="border-t border-border pt-2 text-[12px] text-text-3">
              {latest ? "This is the active version: the deal header and memo use it." : "An earlier version, kept for comparison."}{" "}
              Created by {creator?.name} {fmtDate(ts.createdAt)}.
            </p>
          </Card>
          <SourcesUses db={db} deal={deal} terms={terms} />
        </aside>
      </div>

      <Dialog open={confirmIssue} onOpenChange={setConfirmIssue} title={`Issue term set v${ts.version}?`}
        description="Issued terms are read-only and become the version the deal team negotiates against. Later changes need a new version.">
        {parent && diffTerms(termsOf(db, parent), draft).length > 0 && (
          <div className="mb-4 space-y-1 rounded-[10px] bg-surface-2/60 p-3 text-[13px]">
            <div className="mb-1 text-[12px] text-text-3">Changes from v{parent.version}</div>
            {diffTerms(termsOf(db, parent), draft).map((c) => (
              <div key={c.section + c.label}>{c.section === "Covenant" ? "" : `${c.section} · `}{c.label}: <span className="text-text-3 line-through">{c.before}</span> → <span className="font-medium">{c.after}</span></div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmIssue(false)}>Cancel</Button>
          <Button variant="primary" onClick={issue}>{dirty ? "Save and issue" : "Issue"}</Button>
        </div>
      </Dialog>
    </div>
  );
}

function blankTranche(termSetId: string, existing: Tranche[]): Tranche {
  const n = existing.length + 1;
  const tl = existing.find((t) => t.key === "tl");
  return {
    id: newId("tr"), termSetId, key: `t${n}_${Math.random().toString(36).slice(2, 5)}`, name: "New tranche", instrument: "term_loan", lienRank: "1L",
    commitment: 10, fundedAtClose: 0, fundHold: 10, baseRate: "SOFR", spreadBps: tl?.spreadBps ?? 500, floorBps: tl?.floorBps ?? 75,
    oidPct: tl?.oidPct ?? 2, pikBps: 0, callProtection: tl?.callProtection ?? "102 / 101 / par", maturityDate: tl?.maturityDate ?? "2032-12-31", amortPctPerYear: 1,
  };
}

function Figure({ label, value, prev, tone }: { label: string; value: string; prev?: string; tone?: "warn" | "success" }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[13px] text-text-2">{label}</span>
      <span className="text-right tabular-nums">
        {prev && prev !== value && <span className="mr-1.5 text-[12px] text-text-3 line-through">{prev}</span>}
        <span className={cn("font-medium", tone === "warn" && "text-warn", tone === "success" && "text-success")}>{value}</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tranches
// ---------------------------------------------------------------------------

const cellInput = "h-7 w-full min-w-0 rounded-[6px] border border-border-strong bg-surface px-1.5 text-right text-[13px] tabular-nums outline-none focus:border-focus";

type Col = { key: keyof Tranche; label: string; kind: "usd" | "bps" | "pct" | "text" | "date" | "lien"; width: string };
const COLS: Col[] = [
  { key: "commitment", label: "Commitment", kind: "usd", width: "w-[84px]" },
  { key: "fundedAtClose", label: "Funded", kind: "usd", width: "w-[76px]" },
  { key: "fundHold", label: "Hold", kind: "usd", width: "w-[76px]" },
  { key: "lienRank", label: "Lien", kind: "lien", width: "w-[70px]" },
  { key: "spreadBps", label: "Spread", kind: "bps", width: "w-[64px]" },
  { key: "floorBps", label: "Floor", kind: "bps", width: "w-[56px]" },
  { key: "oidPct", label: "OID %", kind: "pct", width: "w-[56px]" },
  { key: "callProtection", label: "Call", kind: "text", width: "w-[112px]" },
  { key: "maturityDate", label: "Maturity", kind: "date", width: "w-[128px]" },
  { key: "amortPctPerYear", label: "Amort %", kind: "pct", width: "w-[56px]" },
];

function show(t: Tranche, c: Col) {
  const v = t[c.key];
  switch (c.kind) {
    case "usd": return fmtUsdM(v as number);
    case "bps": return c.key === "spreadBps" ? fmtSpread(v as number) : fmtBps(v as number);
    case "pct": return `${(v as number).toFixed(1)}%`;
    case "date": return fmtMonthYear(v as string);
    default: return String(v);
  }
}

function TrancheTable({ tranches, editable, onChange, onRemove }: { tranches: Tranche[]; editable: boolean; onChange: (id: string, p: Partial<Tranche>) => void; onRemove: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-[12px] border border-border bg-surface">
      <table className="w-full border-collapse text-[13px] tabular-nums">
        <thead className="border-b border-border text-[12px] text-text-3">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Tranche</th>
            {COLS.map((c) => <th key={c.key} className={cn("px-2 py-2 font-medium whitespace-nowrap", c.kind === "text" || c.kind === "lien" || c.kind === "date" ? "text-left" : "text-right")}>{c.label}</th>)}
            {editable && <th />}
          </tr>
        </thead>
        <tbody>
          {tranches.map((t) => (
            <tr key={t.id} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2 font-medium whitespace-nowrap">
                {editable ? <input className={cn(cellInput, "w-[150px] text-left font-medium")} value={t.name} onChange={(e) => onChange(t.id, { name: e.target.value })} /> : t.name}
              </td>
              {COLS.map((c) => (
                <td key={c.key} className={cn("px-2 py-2 whitespace-nowrap", c.kind === "text" || c.kind === "lien" || c.kind === "date" ? "text-left" : "text-right")}>
                  {editable ? <EditCell t={t} c={c} onChange={(p) => onChange(t.id, p)} /> : show(t, c)}
                </td>
              ))}
              {editable && (
                <td className="pr-2">
                  <button onClick={() => onRemove(t.id)} aria-label={`Remove ${t.name}`} className="rounded p-1 text-text-3 hover:bg-danger-soft hover:text-danger"><Trash2 size={14} /></button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border text-text-2">
          <tr>
            <td className="px-3 py-2 font-medium">Total</td>
            <td className="px-2 py-2 text-right font-medium">{fmtUsdM(tranches.reduce((s, t) => s + (Number(t.commitment) || 0), 0))}</td>
            <td className="px-2 py-2 text-right">{fmtUsdM(tranches.reduce((s, t) => s + (Number(t.fundedAtClose) || 0), 0))}</td>
            <td className="px-2 py-2 text-right">{fmtUsdM(tranches.reduce((s, t) => s + (Number(t.fundHold) || 0), 0))}</td>
            <td colSpan={COLS.length - 3 + (editable ? 1 : 0)} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function EditCell({ t, c, onChange }: { t: Tranche; c: Col; onChange: (p: Partial<Tranche>) => void }) {
  const v = t[c.key];
  if (c.kind === "lien") {
    return <select className={cn(cellInput, c.width, "text-left")} value={v as string} onChange={(e) => onChange({ lienRank: e.target.value as Tranche["lienRank"] })}>{LIEN_RANKS.map((l) => <option key={l}>{l}</option>)}</select>;
  }
  if (c.kind === "text") return <input className={cn(cellInput, c.width, "text-left")} value={v as string} onChange={(e) => onChange({ [c.key]: e.target.value })} />;
  if (c.kind === "date") return <input type="date" className={cn(cellInput, c.width, "text-left")} value={v as string} onChange={(e) => onChange({ [c.key]: e.target.value })} />;
  return (
    <input className={cn(cellInput, c.width)} inputMode="decimal" value={String(v)}
      onChange={(e) => { const n = e.target.value === "" ? 0 : Number(e.target.value); if (!Number.isNaN(n)) onChange({ [c.key]: n }); }} />
  );
}

// ---------------------------------------------------------------------------
// Covenant: schedule and headroom
// ---------------------------------------------------------------------------

function CovenantPanel({ db, cov, leverage, editable, onChange }: { db: DB; cov: Covenant; leverage: number | null; editable: boolean; onChange: (levels: Covenant["levels"]) => void }) {
  const levels = [...cov.levels].sort((a, b) => a.from.localeCompare(b.from));
  const asOf = db.settings.today;
  const current = currentCovenantLevel(cov, asOf);
  const guide = db.settings.coverageCushionGuidelinePct / 100;
  const update = (i: number, patch: Partial<Covenant["levels"][number]>) => onChange(levels.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <Section title={cov.metric === "total_leverage" ? "Maximum total leverage covenant" : titleCase(cov.metric)}
      actions={<span className="text-[12px] text-text-3">Tested {cov.testFrequency}</span>}>
      <Card className="space-y-5 p-5">
        {leverage !== null && current !== null && <HeadroomBar leverage={leverage} level={current} guideline={guide} />}
        <table className="w-full text-[13px] tabular-nums">
          <thead className="text-[12px] text-text-3">
            <tr className="border-b border-border"><th className="py-1.5 text-left font-medium">Test date from</th><th className="py-1.5 text-right font-medium">Level</th><th className="py-1.5 text-right font-medium">Cushion at close leverage</th>{editable && <th />}</tr>
          </thead>
          <tbody>
            {levels.map((l, i) => {
              const cushion = leverage !== null ? 1 - leverage / l.level : null;
              return (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className="py-1.5">{editable ? <input type="date" className={cn(cellInput, "w-[140px] text-left")} value={l.from} onChange={(e) => update(i, { from: e.target.value })} /> : fmtDate(l.from)}</td>
                  <td className="py-1.5 text-right font-medium">
                    {editable ? <input className={cn(cellInput, "ml-auto w-[72px]")} inputMode="decimal" value={String(l.level)} onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) update(i, { level: n }); }} aria-label={`Level from ${l.from}`} /> : fmtX(l.level)}
                  </td>
                  <td className={cn("py-1.5 text-right", cushion === null ? "" : cushion < 0.1 ? "text-danger" : cushion < guide ? "text-warn" : "text-success")}>{fmtPct(cushion)}</td>
                  {editable && <td className="w-8 text-right"><button onClick={() => onChange(levels.filter((_, j) => j !== i))} aria-label="Remove step" className="rounded p-1 text-text-3 hover:text-danger"><X size={13} /></button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        {editable && (
          <Button size="sm" variant="ghost" onClick={() => {
            const last = levels.at(-1);
            const next = last ? `${Number(last.from.slice(0, 4)) + 1}${last.from.slice(4)}` : `${asOf.slice(0, 4)}-12-31`;
            onChange([...levels, { from: next, level: last ? +(last.level - 0.5).toFixed(2) : 6 }]);
          }}><Plus size={13} />Add step-down</Button>
        )}
        {cov.notes && <p className="text-[12px] text-text-3">{cov.notes}</p>}
      </Card>
    </Section>
  );
}

/** Leverage against the covenant level, with the cushion guideline marked. */
export function HeadroomBar({ leverage, level, guideline }: { leverage: number; level: number; guideline: number }) {
  const max = Math.max(level, leverage) * 1.12;
  const pos = (x: number) => `${Math.min(100, (x / max) * 100)}%`;
  const guideAt = level * (1 - guideline);
  const cushion = 1 - leverage / level;
  const tone = cushion < 0 ? "bg-danger" : cushion < 0.1 ? "bg-danger" : cushion < guideline ? "bg-warn" : "bg-success";
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-[13px]">
        <span>Leverage <span className="font-medium tabular-nums">{fmtX(leverage)}</span> vs covenant <span className="font-medium tabular-nums">{fmtX(level)}</span></span>
        <span className={cn("font-medium tabular-nums", cushion < guideline ? "text-warn" : "text-success")}>{fmtPct(cushion)} cushion</span>
      </div>
      <div className="relative h-3 rounded-full bg-surface-2">
        <div className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-300", tone)} style={{ width: pos(leverage) }} />
        <div className="absolute -inset-y-1 w-px bg-warn" style={{ left: pos(guideAt) }} title={`${Math.round(guideline * 100)}% cushion guideline`} />
        <div className="absolute -inset-y-1.5 w-0.5 rounded bg-text" style={{ left: pos(level) }} title="Covenant level" />
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-text-3 tabular-nums">
        <span className="absolute -translate-x-1/2 text-warn" style={{ left: pos(guideAt) }}>{fmtX(guideAt)} · {Math.round(guideline * 100)}% guideline</span>
        <span className="absolute -translate-x-1/2" style={{ left: pos(level) }}>{fmtX(level)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources & uses
// ---------------------------------------------------------------------------

function SourcesUses({ db, deal, terms }: { db: DB; deal: Deal; terms: Terms }) {
  const equity = numField(db, deal.id, "sponsor_equity");
  const ev = numField(db, deal.id, "ev");
  const debt = terms.tranches.filter((t) => t.fundedAtClose > 0);
  const sources = debt.reduce((s, t) => s + Number(t.fundedAtClose), 0) + (equity ?? 0);
  return (
    <Card className="space-y-3 p-4">
      <Label>Sources &amp; uses at close</Label>
      <div className="space-y-1 text-[13px]">
        <div className="text-[12px] text-text-3">Sources</div>
        {debt.map((t) => <Row key={t.id} label={t.name} value={fmtUsdM(t.fundedAtClose)} />)}
        {equity !== null && <Row label="Sponsor equity" value={fmtUsdM(equity)} />}
        <Row label="Total" value={fmtUsdM(sources)} strong />
      </div>
      {ev !== null && equity !== null ? (
        <div className="space-y-1 text-[13px]">
          <div className="text-[12px] text-text-3">Uses</div>
          <Row label="Purchase price (EV)" value={fmtUsdM(ev)} />
          <Row label="Fees, expenses & cash" value={fmtUsdM(sources - ev)} />
          <Row label="Total" value={fmtUsdM(sources)} strong />
          <p className="pt-1 text-[12px] text-text-3">Equity is {fmtPct(equity / sources, 0)} of sources. EV and equity from the CIM.</p>
        </div>
      ) : (
        <p className="text-[12px] text-text-3">Uses need EV and sponsor equity, which haven&apos;t been extracted for this deal.</p>
      )}
    </Card>
  );
}

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className={cn("flex justify-between gap-2 tabular-nums", strong && "border-t border-border pt-1 font-medium")}><span className={strong ? "" : "text-text-2"}>{label}</span><span>{value}</span></div>
);

// ---------------------------------------------------------------------------
// Compare two versions
// ---------------------------------------------------------------------------

function CompareView({ db, deal, sets }: { db: DB; deal: Deal; sets: TermSet[] }) {
  const [aId, setA] = useState(sets.at(-2)!.id);
  const [bId, setB] = useState(sets.at(-1)!.id);
  const [all, setAll] = useState(false);
  const a = sets.find((t) => t.id === aId)!, b = sets.find((t) => t.id === bId)!;
  const ta = termsOf(db, a), tb = termsOf(db, b);
  const ma = metricsFor(db, deal, ta), mb = metricsFor(db, deal, tb);
  const changes = diffTerms(ta, tb);

  type R = { section: string; label: string; a: string; b: string };
  const rows: R[] = [
    { section: "Summary", label: "Facility size", a: fmtUsdM(ma.facility), b: fmtUsdM(mb.facility) },
    { section: "Summary", label: "Funded at close", a: fmtUsdM(ma.funded), b: fmtUsdM(mb.funded) },
    { section: "Summary", label: "Total leverage", a: fmtX(ma.leverage), b: fmtX(mb.leverage) },
    { section: "Summary", label: "Covenant cushion", a: fmtPct(ma.cushion), b: fmtPct(mb.cushion) },
  ];
  if (all) {
    for (const key of [...new Set([...ta.tranches, ...tb.tranches].map((t) => t.key))]) {
      const x = ta.tranches.find((t) => t.key === key), y = tb.tranches.find((t) => t.key === key);
      for (const f of TRANCHE_FIELDS) rows.push({ section: (y ?? x)!.name, label: f.label, a: x ? f.fmt(x[f.key]) : "—", b: y ? f.fmt(y[f.key]) : "—" });
    }
    rows.push({ section: "Covenant", label: "Max total leverage", a: covenantSchedule(ta.covenants[0]), b: covenantSchedule(tb.covenants[0]) });
  } else {
    rows.push(...changes.map((c) => ({ section: c.section, label: c.label, a: c.before, b: c.after })));
  }

  const picker = (value: string, set: (v: string) => void) => (
    <select value={value} onChange={(e) => set(e.target.value)} className="h-8 rounded-[8px] border border-border-strong bg-surface px-2 text-[13px]">
      {sets.map((t) => <option key={t.id} value={t.id}>v{t.version} · {termSetLabel(t.label)} · {t.status}</option>)}
    </select>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        Compare {picker(aId, setA)} with {picker(bId, setB)}
        <span className="text-text-3">· {changes.length} term{changes.length === 1 ? "" : "s"} changed</span>
        <label className="ml-auto flex items-center gap-1.5 text-text-2"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />Show all terms</label>
      </div>
      <div className="overflow-x-auto rounded-[12px] border border-border bg-surface">
        <table className="w-full border-collapse text-[13px] tabular-nums">
          <thead className="border-b border-border text-[12px] text-text-3">
            <tr><th className="px-3 py-2 text-left font-medium"></th><th className="px-3 py-2 text-left font-medium">Term</th><th className="px-3 py-2 text-right font-medium">v{a.version}</th><th className="px-3 py-2 text-right font-medium">v{b.version}</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const changed = r.a !== r.b;
              return (
                <tr key={i} className={cn("border-b border-border last:border-b-0", r.section === "Summary" && "bg-surface-2/30")}>
                  <td className="px-3 py-1.5 text-text-3">{i === 0 || rows[i - 1].section !== r.section ? r.section : ""}</td>
                  <td className="px-3 py-1.5">{r.label}</td>
                  <td className={cn("px-3 py-1.5 text-right", changed ? "text-text-3" : "")}>{r.a}</td>
                  <td className={cn("px-3 py-1.5 text-right", changed && "bg-accent-soft font-medium text-accent")}>{r.b}</td>
                </tr>
              );
            })}
            {!all && changes.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-text-3">No term changes between these versions.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-text-3">Leverage and cushion use the current reviewed LTM EBITDA ({fmtUsdM(numField(db, deal.id, "adj_ebitda_ltm"))}) for both versions.</p>
    </div>
  );
}
