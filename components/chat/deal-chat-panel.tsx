"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog as RDialog } from "radix-ui";
import { ExternalLink, MessageSquarePlus, X } from "lucide-react";
import type { Deal } from "@/lib/schema";
import { useCurrentUser, useDB } from "@/lib/store";
import { ChatConversation } from "./chat-conversation";

const dealPrompts = (codename: string) => [
  `What are the biggest open risks on ${codename}, and how are they mitigated?`,
  `Find precedents for ${codename} and the questions IC asked.`,
  `Summarize what changed on ${codename} since screening IC.`,
  `How does ${codename}'s leverage and pricing compare with deals we closed?`,
];

/** Side panel on the deal page: a chat scoped to this deal. */
export function DealChatPanel({ deal, open, onOpenChange }: { deal: Deal; open: boolean; onOpenChange: (v: boolean) => void }) {
  const db = useDB();
  const user = useCurrentUser();
  // Resume the latest thread this user started on this deal, if any.
  const latest = [...db.chatThreads]
    .filter((t) => t.ownerId === user?.id && t.scope?.some((s) => s.type === "deal" && s.id === deal.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const [threadId, setThreadId] = useState<string | undefined>(latest?.id);
  const [fresh, setFresh] = useState(0);

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <RDialog.Portal>
        <RDialog.Content
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed top-0 right-0 bottom-0 z-40 flex w-[min(460px,100vw)] flex-col border-l border-border bg-bg shadow-pop"
        >
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
            <div className="min-w-0">
              <RDialog.Title className="truncate font-serif text-[17px]">Ask about {deal.name}</RDialog.Title>
              <RDialog.Description className="text-[12px] text-text-3">Answers from Covenant&apos;s records, scoped to this deal</RDialog.Description>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setThreadId(undefined); setFresh((n) => n + 1); }} className="rounded-[8px] p-1.5 text-text-3 hover:bg-surface-2 hover:text-text" aria-label="New conversation" title="New conversation"><MessageSquarePlus size={16} /></button>
              {threadId && <Link href={`/chat/${threadId}`} className="rounded-[8px] p-1.5 text-text-3 hover:bg-surface-2 hover:text-text" aria-label="Open in Chat" title="Open in Chat"><ExternalLink size={16} /></Link>}
              <RDialog.Close className="rounded-[8px] p-1.5 text-text-3 hover:bg-surface-2 hover:text-text" aria-label="Close"><X size={16} /></RDialog.Close>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <ChatConversation
              key={`${threadId ?? "new"}-${fresh}`}
              threadId={threadId}
              compact
              defaultScope={[{ type: "deal", id: deal.id }]}
              onThreadCreated={setThreadId}
              suggestions={dealPrompts(deal.codename)}
            />
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
