"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog as RDialog } from "radix-ui";
import Fuse from "fuse.js";
import { ArrowRight, Building2, Clock, Kanban, MessageSquare, Moon, Plus, Search, User } from "lucide-react";
import { useTheme } from "next-themes";
import { STAGE_LABELS, type DB } from "@/lib/schema";
import { useDB } from "@/lib/store";
import { openNew, setPalette, useUI } from "@/lib/ui";
import { getRecent } from "@/lib/recent";
import { companyById, currentAffiliation } from "@/lib/selectors";
import { companyTypeLabel } from "@/lib/format";
import { DEAL_TABS } from "@/components/deals/deal-tabs";
import { Chip } from "@/components/ui/primitives";

type Entry = { type: "deal" | "company" | "person"; id: string; name: string; keys: string[]; detail: string; href: string };

function entries(db: DB): Entry[] {
  return [
    ...db.deals.map((d) => ({ type: "deal" as const, id: d.id, name: d.name, keys: [d.name, d.codename, companyById(db, d.borrowerCompanyId)?.name ?? ""], detail: d.status === "active" ? STAGE_LABELS[d.stage] : d.status, href: `/deals/${d.id}/overview` })),
    ...db.companies.map((c) => ({ type: "company" as const, id: c.id, name: c.name, keys: [c.name, ...c.aliases, c.domain ?? ""], detail: c.types.map(companyTypeLabel).join(", "), href: `/companies/${c.id}/overview` })),
    ...db.people.map((p) => {
      const a = currentAffiliation(db, p.id);
      return { type: "person" as const, id: p.id, name: p.fullName, keys: [p.fullName, p.email ?? ""], detail: `${a?.title ?? ""} @ ${companyById(db, a?.companyId)?.name ?? ""}`, href: `/people/${p.id}/overview` };
    }),
  ];
}

const ICON = { deal: Kanban, company: Building2, person: User };
const itemCls = "flex cursor-default items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] data-[selected=true]:bg-surface-2";

export function CommandPalette() {
  const open = useUI((s) => s.palette);
  const db = useDB();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(!useUI.getState().palette); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const all = useMemo(() => entries(db), [db]);
  const fuse = useMemo(() => new Fuse(all, { keys: ["keys"], threshold: 0.35, ignoreLocation: true }), [all]);
  const results = q.trim() ? fuse.search(q.trim()).map((r) => r.item) : [];
  const recent = open && !q.trim() ? getRecent().map((r) => all.find((e) => e.id === r.id)).filter((e): e is Entry => !!e) : [];
  const topDeal = results.find((r) => r.type === "deal");

  const go = (href: string) => { setPalette(false); setQ(""); router.push(href); };
  const run = (fn: () => void) => { setPalette(false); setQ(""); fn(); };
  const group = (type: Entry["type"], heading: string) => {
    const rows = results.filter((r) => r.type === type).slice(0, 5);
    if (!rows.length) return null;
    return (
      <Command.Group heading={heading}>
        {rows.map((r) => {
          const Icon = ICON[r.type];
          const d = r.type === "deal" ? db.deals.find((x) => x.id === r.id) : undefined;
          return (
            <Command.Item key={r.id} value={`${r.type}-${r.id}`} onSelect={() => go(r.href)} className={itemCls}>
              <Icon size={15} className="text-text-3" /><span className="flex-1 truncate">{r.name}</span>
              {d ? <Chip>{r.detail === "active" ? STAGE_LABELS[d.stage] : r.detail}</Chip> : <span className="truncate text-[12px] text-text-3">{r.detail}</span>}
            </Command.Item>
          );
        })}
      </Command.Group>
    );
  };

  return (
    <RDialog.Root open={open} onOpenChange={(v) => { setPalette(v); if (!v) setQ(""); }}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-black/20" />
        <RDialog.Content className="fixed top-[12vh] left-1/2 z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[16px] border border-border bg-surface shadow-pop">
          <RDialog.Title className="sr-only">Search</RDialog.Title>
          <RDialog.Description className="sr-only">Search deals, companies and people, or run an action</RDialog.Description>
          <Command shouldFilter={false} loop label="Command palette">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search size={16} className="text-text-3" />
              <Command.Input value={q} onValueChange={setQ} placeholder="Search deals, companies, people, or type a command…" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-text-3" />
              <kbd className="rounded-[6px] border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text-3">esc</kbd>
            </div>
            <Command.List className="max-h-[420px] overflow-y-auto p-1.5 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-text-3">
              {q.trim() && results.length === 0 && <Command.Empty className="px-3 py-6 text-center text-[13px] text-text-3">No records match “{q}”.</Command.Empty>}
              {recent.length > 0 && (
                <Command.Group heading="Recent">
                  {recent.map((r) => { const Icon = ICON[r.type]; return (
                    <Command.Item key={r.id} value={`recent-${r.id}`} onSelect={() => go(r.href)} className={itemCls}>
                      <Clock size={15} className="text-text-3" /><Icon size={14} className="text-text-3" /><span className="flex-1">{r.name}</span><span className="text-[12px] text-text-3">{r.detail}</span>
                    </Command.Item>
                  ); })}
                </Command.Group>
              )}
              {group("deal", "Deals")}
              {topDeal && (
                <Command.Group heading={`Go to ${topDeal.name}`}>
                  {DEAL_TABS.filter((t) => t.slug !== "overview").slice(0, 5).map((t) => (
                    <Command.Item key={t.slug} value={`tab-${t.slug}`} onSelect={() => go(`/deals/${topDeal.id}/${t.slug}`)} className={itemCls}>
                      <ArrowRight size={15} className="text-text-3" />{topDeal.name} → {t.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {group("company", "Companies")}
              {group("person", "People")}
              <Command.Group heading="Actions">
                {q.trim() && (
                  <Command.Item value="ask" onSelect={() => go(`/chat?q=${encodeURIComponent(q.trim())}`)} className={itemCls}>
                    <MessageSquare size={15} className="text-accent" />Ask chat “{q.trim()}”
                  </Command.Item>
                )}
                <Command.Item value="new-deal" onSelect={() => run(() => openNew("deal"))} className={itemCls}><Plus size={15} className="text-text-3" />New deal</Command.Item>
                <Command.Item value="new-company" onSelect={() => run(() => openNew("company"))} className={itemCls}><Plus size={15} className="text-text-3" />New company</Command.Item>
                <Command.Item value="new-person" onSelect={() => run(() => openNew("person"))} className={itemCls}><Plus size={15} className="text-text-3" />New person</Command.Item>
                <Command.Item value="chat" onSelect={() => go("/chat")} className={itemCls}><MessageSquare size={15} className="text-text-3" />Go to chat</Command.Item>
                <Command.Item value="theme" onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))} className={itemCls}><Moon size={15} className="text-text-3" />Toggle theme</Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
