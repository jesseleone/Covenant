"use client";

import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import type { DB, EntityType } from "@/lib/schema";
import { cn } from "@/components/ui/primitives";

export type Pick = { type: EntityType; id: string; name: string };

/** A small popover list for @-mentioning a deal, company or person. */
export function MentionPicker({ db, onPick, onClose, className }: { db: DB; onPick: (p: Pick) => void; onClose: () => void; className?: string }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const all = useMemo(() => [
    ...db.deals.map((d) => ({ type: "deal" as const, id: d.id, name: d.name, keys: [d.name, d.codename], hint: d.status === "active" ? "Deal" : `Deal · ${d.status}` })),
    ...db.companies.map((c) => ({ type: "company" as const, id: c.id, name: c.name, keys: [c.name, ...c.aliases], hint: "Company" })),
    ...db.people.map((p) => ({ type: "person" as const, id: p.id, name: p.fullName, keys: [p.fullName], hint: "Person" })),
  ], [db]);
  const fuse = useMemo(() => new Fuse(all, { keys: ["keys"], threshold: 0.4, ignoreLocation: true }), [all]);
  const results = (q ? fuse.search(q).map((r) => r.item) : all.filter((x) => x.type === "deal")).slice(0, 8);
  return (
    <div className={cn("absolute right-3 bottom-full left-3 z-20 mb-2 rounded-[12px] border border-border bg-surface p-1.5 shadow-pop", className)}>
      <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} placeholder="Mention a deal, company or person…"
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); onClose(); }
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && results[active]) { e.preventDefault(); onPick(results[active]); }
        }}
        className="mb-1 h-8 w-full rounded-[8px] bg-surface-2/60 px-2.5 text-[13px] outline-none" />
      {results.map((r, i) => (
        <button type="button" key={r.id} onMouseEnter={() => setActive(i)} onClick={() => onPick(r)}
          className={cn("flex w-full items-center justify-between rounded-[8px] px-2.5 py-1.5 text-left text-[13px]", i === active && "bg-surface-2")}>
          <span>{r.name}</span><span className="text-[11px] text-text-3">{r.hint}</span>
        </button>
      ))}
      {results.length === 0 && <div className="px-2.5 py-2 text-[13px] text-text-3">No matches</div>}
    </div>
  );
}
