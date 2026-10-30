"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useCurrentUser, useDB } from "@/lib/store";
import { deleteThread, renameThread } from "@/lib/client/actions";
import { fmtDateShort } from "@/lib/format";
import { cn } from "@/components/ui/primitives";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { ChatConversation } from "./chat-conversation";

function greeting(name: string) {
  const h = new Date().getHours();
  return `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, ${name.split(" ")[0]}`;
}

export function ChatView({ threadId, initialPrompt }: { threadId?: string; initialPrompt?: string }) {
  const db = useDB();
  const user = useCurrentUser();
  const router = useRouter();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const threads = [...db.chatThreads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="p-3">
          <Link href="/chat" className="flex h-9 items-center gap-2 rounded-[8px] px-3 text-[14px] text-text-2 hover:bg-surface-2 hover:text-text">
            <MessageSquarePlus size={16} />New chat
          </Link>
        </div>
        <div className="px-4 pb-1 text-[12px] text-text-3">Recent</div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {threads.map((t) => (
            <div key={t.id} className={cn("group flex items-center rounded-[8px]", t.id === threadId ? "bg-surface-2" : "hover:bg-surface-2/70")}>
              {renaming === t.id ? (
                <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => { renameThread(t.id, title); setRenaming(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { renameThread(t.id, title); setRenaming(null); } if (e.key === "Escape") setRenaming(null); }}
                  className="m-1 h-7 flex-1 rounded-[6px] border border-border-strong bg-surface px-2 text-[13px] outline-none" />
              ) : (
                <Link href={`/chat/${t.id}`} className={cn("min-w-0 flex-1 px-3 py-2 text-[13px]", t.id === threadId ? "font-medium" : "text-text-2 group-hover:text-text")}>
                  <span className="block truncate">{t.title}</span>
                  <span className="block text-[11px] font-normal text-text-3">{fmtDateShort(t.createdAt)}</span>
                </Link>
              )}
              <Menu>
                <MenuTrigger asChild>
                  <button aria-label="Thread actions" className="mr-1 rounded p-1 text-text-3 opacity-0 group-hover:opacity-100 hover:text-text data-[state=open]:opacity-100"><MoreHorizontal size={15} /></button>
                </MenuTrigger>
                <MenuContent align="end">
                  <MenuItem onSelect={() => { setTitle(t.title); setRenaming(t.id); }}><Pencil size={14} />Rename</MenuItem>
                  <MenuItem onSelect={() => { deleteThread(t.id); if (t.id === threadId) router.push("/chat"); }}><Trash2 size={14} />Delete</MenuItem>
                </MenuContent>
              </Menu>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <ChatConversation
          key={threadId ?? "new"}
          threadId={threadId}
          initialPrompt={initialPrompt}
          onThreadCreated={(id) => router.replace(`/chat/${id}`)}
          greeting={
            <>
              <h1 className="text-center font-serif text-[34px] font-medium">{greeting(user?.name ?? "")}</h1>
              <p className="mt-2 text-center text-text-2">Ask about Fernhill&apos;s deals, companies and people. Answers come from the database, with sources.</p>
            </>
          }
        />
      </div>
    </div>
  );
}
