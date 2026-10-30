"use client";

import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { Tooltip } from "radix-ui";
import { hydrateStores } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  // The read cache is filled from the server (GET /api/session, /api/db), so
  // nothing store-dependent renders until it has loaded.
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    hydrateStores().then(() => setReady(true), (e: Error) => setError(e.message));
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Tooltip.Provider delayDuration={250}>
        {ready ? children : <Splash error={error} />}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!bg-surface !text-text !border-border !shadow-pop !rounded-xl !font-sans",
            descriptionClassName: "!text-text-2",
          }}
        />
      </Tooltip.Provider>
    </ThemeProvider>
  );
}

function Splash({ error }: { error: string | null }) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="flex max-w-[420px] flex-col items-center gap-3 text-center text-text-3">
        <Monogram size={28} />
        {error && (
          <p className="text-[13px] text-text-2">
            Covenant can&apos;t reach its database. If you&apos;re running it yourself, start Postgres
            (<code className="font-mono text-[12px]">docker compose up -d db</code>) and reload. ({error})
          </p>
        )}
      </div>
    </div>
  );
}

export function Monogram({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[8px] bg-accent font-serif text-white"
      style={{ width: size, height: size, fontSize: size * 0.62, lineHeight: 1 }}
    >
      C
    </span>
  );
}
