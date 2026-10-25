"use client";

import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { Tooltip } from "radix-ui";
import { hydrateStores } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  // The DB lives in localStorage, so nothing store-dependent renders until the
  // stores have hydrated in the browser. This also avoids hydration mismatches.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    hydrateStores().then(() => setReady(true));
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Tooltip.Provider delayDuration={250}>
        {ready ? children : <Splash />}
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!bg-surface !text-text !border-border !shadow-pop !rounded-xl !font-sans",
          }}
        />
      </Tooltip.Provider>
    </ThemeProvider>
  );
}

function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-text-3">
        <Monogram size={28} />
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
