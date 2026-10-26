"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/store";
import { LeftNav } from "./left-nav";
import { TopBar } from "./top-bar";
import { CommandPalette } from "./command-palette";
import { GlobalModals } from "@/components/modals/new-modals";

const COLLAPSE_KEY = "covenant-nav-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  // The shell only renders in the browser (after the stores hydrate), so
  // localStorage is available on first render.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [user, router, pathname]);
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch {}
      return !c;
    });
  };

  if (!user) return null;

  return (
    <div className="flex h-full">
      <LeftNav collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandPalette />
      <GlobalModals />
    </div>
  );
}
