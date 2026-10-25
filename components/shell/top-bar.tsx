"use client";

import { Bell, Search } from "lucide-react";
import { toast } from "sonner";
import { UserMenu } from "./user-menu";

export function TopBar() {
  const openSearch = () => toast("Search", { description: "The ⌘K command palette arrives in a later build step." });

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-bg px-5">
      <div className="flex-1" />
      <button
        onClick={openSearch}
        className="flex h-9 w-full max-w-[520px] items-center gap-2 rounded-[12px] border border-border bg-surface px-3 text-left text-[13px] text-text-3 transition-colors hover:border-border-strong"
      >
        <Search size={15} />
        <span className="flex-1 truncate">Search deals, companies, people, documents…</span>
        <kbd className="rounded-[6px] border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text-3">⌘K</kbd>
      </button>
      <div className="flex flex-1 items-center justify-end gap-1.5">
        <button className="rounded-[8px] p-2 text-text-3 hover:bg-surface-2 hover:text-text" aria-label="Notifications" onClick={() => toast("No new notifications")}>
          <Bell size={17} strokeWidth={1.75} />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
