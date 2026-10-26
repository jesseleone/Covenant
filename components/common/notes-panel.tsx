"use client";

import { useState } from "react";
import { AtSign, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { NOTE_TYPES, NOTE_LABELS, type DB, type EntityType, type Note } from "@/lib/schema";
import { addNote, toggleNotePin } from "@/lib/actions";
import { can } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/store";
import { userById } from "@/lib/selectors";
import { fmtDateTime } from "@/lib/format";
import { Avatar, Button, Chip, cn } from "@/components/ui/primitives";
import { Markdown } from "./markdown";
import { MentionPicker } from "./mention-picker";

const hrefFor = (type: EntityType, id: string) => (type === "deal" ? `/deals/${id}/overview` : type === "company" ? `/companies/${id}/overview` : `/people/${id}/overview`);

function nameOf(db: DB, type: EntityType, id: string) {
  if (type === "deal") return db.deals.find((d) => d.id === id)?.name;
  if (type === "company") return db.companies.find((c) => c.id === id)?.name;
  return db.people.find((p) => p.id === id)?.fullName;
}

/** Turn "@Name" for each mentioned record into a link. */
export function linkMentions(db: DB, note: Note) {
  let body = note.body;
  for (const m of note.mentions) {
    const name = nameOf(db, m.type, m.id);
    if (name && body.includes(`@${name}`)) body = body.split(`@${name}`).join(`[@${name}](${hrefFor(m.type, m.id)})`);
  }
  return body;
}

export function NotesPanel({ db, subject, notes, empty = "No notes yet." }: { db: DB; subject: { type: EntityType; id: string }; notes: Note[]; empty?: string }) {
  const user = useCurrentUser();
  const canWrite = !!user && can(user.role, "add_note");
  const [body, setBody] = useState("");
  const [type, setType] = useState<Note["noteType"]>(subject.type === "deal" ? "meeting" : "general");
  const [pinned, setPinned] = useState(false);
  const [mentions, setMentions] = useState<Note["mentions"]>([]);
  const [picking, setPicking] = useState(false);

  const save = () => {
    const used = mentions.filter((m) => body.includes(`@${nameOf(db, m.type, m.id)}`));
    const r = addNote(subject, body, type, used, pinned);
    if (!r.ok) return toast.error(r.error);
    setBody(""); setMentions([]); setPinned(false);
    toast.success("Note added");
  };
  const sorted = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="relative rounded-[12px] border border-border bg-surface p-3">
          {picking && (
            <MentionPicker db={db} className="top-full bottom-auto mt-1 mb-0" onClose={() => setPicking(false)}
              onPick={(p) => { setBody((b) => `${b.replace(/@$/, "")}@${p.name} `); setMentions((m) => [...m, { type: p.type, id: p.id }]); setPicking(false); }} />
          )}
          <textarea rows={3} value={body} placeholder="Meeting notes, call takeaways, screening thoughts… Type @ to mention a deal, company or person."
            onChange={(e) => { const v = e.target.value; if (v.endsWith("@") && !body.endsWith("@")) setPicking(true); setBody(v); }}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }}
            className="w-full resize-none bg-transparent px-1 outline-none placeholder:text-text-3" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={() => setPicking(true)} className="flex items-center gap-1 rounded-[8px] px-2 py-1 text-[12px] text-text-3 hover:bg-surface-2 hover:text-text"><AtSign size={13} />Mention</button>
              {NOTE_TYPES.map((t) => (
                <button key={t} onClick={() => setType(t)} className={cn("h-6 rounded-full border px-2 text-[11px]", type === t ? "border-accent bg-accent-soft text-accent" : "border-border text-text-3 hover:text-text")}>{NOTE_LABELS[t]}</button>
              ))}
              <button onClick={() => setPinned((p) => !p)} className={cn("flex h-6 items-center gap-1 rounded-full border px-2 text-[11px]", pinned ? "border-accent bg-accent-soft text-accent" : "border-border text-text-3 hover:text-text")}><Pin size={11} />Pin</button>
            </div>
            <Button size="sm" variant="primary" disabled={!body.trim()} onClick={save}>Add note</Button>
          </div>
        </div>
      )}
      {sorted.length === 0 ? <p className="text-text-3">{empty}</p> : sorted.map((n) => {
        const author = userById(db, n.authorId);
        return (
          <article key={n.id} className={cn("rounded-[12px] border bg-surface p-4", n.pinned ? "border-accent/40" : "border-border")}>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-text-3">
              <Avatar initials={author?.initials ?? "?"} size={22} />
              <span className="text-text-2">{author?.name}</span>
              <span>· {fmtDateTime(n.createdAt)}</span>
              <Chip tone="outline">{NOTE_LABELS[n.noteType]}</Chip>
              {n.subject.id !== subject.id && <span>on <a className="hover:underline" href={hrefFor(n.subject.type, n.subject.id)}>{nameOf(db, n.subject.type, n.subject.id)}</a></span>}
              {n.pinned && <Chip tone="accent">Pinned</Chip>}
              {canWrite && n.subject.id === subject.id && (
                <button onClick={() => toggleNotePin(n.id)} className="ml-auto rounded p-1 text-text-3 hover:bg-surface-2 hover:text-text" aria-label={n.pinned ? "Unpin" : "Pin"}>{n.pinned ? <PinOff size={13} /> : <Pin size={13} />}</button>
              )}
            </div>
            <Markdown className="text-[15px]">{linkMentions(db, n)}</Markdown>
          </article>
        );
      })}
    </div>
  );
}
