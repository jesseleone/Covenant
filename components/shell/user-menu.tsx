"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Check, LogOut, Monitor, Moon, RotateCcw, Sun, UserRound } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/schema";
import { DEMO_PERSONAS } from "@/lib/seed/users";
import { resetDemoData, signIn, signOut, useCurrentUser, useDB } from "@/lib/store";
import { Avatar, Button } from "@/components/ui/primitives";
import { Dialog, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from "@/components/ui/menu";

export function UserMenu() {
  const user = useCurrentUser();
  const db = useDB();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [confirmReset, setConfirmReset] = useState(false);
  if (!user) return null;

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full py-1 pr-1 pl-2.5 hover:bg-surface-2" aria-label="User menu">
            <span className="hidden text-right leading-tight sm:block">
              <span className="block text-[13px] font-medium">{user.name}</span>
              <span className="block text-[11px] text-text-3">{ROLE_LABELS[user.role]}</span>
            </span>
            <Avatar initials={user.initials} size={30} className="bg-accent-soft text-accent ring-0" />
          </button>
        </MenuTrigger>
        <MenuContent align="end" className="w-60">
          <MenuLabel>
            <span className="block text-[13px] font-medium text-text">{user.name}</span>
            <span className="block">{user.title} · Fernhill Credit Partners</span>
          </MenuLabel>
          <MenuSeparator />
          <MenuSub>
            <MenuSubTrigger><UserRound size={15} />Switch persona</MenuSubTrigger>
            <MenuSubContent>
              {DEMO_PERSONAS.map((p) => {
                const u = db.users.find((x) => x.id === p.userId)!;
                return (
                  <MenuItem key={p.userId} onSelect={() => { signIn(p.userId); toast(`Signed in as ${u.name}`, { description: ROLE_LABELS[u.role] }); }}>
                    <span className="w-4">{u.id === user.id && <Check size={14} />}</span>
                    <span className="flex-1">{u.name}</span>
                    <span className="text-[12px] text-text-3">{p.label}</span>
                  </MenuItem>
                );
              })}
            </MenuSubContent>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger>{theme === "dark" ? <Moon size={15} /> : theme === "light" ? <Sun size={15} /> : <Monitor size={15} />}Theme</MenuSubTrigger>
            <MenuSubContent>
              {(["system", "light", "dark"] as const).map((t) => (
                <MenuItem key={t} onSelect={() => setTheme(t)}>
                  <span className="w-4">{theme === t && <Check size={14} />}</span>
                  {t[0].toUpperCase() + t.slice(1)}
                </MenuItem>
              ))}
            </MenuSubContent>
          </MenuSub>
          <MenuItem onSelect={() => setConfirmReset(true)}><RotateCcw size={15} />Reset demo data</MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={() => { signOut(); router.replace("/login"); }}><LogOut size={15} />Sign out</MenuItem>
        </MenuContent>
      </Menu>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset} title="Reset demo data?" description="Every change made in this browser is discarded and the seed data is restored.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => { resetDemoData(); setConfirmReset(false); toast("Demo data reset"); }}>Reset</Button>
        </div>
      </Dialog>
    </>
  );
}
