"use client";

import type { AuditEvent, DB, Note } from "@/lib/schema";
import { userById } from "@/lib/selectors";
import { fmtDateTime, titleCase } from "@/lib/format";
import { Avatar, Chip } from "@/components/ui/primitives";
import { Markdown } from "./markdown";

export function AuditList({ db, events, empty = "No activity yet." }: { db: DB; events: AuditEvent[]; empty?: string }) {
  if (events.length === 0) return <p className="text-text-3">{empty}</p>;
  return (
    <ol className="space-y-0">
      {events.map((e) => {
        const actor = userById(db, e.actorId);
        return (
          <li key={e.id} className="flex gap-3 border-b border-border py-2.5 last:border-b-0">
            <Avatar initials={actor?.initials ?? "?"} title={actor?.name} size={24} />
            <div className="min-w-0 flex-1">
              <div>{e.summary}</div>
              {(e.before || e.after) && e.field && (
                <div className="mt-0.5 font-mono text-[12px] text-text-3">
                  {e.field}: {e.before ?? "—"} → {e.after ?? "—"}
                </div>
              )}
              <div className="text-[12px] text-text-3">{actor?.name} · {fmtDateTime(e.at)}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function NoteList({ db, notes, empty = "No notes yet." }: { db: DB; notes: Note[]; empty?: string }) {
  if (notes.length === 0) return <p className="text-text-3">{empty}</p>;
  const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="space-y-3">
      {sorted.map((n) => {
        const author = userById(db, n.authorId);
        return (
          <article key={n.id} className="rounded-[12px] border border-border bg-surface p-4">
            <div className="mb-2 flex items-center gap-2 text-[12px] text-text-3">
              <Avatar initials={author?.initials ?? "?"} size={22} />
              <span className="text-text-2">{author?.name}</span>
              <span>· {fmtDateTime(n.createdAt)}</span>
              <Chip tone="outline">{titleCase(n.noteType)}</Chip>
              {n.pinned && <Chip tone="accent">Pinned</Chip>}
            </div>
            <Markdown className="text-[15px]">{n.body}</Markdown>
          </article>
        );
      })}
    </div>
  );
}

export type FeedItem = { at: string; actorId: string; title: React.ReactNode; body?: string; href?: string; tag: string };

/** A mixed activity feed (notes, deal events, roles), newest first. */
export function ActivityFeed({ db, items, empty = "No activity yet." }: { db: DB; items: FeedItem[]; empty?: string }) {
  if (items.length === 0) return <p className="text-text-3">{empty}</p>;
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {sorted.map((it, i) => {
        const actor = userById(db, it.actorId);
        return (
          <li key={i} className="relative">
            <span className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-border-strong" />
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-3">
              <Chip tone="outline">{it.tag}</Chip>{fmtDateTime(it.at)}{actor && <> · {actor.name}</>}
            </div>
            <div className="mt-0.5">{it.href ? <a href={it.href} className="hover:text-accent">{it.title}</a> : it.title}</div>
            {it.body && <Markdown className="mt-1 text-[14px] text-text-2">{it.body}</Markdown>}
          </li>
        );
      })}
    </ol>
  );
}
