"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, AtSign, Building2, Check, ChevronDown, Copy, Kanban, Loader2, NotebookPen, User, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { create } from "zustand";
import type { ChatMessage, DB } from "@/lib/schema";
import { addChatMessage, createThread, type Scope } from "@/lib/chat";
import { addNote } from "@/lib/actions";
import { useCurrentUser, useDB, useDBStore } from "@/lib/store";
import { LiveUnavailable, getLiveStatus, runAgent } from "@/lib/llm/agent";
import { answerOffline } from "@/lib/llm/offline";
import { chatSystemPrompt } from "@/lib/llm/prompts";
import { renderMarkdown } from "@/lib/render/tokens";
import { Chip, cn } from "@/components/ui/primitives";
import { RichText } from "@/components/common/rich-text";
import { MentionPicker } from "@/components/common/mention-picker";

export const SUGGESTED = [
  "What leverage and spreads did we approve on services deals over $75M, and why did we pass on similar ones?",
  "Which active deals have unresolved red flags?",
  "Summarize what changed on Project Larch since screening IC.",
  "Who do we know at Ashby Hill, and what's our history with them?",
  "Find precedents for Project Larch and the questions IC asked.",
];

const BANNER_KEY = "covenant-offline-banner-dismissed";

/**
 * In-flight answers, keyed by thread. Kept outside the component because a
 * new thread changes the URL (and remounts this component) mid-answer.
 */
const usePending = create<{ pending: Record<string, { steps: string[]; live: boolean }> }>(() => ({ pending: {} }));
const setPending = (id: string, v: { steps: string[]; live: boolean } | null) =>
  usePending.setState((s) => {
    const next = { ...s.pending };
    if (v) next[id] = v; else delete next[id];
    return { pending: next };
  });
const pushStep = (id: string, step: string) =>
  usePending.setState((s) => (s.pending[id] ? { pending: { ...s.pending, [id]: { ...s.pending[id], steps: [...s.pending[id].steps, step] } } } : s));

function scopeName(db: DB, s: Scope) {
  if (s.type === "deal") return db.deals.find((d) => d.id === s.id)?.name ?? s.id;
  if (s.type === "company") return db.companies.find((c) => c.id === s.id)?.name ?? s.id;
  return db.people.find((p) => p.id === s.id)?.fullName ?? s.id;
}

/**
 * A conversation: messages, composer with @-mentions, and the live / offline
 * answering loop. Used by the Chat page and the deal-page panel.
 */
