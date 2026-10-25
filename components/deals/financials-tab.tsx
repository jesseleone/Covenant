"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, CheckCheck, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { DB, Deal, ExtractedField } from "@/lib/schema";
import { confirmAllAbove, confirmField, correctField, findQuote } from "@/lib/actions";
import { can } from "@/lib/permissions";
import { useCurrentUser, useDBStore } from "@/lib/store";
import {
  activeTermSet, covenantFor, currentCovenantLevel, cushionPct, documentById, fieldValue, fundedDebt, sectionIsStale, totalLeverage, userById,
} from "@/lib/selectors";
import { docShortName } from "@/lib/render/tokens";
import { fmtDateShort, fmtFieldValue, fmtPct, fmtUsdM, fmtX } from "@/lib/format";
import { Button, Chip, EmptyState, Section, cn } from "@/components/ui/primitives";
import { FieldStatusChip } from "@/components/ui/chips";
import { Dialog, Tip } from "@/components/ui/menu";
import { DocViewer } from "@/components/common/doc-viewer";

const sourceLabel = (db: DB, docId: string, page: number) => `${docShortName(documentById(db, docId)?.docType)} p.${page}`;

export function FinancialsTab({ db, deal }: { db: DB; deal: Deal }) {
  return (
    <div className="space-y-10">
      <ExtractionReview db={db} deal={deal} />
      <Spreads db={db} deal={deal} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Extraction review
// ---------------------------------------------------------------------------

function ExtractionReview({ db, deal }: { db: DB; deal: Deal }) {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const canReview = !!user && can(user.role, "review_field");

  const fields = useMemo(() => db.extractedFields
    .filter((f) => f.dealId === deal.id)
    .sort((a, b) => Number(b.status === "proposed") - Number(a.status === "proposed") || a.confidence - b.confidence), [db, deal.id]);
  const proposed = fields.filter((f) => f.status === "proposed");
  const bulk = proposed.filter((f) => f.confidence >= 0.9).length;

  const [filter, setFilter] = useState<"review" | "all">(proposed.length ? "review" : "all");
  const shown = filter === "review" ? proposed : fields;
  const paramKey = params.get("field");
  const [selectedKey, setSelectedKey] = useState<string | null>(paramKey ?? proposed[0]?.fieldKey ?? fields[0]?.fieldKey ?? null);
  const selected = fields.find((f) => f.fieldKey === selectedKey) ?? fields[0];
  const [docOverride, setDocOverride] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<ExtractedField | null>(null);

  if (fields.length === 0) return <Section title="Extraction review"><EmptyState title="Nothing extracted yet">Upload a CIM or QoE to extract financials.</EmptyState></Section>;

  const docId = docOverride ?? selected?.documentId;
  const doc = documentById(db, docId);
  const docsWithFields = db.documents.filter((d) => d.dealId === deal.id && d.pages.length > 0);
  const highlights = fields.filter((f) => f.documentId === docId).map((f) => ({ text: f.quote, active: f.id === selected?.id }));

  const select = (f: ExtractedField) => {
    setSelectedKey(f.fieldKey);
    setDocOverride(null);
    router.replace(`${pathname}?field=${f.fieldKey}`, { scroll: false });
  };

  const onConfirm = (f: ExtractedField) => {
    const r = confirmField(f.id);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Confirmed ${f.label}`);
    const next = proposed.find((x) => x.id !== f.id);
    if (next) select(next);
  };
  const onBulk = () => {
    const r = confirmAllAbove(deal.id, 0.9);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Confirmed ${r.count} value${r.count === 1 ? "" : "s"} with confidence ≥ 0.90`);
  };

  return (
    <Section
      title="Extraction review"
      actions={
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-text-3">
            {proposed.length} to review · {fields.filter((f) => f.status === "confirmed").length} confirmed · {fields.filter((f) => f.status === "corrected").length} corrected
          </span>
          {canReview && bulk > 0 && <Button size="sm" variant="outline" onClick={onBulk}><CheckCheck size={14} />Confirm all ≥ 0.90 ({bulk})</Button>}
        </div>
      }
    >
      <p className="-mt-1 text-[13px] text-text-2">AI proposes each value with its source and a confidence score. A person confirms or corrects it before it feeds leverage, covenants and the memo.</p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Source document */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {docsWithFields.map((d) => (
              <button key={d.id} onClick={() => setDocOverride(d.id)}
                className={cn("h-7 rounded-full border px-2.5 text-[12px]", d.id === docId ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:text-text")}>
                {docShortName(d.docType)} · {d.pages.length}p
              </button>
            ))}
          </div>
          {doc && <DocViewer doc={doc} focusPage={selected?.documentId === doc.id ? selected.page : 1} highlights={highlights} className="h-[620px]" />}
        </div>

        {/* Extracted values */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex rounded-[10px] border border-border bg-surface p-0.5 text-[12px]">
            {([["review", `Needs review (${proposed.length})`], ["all", `All values (${fields.length})`]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} className={cn("h-7 flex-1 rounded-[8px]", filter === k ? "bg-surface-2 font-medium" : "text-text-2 hover:text-text")}>{label}</button>
            ))}
          </div>
          <div className="h-[620px] space-y-1.5 overflow-y-auto pr-1">
            {shown.length === 0 && <EmptyState title="All values reviewed">Every extracted value has been confirmed or corrected.</EmptyState>}
            {shown.map((f) => (
              <FieldRow key={f.id} db={db} f={f} selected={f.id === selected?.id} canReview={canReview}
                onSelect={() => select(f)} onConfirm={() => onConfirm(f)} onCorrect={() => setCorrecting(f)} />
            ))}
          </div>
        </div>
      </div>
      {correcting && <CorrectDialog key={correcting.id} db={db} deal={deal} field={correcting} onClose={() => setCorrecting(null)} onDone={(f) => select(f)} />}
    </Section>
  );
}

function FieldRow({ db, f, selected, canReview, onSelect, onConfirm, onCorrect }: {
  db: DB; f: ExtractedField; selected: boolean; canReview: boolean; onSelect: () => void; onConfirm: () => void; onCorrect: () => void;
}) {
  const reviewer = userById(db, f.reviewedBy);
  const low = f.confidence < 0.8;
  return (
    <div
      role="button" tabIndex={0} onClick={onSelect} onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn("rounded-[12px] border bg-surface p-3 transition-colors", selected ? "border-accent/60 ring-1 ring-accent/30" : "border-border hover:border-border-strong")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] text-text-2">{f.label}{f.period && <span className="text-text-3"> · {f.period}</span>}</div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
            <span className="text-[18px] font-medium tabular-nums">{fmtFieldValue(f)}</span>
            {f.correctedFrom && (
              <span className="text-[12px] text-text-3">
                was <span className="line-through">{fmtFieldValue({ ...f, value: f.correctedFrom.value })}</span> · {sourceLabel(db, f.correctedFrom.documentId, f.correctedFrom.page)}
              </span>
            )}
          </div>
        </div>
        <FieldStatusChip status={f.status} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="font-mono text-[11px] text-text-3">{sourceLabel(db, f.documentId, f.page)}</span>
        {f.status === "corrected" ? (
          <span className="flex-1 text-[12px] text-text-3">Entered by a reviewer · AI confidence no longer applies</span>
        ) : (
          <div className="flex flex-1 items-center gap-2" title="Extraction confidence">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className={cn("h-full rounded-full", low ? "bg-warn" : "bg-success")} style={{ width: `${Math.round(f.confidence * 100)}%` }} />
            </div>
            <span className={cn("w-9 text-right text-[12px] tabular-nums", low ? "text-warn" : "text-text-3")}>{Math.round(f.confidence * 100)}%</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[12px] text-text-3">{reviewer ? `${f.status === "corrected" ? "Corrected" : "Confirmed"} by ${reviewer.name} · ${fmtDateShort(f.reviewedAt)}` : "Awaiting review"}</span>
        {canReview ? (
          <div className="flex shrink-0 gap-1.5" onClick={(e) => e.stopPropagation()}>
            {f.status === "proposed" && <Button size="sm" variant="primary" onClick={onConfirm}><Check size={14} />Confirm</Button>}
            <Button size="sm" variant="outline" onClick={onCorrect}><Pencil size={13} />Correct</Button>
          </div>
        ) : (
          <Tip content="Only the deal team can confirm or correct values" side="left"><span className="text-[12px] text-text-3">Read only</span></Tip>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Correct dialog
// ---------------------------------------------------------------------------

const input = "h-9 w-full rounded-[10px] border border-border-strong bg-surface px-3 outline-none focus:border-focus";

function CorrectDialog({ db, deal, field, onClose, onDone }: { db: DB; deal: Deal; field: ExtractedField; onClose: () => void; onDone: (f: ExtractedField) => void }) {
  const numeric = typeof field.value === "number";
  const docs = db.documents.filter((d) => d.dealId === deal.id && d.pages.length > 0);
  const [raw, setRaw] = useState("");
  const [docId, setDocId] = useState(field.documentId);
  const [page, setPage] = useState(field.page);
  const [touchedSource, setTouchedSource] = useState(false);
  const [note, setNote] = useState("");

  const value: number | string | null = numeric ? (raw.trim() === "" || Number.isNaN(Number(raw)) ? null : Number(raw)) : raw.trim() || null;
  const doc = docs.find((d) => d.id === docId);
  const pageText = doc?.pages.find((p) => p.n === page)?.markdown ?? "";
  const quote = value !== null ? findQuote(pageText, value) : undefined;

  /** Suggest the first page (outside the current source) that states the new value. */
  const onValue = (v: string) => {
    setRaw(v);
    if (touchedSource) return;
    const parsed = numeric ? Number(v) : v.trim();
    if (v.trim() === "" || (numeric && Number.isNaN(parsed))) return;
    for (const d of [...docs].sort((a, b) => Number(a.id === field.documentId) - Number(b.id === field.documentId))) {
      const p = d.pages.find((pg) => findQuote(pg.markdown, parsed));
      if (p) { setDocId(d.id); setPage(p.n); return; }
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === null) return;
    const before = snapshot(useDBStore.getState().db, deal.id);
    const r = correctField(field.id, value, docId, page, note);
    if (!r.ok) return toast.error(r.error);
    const after = snapshot(useDBStore.getState().db, deal.id);
    const changes = [
      before.lev !== after.lev && `Leverage ${fmtX(before.lev)} → ${fmtX(after.lev)}`,
      before.cushion !== after.cushion && `Cushion ${fmtPct(before.cushion)} → ${fmtPct(after.cushion)}`,
      after.stale > before.stale && `${after.stale - before.stale} memo section${after.stale - before.stale === 1 ? "" : "s"} now stale`,
    ].filter(Boolean);
    toast.success(`Corrected ${field.label}`, { description: changes.join(" · ") || undefined, duration: 7000 });
    onDone(field);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title={`Correct ${field.label}`}
      description={`Currently ${fmtFieldValue(field)} from ${sourceLabel(db, field.documentId, field.page)}. The original is kept in the history.`}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-[12px] text-text-3">Corrected value{field.unit === "usd_m" ? " ($M)" : field.unit === "pct" ? " (%)" : ""}</span>
          <input autoFocus className={input} inputMode={numeric ? "decimal" : "text"} value={raw} onChange={(e) => onValue(e.target.value)} placeholder={String(field.value)} />
        </label>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] text-text-3">Source document</span>
            <select className={input} value={docId} onChange={(e) => { setDocId(e.target.value); setPage(1); setTouchedSource(true); }}>
              {docs.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-text-3">Page</span>
            <select className={input} value={page} onChange={(e) => { setPage(Number(e.target.value)); setTouchedSource(true); }}>
              {doc?.pages.map((p) => <option key={p.n} value={p.n}>p.{p.n}</option>)}
            </select>
          </label>
        </div>
        {value !== null && (
          quote
            ? <div className="rounded-[10px] bg-success-soft px-3 py-2 text-[13px]"><span className="text-success">Found on {sourceLabel(db, docId, page)}:</span> <span className="font-serif">“{quote}”</span></div>
            : <div className="rounded-[10px] bg-warn-soft px-3 py-2 text-[13px] text-warn">This value doesn&apos;t appear on {sourceLabel(db, docId, page)}. Check the source before saving.</div>
        )}
        <label className="block">
          <span className="mb-1 block text-[12px] text-text-3">Note (optional)</span>
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. QoE excludes the unrealized pricing run-rate" />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={value === null || value === field.value}>Save correction</Button>
        </div>
      </form>
    </Dialog>
  );
}

function snapshot(db: DB, dealId: string) {
  const memoIds = new Set(db.memos.filter((m) => m.dealId === dealId).map((m) => m.id));
  return {
    lev: totalLeverage(db, dealId),
    cushion: cushionPct(db, dealId),
    stale: db.memoSections.filter((s) => memoIds.has(s.memoId) && sectionIsStale(db, s)).length,
  };
}

// ---------------------------------------------------------------------------
// Spreads: periods × cases, with leverage and covenant headroom
// ---------------------------------------------------------------------------

const CASE_ORDER = { actual: 0, sponsor: 1, lender_base: 2, downside: 3 } as const;
const CASE_LABEL = { actual: "Actual", sponsor: "Sponsor", lender_base: "Lender base", downside: "Downside" } as const;

function Spreads({ db, deal }: { db: DB; deal: Deal }) {
  const periods = db.financialPeriods
    .filter((p) => p.dealId === deal.id)
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd) || CASE_ORDER[a.case] - CASE_ORDER[b.case]);
  if (periods.length === 0) return null;

  const ts = activeTermSet(db, deal.id);
  const debt = fundedDebt(db, ts?.id);
  const cov = covenantFor(db, ts?.id);
  const guideline = db.settings.coverageCushionGuidelinePct / 100;
  const ltmEnd = periods.find((p) => p.periodType === "LTM")?.periodEnd ?? "";

  const cols = periods.map((p, i) => {
    const fv = p.adjEbitdaFieldKey ? fieldValue(db, deal.id, p.adjEbitdaFieldKey) : null;
    const ebitda = fv ? Number(fv.value) : p.adjEbitda;
    const prev = periods.slice(0, i).reverse().find((x) => x.case === "actual" && x.periodType === "FY");
    const forward = p.periodEnd >= ltmEnd && ebitda > 0;
    const lev = forward && debt ? debt / ebitda : null;
    const level = forward && cov ? currentCovenantLevel(cov, p.periodEnd) : null;
    return {
      p, ebitda, fv,
      growth: p.case === "actual" && prev && p.periodType === "FY" ? p.revenue / prev.revenue - 1 : null,
      margin: ebitda ? ebitda / p.revenue : null,
      capexPct: p.capex / p.revenue,
      coverage: p.interest && ebitda ? ebitda / p.interest : null,
      lev, level, cushion: lev !== null && level ? 1 - lev / level : null,
    };
  });

  type Col = (typeof cols)[number];
  const rows: { label: string; cell: (c: Col) => React.ReactNode; strong?: boolean; sub?: boolean }[] = [
    { label: "Revenue", cell: (c) => fmtUsdM(c.p.revenue), strong: true },
    { label: "Growth", cell: (c) => (c.growth === null ? "" : fmtPct(c.growth)), sub: true },
    {
      label: "Adjusted EBITDA", strong: true, cell: (c) => (
        <span className="inline-flex items-center gap-1.5">
          {c.fv?.field.status === "corrected" && <Chip tone="success" title={`Corrected from ${fmtUsdM(Number(c.fv.field.correctedFrom?.value))}`}>QoE</Chip>}
          {c.fv?.unconfirmed && <span title="Unconfirmed value" className="size-1.5 rounded-full bg-warn" />}
          {c.ebitda ? fmtUsdM(c.ebitda) : "—"}
        </span>
      ),
    },
    { label: "Margin", cell: (c) => fmtPct(c.margin), sub: true },
    { label: "Capex", cell: (c) => fmtUsdM(c.p.capex) },
    { label: "Capex % revenue", cell: (c) => fmtPct(c.capexPct), sub: true },
    { label: "Interest", cell: (c) => (c.p.interest ? fmtUsdM(c.p.interest) : "") },
    { label: "Interest coverage", cell: (c) => (c.coverage ? fmtX(c.coverage, 1) : ""), sub: true },
    { label: "Total leverage", strong: true, cell: (c) => (c.lev === null ? "" : fmtX(c.lev)) },
    { label: "Covenant level", cell: (c) => (c.level === null ? "" : fmtX(c.level)), sub: true },
    {
      label: "Covenant cushion", cell: (c) => c.cushion === null ? "" : (
        <span className={cn("font-medium", c.cushion < 0.1 ? "text-danger" : c.cushion < guideline ? "text-warn" : "text-success")}>{fmtPct(c.cushion)}</span>
      ),
    },
  ];

  return (
    <Section title="Spreads">
      <div className="overflow-x-auto rounded-[12px] border border-border bg-surface">
        <table className="w-full border-collapse text-[13px] tabular-nums">
          <thead className="border-b border-border text-[12px] text-text-3">
            <tr>
              <th className="px-3 py-2 text-left font-medium">($M)</th>
              {cols.map((c) => (
                <th key={c.p.id} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                  <div className="text-text">{c.p.label}</div>
                  <div className={cn("text-[11px]", c.p.case === "downside" ? "text-danger" : "")}>{CASE_LABEL[c.p.case]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-border last:border-b-0">
                <td className={cn("px-3 py-1.5 whitespace-nowrap", r.sub ? "pl-6 text-text-3" : r.strong ? "font-medium" : "")}>{r.label}</td>
                {cols.map((c) => <td key={c.p.id} className={cn("px-3 py-1.5 text-right whitespace-nowrap", r.sub && "text-text-3", r.strong && "font-medium")}>{r.cell(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-text-3">
        Leverage uses funded debt at close ({fmtUsdM(debt)}, term set v{ts?.version}) over each period&apos;s adjusted EBITDA; covenant levels are those in force at period end.
        The LTM column reads EBITDA from the reviewed value above, so a correction flows through here, the header and the memo.
      </p>
    </Section>
  );
}
