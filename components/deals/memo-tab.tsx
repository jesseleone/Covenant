"use client";

import { useState } from "react";
import { Check, ClipboardCopy, Database, Loader2, Pencil, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { DB, Deal, Memo, MemoSection } from "@/lib/schema";
import { markMemoReady, markSectionReviewed, regenerateSections, updateSectionContent } from "@/lib/actions";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/store";
import { activeTermSet, sectionIsStale, serializeDependency, userById } from "@/lib/selectors";
import { depDisplay, depLabel, queriesFor, staleReasons, typedFigures } from "@/lib/memo";
import { LiveUnavailable, getLiveStatus, runAgent } from "@/lib/llm/agent";
import { memoSystemPrompt } from "@/lib/llm/prompts";
import { useDBStore } from "@/lib/store";
import { renderMarkdown, segment } from "@/lib/render/tokens";
import { fmtDateShort, titleCase } from "@/lib/format";
import { Button, Card, Chip, EmptyState, cn } from "@/components/ui/primitives";
import { Tip } from "@/components/ui/menu";
import { RichText } from "@/components/common/rich-text";

export function MemoTab({ db, deal }: { db: DB; deal: Deal }) {
  const memos = db.memos.filter((m) => m.dealId === deal.id).sort((a, b) => b.version - a.version);
  const [memoId, setMemoId] = useState(memos.find((m) => m.memoType === "final")?.id ?? memos[0]?.id);
  const memo = memos.find((m) => m.id === memoId);
  if (!memo) return <EmptyState title="No memo yet">Generate a screening memo once the deal has confirmed financials and a term set.</EmptyState>;
  return <MemoView key={memo.id} db={db} deal={deal} memo={memo} memos={memos} onSelect={setMemoId} />;
}

function MemoView({ db, deal, memo, memos, onSelect }: { db: DB; deal: Deal; memo: Memo; memos: Memo[]; onSelect: (id: string) => void }) {
  const user = useCurrentUser();
  const canEdit = !!user && can(user.role, "edit_memo");
  const canReady = !!user && can(user.role, "mark_memo_ready");
  const sections = db.memoSections.filter((s) => s.memoId === memo.id).sort((a, b) => a.order - b.order);
  const stale = sections.filter((s) => sectionIsStale(db, s));
  const reviewed = sections.filter((s) => s.reviewedBy);
  const ts = db.termSets.find((t) => t.id === memo.termSetId);
  const active = activeTermSet(db, deal.id);
  const [busy, setBusy] = useState<string[]>([]);

  const regenerate = async (ids: string[]) => {
    setBusy(ids);
    const { configured } = await getLiveStatus();
    const contentById: Record<string, string> = {};
    let fallbackNote = "";
    if (configured) {
      for (const id of ids) {
        const section = sections.find((s) => s.id === id)!;
        try {
          contentById[id] = await regenerateLive(deal, section);
        } catch (e) {
          fallbackNote = e instanceof LiveUnavailable ? `Live AI unavailable (${e.message}); used offline text.` : e instanceof Error ? e.message : "Live regeneration failed.";
          if (e instanceof LiveUnavailable) break;
        }
      }
    } else {
      // A short pause so the offline rebuild reads as work being done.
      await new Promise((r) => setTimeout(r, 700));
    }
    const r = regenerateSections(ids, Object.keys(contentById).length ? contentById : undefined);
    setBusy([]);
    if (!r.ok) return toast.error(r.error);
    const liveCount = Object.keys(contentById).length;
    toast.success(`Regenerated ${ids.length} section${ids.length === 1 ? "" : "s"}`, {
      description: liveCount === ids.length ? "Written by Claude from the current records. Review before marking ready."
        : fallbackNote || "Offline mode: rebuilt from the current records. Review before marking ready.",
    });
  };

  const readyBlocker = stale.length ? `${stale.length} stale section${stale.length === 1 ? "" : "s"}` : reviewed.length < sections.length ? `${sections.length - reviewed.length} section${sections.length - reviewed.length === 1 ? "" : "s"} not reviewed` : null;
  const onReady = () => {
    const r = markMemoReady(memo.id);
    if (!r.ok) return toast.error(r.error);
    toast.success("Memo marked ready for IC", { description: "The IC gate's memo requirement is now met." });
  };
  const copy = async () => {
    const md = [`# ${deal.name}: ${titleCase(memo.memoType)} IC memo (v${memo.version})`, ...sections.map((s) => `## ${s.title}\n\n${renderMarkdown(db, deal.id, s.content)}`)].join("\n\n");
    try { await navigator.clipboard.writeText(md); toast.success("Copied as Markdown"); } catch { toast.error("Clipboard not available"); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {memos.length > 1 ? (
            <select value={memo.id} onChange={(e) => onSelect(e.target.value)} className="h-8 rounded-[8px] border border-border-strong bg-surface px-2 font-serif text-[16px]">
              {memos.map((m) => <option key={m.id} value={m.id}>{titleCase(m.memoType)} memo · v{m.version}</option>)}
            </select>
          ) : <span className="font-serif text-[18px]">{titleCase(memo.memoType)} memo · v{memo.version}</span>}
          <Chip tone={memo.status === "ready_for_ic" ? "success" : memo.status === "final" ? "accent" : "neutral"}>{memo.status === "ready_for_ic" ? "Ready for IC" : titleCase(memo.status)}</Chip>
          <Chip tone={ts && active && ts.id !== active.id ? "warn" : "outline"} title={ts && active && ts.id !== active.id ? `Terms are now on v${active.version}` : undefined}>
            Term set v{ts?.version}{ts && active && ts.id !== active.id ? ` · v${active.version} now active` : ""}
          </Chip>
          <span className="text-[12px] text-text-3">{reviewed.length} of {sections.length} reviewed{stale.length ? ` · ${stale.length} stale` : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={copy}><ClipboardCopy size={14} />Copy as Markdown</Button>
          {canEdit && stale.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => regenerate(stale.map((s) => s.id))} disabled={busy.length > 0}>
              {busy.length > 1 ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Regenerate stale ({stale.length})
            </Button>
          )}
          {memo.status !== "ready_for_ic" && (
            canReady && !readyBlocker
              ? <Button size="sm" variant="primary" onClick={onReady}><Check size={14} />Mark ready for IC</Button>
              : <Tip side="bottom" content={!canReady ? "Only a VP or MD can mark the memo ready for IC" : `Blocked: ${readyBlocker}`}><span><Button size="sm" variant="primary" disabled><Check size={14} />Mark ready for IC</Button></span></Tip>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="hidden lg:block" aria-label="Memo sections">
          <ol className="sticky top-4 space-y-0.5">
            {sections.map((s) => {
              const isStale = sectionIsStale(db, s);
              return (
                <li key={s.id}>
                  <a href={`#${s.key}`} className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[13px] text-text-2 hover:bg-surface-2 hover:text-text">
                    <span className={cn("size-1.5 shrink-0 rounded-full", isStale ? "bg-warn" : s.reviewedBy ? "bg-success" : "bg-border-strong")} />
                    <span className="truncate">{s.title}</span>
                  </a>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 space-y-1 px-2 text-[11px] text-text-3">
            <div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-success" />Reviewed</div>
            <div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-warn" />Stale</div>
            <div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-border-strong" />Not reviewed</div>
          </div>
        </nav>

        <Card className="min-w-0 px-6 py-6 sm:px-10 sm:py-8">
          <div className="mb-8 border-b border-border pb-5">
            <div className="text-[12px] text-text-3">Fernhill Credit Partners · Investment Committee</div>
            <h2 className="mt-1 font-serif text-[26px] font-medium">{deal.name}: {titleCase(memo.memoType)} credit memo</h2>
            <p className="mt-1 text-[13px] text-text-3">Numbers are live: hover a value for its source, click to open it. Citation chips open the cited page.</p>
          </div>
          <div className="space-y-10">
            {sections.map((s) => <SectionView key={s.id} db={db} deal={deal} s={s} canEdit={canEdit} busy={busy.includes(s.id)} onRegenerate={() => regenerate([s.id])} />)}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SectionView({ db, deal, s, canEdit, busy, onRegenerate }: { db: DB; deal: Deal; s: MemoSection; canEdit: boolean; busy: boolean; onRegenerate: () => void }) {
  const [showData, setShowData] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const reasons = staleReasons(db, s);
  const stale = reasons.length > 0;
  const reviewer = userById(db, s.reviewedBy);

  const review = () => { const r = markSectionReviewed(s.id); if (!r.ok) toast.error(r.error); else toast.success(`Reviewed ${s.title}`); };
  const save = () => { const r = updateSectionContent(s.id, draft!); if (!r.ok) return toast.error(r.error); setDraft(null); toast.success(`Saved ${s.title}`); };

  return (
    <section id={s.key} className="scroll-mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-serif text-[21px] font-medium">{s.title}</h3>
          <Chip tone="outline" title={`Last written ${fmtDateShort(s.updatedAt)}`}>{s.generatedBy === "human" ? "Human" : s.generatedBy === "ai" ? "AI" : "AI · offline"}</Chip>
          {stale && <Chip tone="warn"><TriangleAlert size={11} />Stale</Chip>}
          {reviewer ? <Chip tone="success"><Check size={11} />{reviewer.name}</Chip> : <Chip>Not reviewed</Chip>}
        </div>
        <div className="flex items-center gap-1">
          <ActionBtn onClick={() => setShowData((v) => !v)} active={showData}><Database size={13} />Show the data</ActionBtn>
          {canEdit && <ActionBtn onClick={onRegenerate} disabled={busy}>{busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}Regenerate</ActionBtn>}
          {canEdit && draft === null && <ActionBtn onClick={() => setDraft(s.content)}><Pencil size={13} />Edit</ActionBtn>}
          {canEdit && !reviewer && <ActionBtn onClick={review} disabled={stale} title={stale ? "Regenerate or edit first" : undefined}><Check size={13} />Mark reviewed</ActionBtn>}
        </div>
      </div>

      {stale && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-warn/30 bg-warn-soft/60 px-3 py-2 text-[13px]">
          <div>
            <div className="font-medium text-warn">Written against older data</div>
            <ul className="mt-0.5 space-y-0.5 text-text-2">
              {reasons.map((r) => <li key={r.dep}>{r.label}: <span className="line-through opacity-70">{r.before}</span> → <span className="font-medium text-text">{r.after}</span></li>)}
            </ul>
          </div>
          {canEdit && <Button size="sm" variant="outline" onClick={onRegenerate} disabled={busy}><RefreshCw size={13} />Regenerate</Button>}
        </div>
      )}

      {showData && <DataDrawer db={db} deal={deal} s={s} />}

      <div className={cn("transition-opacity", busy && "animate-pulse opacity-40")}>
        {draft === null ? (
          <RichText db={db} dealId={deal.id} content={s.content} />
        ) : (
          <div className="space-y-2">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={Math.min(22, draft.split("\n").length + 3)}
              className="w-full rounded-[12px] border border-border-strong bg-surface px-3 py-2 font-mono text-[12.5px] leading-relaxed outline-none focus:border-focus" />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-text-3">Keep <code className="font-mono">{"{{…}}"}</code> tokens for numbers so they stay live; <code className="font-mono">[[cite:…]]</code> adds a citation.</span>
              <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button><Button size="sm" variant="primary" onClick={save}>Save</Button></div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ActionBtn({ children, onClick, disabled, active, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={cn("flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-[12px] transition-colors disabled:opacity-40", active ? "bg-surface-2 text-text" : "text-text-3 hover:bg-surface-2 hover:text-text")}>
      {children}
    </button>
  );
}

/** What the section was written from: dependencies (then vs now), records cited, and the queries behind it. */
function DataDrawer({ db, deal, s }: { db: DB; deal: Deal; s: MemoSection }) {
  const segs = segment(db, deal.id, s.content);
  const records = new Map<string, { label: string; source: string }>();
  for (const x of segs) {
    if (x.kind === "token" && x.resolved.cite) records.set(x.token, { label: x.resolved.label ?? x.token, source: x.resolved.cite.label });
    if (x.kind === "cite") records.set(x.target, { label: x.cite.label, source: x.target.split(":")[0].replace("_", " ") });
  }
  return (
    <div className="mb-4 grid gap-4 rounded-[12px] border border-border bg-surface-2/40 p-4 text-[12.5px] md:grid-cols-3">
      <div className="md:col-span-3">
        <div className="mb-1.5 text-[12px] font-medium text-text-2">Dependencies</div>
        <table className="w-full tabular-nums">
          <thead className="text-[11px] text-text-3"><tr><th className="py-1 text-left font-medium">Input</th><th className="py-1 text-right font-medium">When written</th><th className="py-1 text-right font-medium">Now</th></tr></thead>
          <tbody>
            {s.dependencies.map((d) => {
              const now = serializeDependency(db, deal.id, d);
              const changed = now !== s.snapshot[d];
              return (
                <tr key={d} className="border-t border-border">
                  <td className="py-1">{depLabel(db, deal.id, d)} <span className="font-mono text-[11px] text-text-3">{d}</span></td>
                  <td className="py-1 text-right text-text-2">{depDisplay(db, deal.id, d, s.snapshot[d])}</td>
                  <td className={cn("py-1 text-right", changed && "font-medium text-warn")}>{depDisplay(db, deal.id, d, now)}{changed && " ●"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="md:col-span-2">
        <div className="mb-1.5 text-[12px] font-medium text-text-2">Records cited ({records.size})</div>
        <ul className="space-y-0.5">
          {[...records.values()].map((r) => <li key={r.label + r.source} className="flex justify-between gap-3"><span className="truncate">{r.label}</span><span className="shrink-0 font-mono text-[11px] text-text-3">{r.source}</span></li>)}
        </ul>
      </div>
      <div>
        <div className="mb-1.5 text-[12px] font-medium text-text-2">Queries a regeneration runs</div>
        <ul className="space-y-0.5 font-mono text-[11px] text-text-2">{queriesFor(s, deal.id).map((q) => <li key={q}>{q}</li>)}</ul>
      </div>
    </div>
  );
}

/**
 * Ask Claude to rewrite one section from current records. Typed figures are
 * sent back once for correction; a second failure raises so the offline
 * text is used instead.
 */
async function regenerateLive(deal: Deal, section: MemoSection): Promise<string> {
  const db = () => useDBStore.getState().db;
  const reasons = staleReasons(db(), section).map((r) => `${r.label}: ${r.before} -> ${r.after}`);
  const prompt = `Current text of the section:\n\n${section.content}\n\n${reasons.length ? `These inputs changed since it was written: ${reasons.join("; ")}.` : "Refresh it against the current records."} Rewrite the section.`;
  const system = memoSystemPrompt(db(), deal.id, section);
  const first = await runAgent({ db, system, history: [], prompt });
  const bad = typedFigures(first.text);
  if (!bad.length && first.text) return first.text;
  const second = await runAgent({
    db, system, history: [{ role: "user", content: prompt }, { role: "assistant", content: first.text }],
    prompt: `These figures are typed as text: ${bad.join(", ")}. Replace each with the matching token and return the full section again.`,
  });
  if (typedFigures(second.text).length || !second.text) throw new Error(`${section.title}: the AI draft typed figures instead of tokens; used offline text.`);
  return second.text;
}
