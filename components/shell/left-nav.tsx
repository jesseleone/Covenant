"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronDown, ClipboardCheck, Gavel, Inbox, Kanban, MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Users } from "lucide-react";
import { openNew } from "@/lib/ui";
import { Monogram } from "@/components/providers";
import { cn } from "@/components/ui/primitives";
import { Menu, MenuContent, MenuItem, MenuTrigger, Tip } from "@/components/ui/menu";

const NAV = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/deals", label: "Deals", icon: Kanban },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/people", label: "People", icon: Users },
];

const LATER = [
  { label: "My queue", icon: Inbox },
  { label: "IC calendar", icon: Gavel },
  { label: "Review queue", icon: ClipboardCheck },
];

export function LeftNav({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  return (
    <aside className={cn("flex h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-150", collapsed ? "w-16" : "w-[260px]")}>
      <div className={cn("flex h-14 items-center gap-2.5", collapsed ? "justify-center" : "px-4")}>
        <Link href="/deals" className="flex items-center gap-2.5" aria-label="Covenant home">
          <Monogram size={26} />
          {!collapsed && <span className="font-serif text-[19px] font-medium tracking-tight">Covenant</span>}
        </Link>
      </div>

      <div className={cn("pb-2", collapsed ? "px-3" : "px-3")}>
        <Menu>
          <MenuTrigger asChild>
            <button
              className={cn(
                "flex h-9 w-full items-center gap-2 rounded-[8px] bg-accent text-[14px] font-medium text-white transition-colors hover:bg-accent-hover",
                collapsed ? "justify-center" : "px-3",
              )}
              aria-label="New"
            >
              <Plus size={16} />
              {!collapsed && <><span className="flex-1 text-left">New</span><ChevronDown size={14} className="opacity-80" /></>}
            </button>
          </MenuTrigger>
          <MenuContent align="start">
            <MenuItem onSelect={() => openNew("deal")}><Kanban size={15} />Deal</MenuItem>
            <MenuItem onSelect={() => openNew("company")}><Building2 size={15} />Company</MenuItem>
            <MenuItem onSelect={() => openNew("person")}><Users size={15} />Person</MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <nav className="flex flex-col gap-0.5 px-3 pt-1" aria-label="Primary">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const link = (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-9 items-center gap-2.5 rounded-[8px] text-[14px] transition-colors",
                collapsed ? "justify-center" : "px-3",
                active ? "bg-surface-2 font-medium text-text" : "text-text-2 hover:bg-surface-2/70 hover:text-text",
              )}
            >
              {active && <span className="absolute top-2 bottom-2 left-0 w-[2px] rounded-full bg-accent" />}
              <Icon size={17} strokeWidth={1.75} />
              {!collapsed && label}
            </Link>
          );
          return collapsed ? <Tip key={href} content={label}>{link}</Tip> : link;
        })}
      </nav>

      <div className="mx-5 my-3 h-px bg-border" />

      <div className="flex flex-col gap-0.5 px-3">
        {LATER.map(({ label, icon: Icon }) => (
          <Tip key={label} content="Coming soon">
            <span
              aria-disabled
              className={cn("flex h-9 cursor-default items-center gap-2.5 rounded-[8px] text-[14px] text-text-3/80", collapsed ? "justify-center" : "px-3")}
            >
              <Icon size={17} strokeWidth={1.75} />
              {!collapsed && label}
            </span>
          </Tip>
        ))}
      </div>

      <div className="mt-auto p-3">
        <button
          onClick={onToggle}
          className={cn("flex h-9 w-full items-center gap-2.5 rounded-[8px] text-[13px] text-text-3 hover:bg-surface-2 hover:text-text", collapsed ? "justify-center" : "px-3")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <><PanelLeftClose size={17} />Collapse</>}
        </button>
      </div>
    </aside>
  );
}