export function ChatConversation({
  threadId, defaultScope = [], onThreadCreated, compact, suggestions = SUGGESTED, greeting, initialPrompt,
}: {
  threadId?: string;
  initialPrompt?: string;
  defaultScope?: Scope[];
  onThreadCreated?: (id: string) => void;
  compact?: boolean;
  suggestions?: string[];
  greeting?: React.ReactNode;
}) {
  const db = useDB();
  const user = useCurrentUser();
  const thread = db.chatThreads.find((t) => t.id === threadId);
  const messages = db.chatMessages.filter((m) => m.threadId === threadId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const [scope, setScope] = useState<Scope[]>(thread?.scope ?? defaultScope);
  const [input, setInput] = useState("");
  const pending = usePending((s) => (threadId ? s.pending[threadId] : undefined));
  const busy = !!pending;
  const steps = pending?.steps ?? [];
  const [live, setLive] = useState<boolean | null>(null);
  const [bannerHidden, setBannerHidden] = useState(() => { try { return localStorage.getItem(BANNER_KEY) === "1"; } catch { return false; } });
  const [mentioning, setMentioning] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages.length, steps.length, busy]);

  async function send(text: string, liveOverride?: boolean) {
    const isLive = liveOverride ?? live;
    const prompt = text.trim();
    if (!prompt || busy || !user) return;
    let id = threadId;
    if (!id) {
      const deal = scope.find((s) => s.type === "deal");
      id = createThread(deal ? `${scopeName(db, deal).replace("Project ", "")}: ${prompt}` : prompt, scope);
    }
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const scopeNote = scope.length ? `\n\n(Scope: ${scope.map((s) => scopeName(db, s)).join(", ")})` : "";
    addChatMessage(id, { role: "user", content: prompt });
    setInput("");
    setPending(id, { steps: [], live: !!isLive });
    if (!threadId) onThreadCreated?.(id);

    const offline = async (reason?: string) => {
      const a = answerOffline(useDBStore.getState().db, prompt, scope);
      for (const c of a.toolCalls) { pushStep(id!, c.name); await new Promise((r) => setTimeout(r, 140)); }
      addChatMessage(id!, { role: "assistant", content: a.text, toolCalls: a.toolCalls, mode: "offline" });
      if (reason) toast(`Answered offline`, { description: reason });
    };

    try {
      if (isLive) {
        try {
          const r = await runAgent({
            db: () => useDBStore.getState().db,
            system: chatSystemPrompt(useDBStore.getState().db, user, scope),
            history,
            prompt: prompt + scopeNote,
            onStep: (s) => pushStep(id!, s.name),
          });
          addChatMessage(id, { role: "assistant", content: r.text || "_No answer returned._", toolCalls: r.toolCalls, mode: "live" });
        } catch (e) {
          if (!(e instanceof LiveUnavailable)) throw e;
          if (e.reason === "auth" || e.reason === "no_key") setLive(false);
          await offline(e.reason === "auth" ? "The API key was rejected; using offline mode." : `Live AI unavailable (${e.message}).`);
        }
      } else {
        await offline();
      }
    } finally {
      setPending(id, null);
    }
  }

  const started = useRef(false);
  useEffect(() => {
    getLiveStatus().then((s) => {
      setLive(s.configured);
      // A question handed over from the command palette is asked once, as soon as the mode is known.
      if (initialPrompt && !threadId && !started.current) { started.current = true; void send(initialPrompt, s.configured); }
    });
    // Runs once on mount; `send` reads the latest state when it's called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addScope = (p: Scope) => { const s = { type: p.type, id: p.id }; setScope((x) => (x.some((y) => y.id === s.id) ? x : [...x, s])); setMentioning(false); textarea.current?.focus(); };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className={cn("mx-auto max-w-[760px] px-5", compact ? "py-4" : "py-8")}>
          {live === false && !bannerHidden && (
            <div className="mb-5 flex items-start justify-between gap-3 rounded-[12px] border border-border bg-surface-2/60 px-3.5 py-2.5 text-[13px] text-text-2">
              <span><span className="font-medium text-text">Offline mode.</span> Answers are computed deterministically from the database. Add <code className="font-mono text-[12px]">ANTHROPIC_API_KEY</code> for live AI.</span>
              <button aria-label="Dismiss" onClick={() => { setBannerHidden(true); try { localStorage.setItem(BANNER_KEY, "1"); } catch {} }} className="text-text-3 hover:text-text"><X size={14} /></button>
            </div>
          )}

          {messages.length === 0 && !busy ? (
            <div className={compact ? "pt-2" : "pt-[8vh]"}>
              {greeting}
              <div className={cn("grid gap-2", !compact && "mt-8 sm:grid-cols-2")}>
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-[12px] border border-border bg-surface p-3 text-left text-[13px] text-text-2 transition-colors hover:border-border-strong hover:text-text">{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-7">
              {messages.map((m) => <MessageView key={m.id} db={db} m={m} scope={scope} />)}
              {busy && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[13px] text-text-3"><Loader2 size={14} className="animate-spin" />{pending?.live ? "Working with live AI…" : "Querying the database…"}</div>
                  {steps.map((s, i) => <div key={i} className="font-mono text-[12px] text-text-3">Calling {s}…</div>)}
                </div>
              )}
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>

      <div className={cn("mx-auto w-full max-w-[760px]", compact ? "px-3 pb-3" : "px-5 pb-6")}>
        <div className="relative rounded-[20px] border border-border bg-surface p-3 shadow-composer">
          {mentioning && <MentionPicker db={db} onPick={addScope} onClose={() => setMentioning(false)} />}
          {scope.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {scope.map((s) => (
                <Chip key={s.id} tone="accent">
                  {s.type === "deal" ? <Kanban size={11} /> : s.type === "company" ? <Building2 size={11} /> : <User size={11} />}
                  {scopeName(db, s)}
                  <button aria-label={`Remove ${scopeName(db, s)}`} onClick={() => setScope((x) => x.filter((y) => y.id !== s.id))}><X size={11} /></button>
                </Chip>
              ))}
            </div>
          )}
          <textarea
            ref={textarea}
            rows={compact ? 2 : 2}
            value={input}
            onChange={(e) => {
              const v = e.target.value;
              if (v.endsWith("@") && !input.endsWith("@")) { setMentioning(true); setInput(v.slice(0, -1)); return; }
              setInput(v);
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={scope.length ? `Ask about ${scope.map((s) => scopeName(db, s)).join(", ")}…` : "Ask about deals, companies or people. Type @ to scope."}
            className="max-h-[200px] min-h-[44px] w-full resize-none bg-transparent px-1 leading-relaxed outline-none placeholder:text-text-3"
            style={{ height: "auto" }}
            onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = `${Math.min(t.scrollHeight, 200)}px`; }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setMentioning((v) => !v)} className="flex items-center gap-1 rounded-[8px] px-2 py-1 text-[13px] text-text-3 hover:bg-surface-2 hover:text-text"><AtSign size={14} />Mention</button>
              <span className="flex items-center gap-1 text-[11px] text-text-3">{live ? <><Zap size={11} className="text-accent" />Live</> : live === false ? "Offline" : ""}</span>
            </div>
            <button onClick={() => send(input)} disabled={!input.trim() || busy} aria-label="Send" className="flex size-8 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function MessageView({ db, m, scope }: { db: DB; m: ChatMessage; scope: Scope[] }) {
  const [showQueries, setShowQueries] = useState(false);
  const deal = scope.find((s) => s.type === "deal");
  if (m.role === "user") {
    return <div className="flex justify-end"><div className="max-w-[85%] rounded-[18px] bg-surface-2 px-4 py-2.5 whitespace-pre-wrap">{m.content}</div></div>;
  }
  const copy = async () => { try { await navigator.clipboard.writeText(renderMarkdown(db, undefined, m.content)); toast.success("Copied"); } catch { toast.error("Clipboard not available"); } };
  const save = () => {
    if (!deal) return;
    const r = addNote({ type: "deal", id: deal.id }, `**From chat:** ${renderMarkdown(db, undefined, m.content)}`, "general");
    if (!r.ok) toast.error(r.error); else toast.success(`Saved to ${scopeName(db, deal)} notes`);
  };
  return (
    <div className="space-y-2.5">
      <RichText db={db} content={m.content} />
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-text-3">
        <Chip tone={m.mode === "live" ? "accent" : "outline"}>{m.mode === "live" ? <><Zap size={10} />Live</> : "Offline"}</Chip>
        {m.toolCalls && m.toolCalls.length > 0 && (
          <button onClick={() => setShowQueries((v) => !v)} className="flex items-center gap-1 rounded-[8px] px-1.5 py-0.5 hover:bg-surface-2 hover:text-text">
            <ChevronDown size={12} className={cn("transition-transform", showQueries && "rotate-180")} />Show queries ({m.toolCalls.length})
          </button>
        )}
        <button onClick={copy} className="flex items-center gap-1 rounded-[8px] px-1.5 py-0.5 hover:bg-surface-2 hover:text-text"><Copy size={12} />Copy</button>
        {deal && <button onClick={save} className="flex items-center gap-1 rounded-[8px] px-1.5 py-0.5 hover:bg-surface-2 hover:text-text"><NotebookPen size={12} />Save to deal notes</button>}
      </div>
      {showQueries && m.toolCalls && (
        <ol className="space-y-1.5 rounded-[12px] border border-border bg-surface-2/40 p-3 font-mono text-[11.5px]">
          {m.toolCalls.map((t, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-text">{i + 1}. {t.name}</span>
              <span className="text-text-3">{JSON.stringify(t.input)}</span>
              <span className="ml-auto flex items-center gap-1 text-text-2"><Check size={11} className="text-success" />{t.resultSummary}</span>
            </li>
          ))}
          <li className="pt-1 font-sans text-[11px] text-text-3">Each call is a typed query over the database; in production the same tools are served over MCP from Postgres.</li>
        </ol>
      )}
    </div>
  );
}
