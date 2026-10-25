"use client";

import Link from "next/link";
import { ArrowUp, AtSign, MessageSquarePlus } from "lucide-react";
import { useCurrentUser, useDB } from "@/lib/store";
import { renderMarkdown } from "@/lib/render/tokens";
import { fmtDateShort } from "@/lib/format";
import { Chip, cn } from "@/components/ui/primitives";
import { Markdown } from "@/components/common/markdown";

const SUGGESTED = [
  "What leverage and spreads did we approve on services deals over $75M, and why did we pass on similar ones?",
  "Which active deals have unresolved red flags?",
  "Summarize what changed on Project Larch since screening IC.",
  "Who do we know at Ashby Hill, and what's our history with them?",
  "Find precedents for Project Larch and the questions IC asked.",
];

function greeting(name: string) {
  const h = new Date().getHours();
  return `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, ${name.split(" ")[0]}`;
}

export function ChatView({ threadId }: { threadId?: string }) {
  const db = useDB();
  const user = useCurrentUser();
  const threads = [...db.chatThreads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const messages = db.chatMessages.filter((m) => m.threadId === threadId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="p-3">
          <Link href="/chat" className="flex h-9 items-center gap-2 rounded-[8px] px-3 text-[14px] text-text-2 hover:bg-surface-2 hover:text-text">
            <MessageSquarePlus size={16} />New chat
          </Link>
        </div>
        <div className="px-4 pb-1 text-[12px] text-text-3">Recent</div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {threads.map((t) => (
            <Link key={t.id} href={`/chat/${t.id}`}
              className={cn("block truncate rounded-[8px] px-3 py-2 text-[13px]", t.id === threadId ? "bg-surface-2 font-medium" : "text-text-2 hover:bg-surface-2/70 hover:text-text")}>
              {t.title}
              <span className="block text-[11px] font-normal text-text-3">{fmtDateShort(t.createdAt)}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[760px] px-6 py-8">
            {!threadId ? (
              <div className="pt-[12vh]">
                <h1 className="text-center font-serif text-[34px] font-medium">{greeting(user?.name ?? "")}</h1>
                <p className="mt-2 text-center text-text-2">Ask anything about Fernhill&apos;s deals, companies and people. Answers come from the database, with sources.</p>
                <div className="mt-8 grid gap-2 sm:grid-cols-2">
                  {SUGGESTED.map((s) => (
                    <div key={s} className="rounded-[12px] border border-border bg-surface p-3 text-[13px] text-text-2">{s}</div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {messages.map((m) => m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-[18px] bg-surface-2 px-4 py-2.5">{m.content}</div>
                  </div>
                ) : (
                  <div key={m.id} className="space-y-2">
                    <Markdown>{renderMarkdown(db, undefined, m.content)}</Markdown>
                    <div className="flex items-center gap-2 text-[12px] text-text-3">
                      <Chip tone="outline">{m.mode === "live" ? "Live" : "Offline"}</Chip>
                      {m.toolCalls && <span className="font-mono">{m.toolCalls.map((t) => t.name).join(" · ")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[760px] px-6 pb-6">
          <div className="rounded-[20px] border border-border bg-surface p-3 shadow-composer">
            <textarea disabled rows={2} placeholder="Chat with the database arrives in a later build step…" className="w-full resize-none bg-transparent px-1 outline-none placeholder:text-text-3" />
            <div className="flex items-center justify-between">
              <button disabled className="flex items-center gap-1 rounded-[8px] px-2 py-1 text-[13px] text-text-3"><AtSign size={14} />Mention</button>
              <button disabled aria-label="Send" className="flex size-8 items-center justify-center rounded-full bg-accent text-white opacity-50"><ArrowUp size={16} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
