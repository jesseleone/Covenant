"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ROLE_LABELS } from "@/lib/schema";
import { DEMO_PERSONAS } from "@/lib/seed/users";
import { signIn, useCurrentUser, useDB } from "@/lib/store";
import { Monogram } from "@/components/providers";
import { Avatar, Button } from "@/components/ui/primitives";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const db = useDB();
  const user = useCurrentUser();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/deals";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace(next.startsWith("/") ? next : "/deals");
  }, [user, router, next]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u) return setError("No account with that email. Try a demo persona below.");
    if (!password) return setError("Enter any password (this is a demo sign-in).");
    signIn(u.id);
  };

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Monogram size={44} />
          <div>
            <h1 className="font-serif text-[30px] font-medium">Covenant</h1>
            <p className="text-text-2">Underwriting workspace · Fernhill Credit Partners</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-[16px] border border-border bg-surface p-6">
          <label className="block">
            <span className="mb-1 block text-[12px] text-text-3">Work email</span>
            <input
              type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
              placeholder="you@fernhillcredit.com" autoComplete="username"
              className="h-10 w-full rounded-[12px] border border-border-strong bg-surface px-3 outline-none focus:border-focus"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-text-3">Password</span>
            <input
              type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }}
              autoComplete="current-password"
              className="h-10 w-full rounded-[12px] border border-border-strong bg-surface px-3 outline-none focus:border-focus"
            />
          </label>
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <Button type="submit" variant="primary" className="w-full">Sign in</Button>
          <p className="text-center text-[12px] text-text-3">Single sign-on (Okta / Entra ID) in production</p>
        </form>

        <div className="mt-6">
          <div className="mb-2 text-center text-[12px] text-text-3">Or continue as a demo persona</div>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_PERSONAS.map((p) => {
              const u = db.users.find((x) => x.id === p.userId)!;
              return (
                <button
                  key={p.userId}
                  onClick={() => signIn(u.id)}
                  className="flex items-center gap-2.5 rounded-[12px] border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-2"
                >
                  <Avatar initials={u.initials} size={30} />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[13px] font-medium">{u.name}</span>
                    <span className="block text-[12px] text-text-3">{ROLE_LABELS[u.role]} · {u.title}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
