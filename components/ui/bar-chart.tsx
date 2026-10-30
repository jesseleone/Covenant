"use client";

// Horizontal bar list: one measure across categories. One hue (the accent),
// bars anchored at a shared baseline with a 4px rounded data end, values in
// text colour beside each bar, and a hover/focus tooltip per row. The rows
// are a real table, so the numbers are readable without the bars.

import { useState } from "react";
import { cn } from "@/components/ui/primitives";

export type Bar = { label: string; value: number; detail?: string };

export function BarChart({
  bars, format = (v) => String(v), valueLabel = "Value", labelHeading = "Category", className,
}: {
  bars: Bar[];
  format?: (value: number) => string;
  valueLabel?: string;
  labelHeading?: string;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...bars.map((b) => b.value));
  return (
    <table className={cn("w-full border-collapse text-left text-[13px]", className)}>
      <thead className="sr-only">
        <tr><th>{labelHeading}</th><th>{valueLabel}</th><th>Details</th></tr>
      </thead>
      <tbody>
        {bars.map((b, i) => (
          <tr
            key={b.label}
            tabIndex={0}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            className="group outline-none"
          >
            <th scope="row" className="w-[34%] max-w-0 truncate py-1.5 pr-3 font-normal text-text-2 group-hover:text-text group-focus:text-text">{b.label}</th>
            <td className="relative py-1.5">
              <div className="flex items-center gap-2">
                <div className="h-2.5 flex-1">
                  <div
                    className="h-full rounded-r-[4px] bg-accent transition-opacity"
                    style={{ width: max > 0 ? `${Math.max(0.5, (b.value / max) * 100)}%` : 0, opacity: hover === null || hover === i ? 1 : 0.45 }}
                  />
                </div>
                <span className="w-[72px] shrink-0 text-right font-mono text-[12px] tabular-nums text-text">{format(b.value)}</span>
              </div>
              {hover === i && b.detail && (
                <div role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-[12px] whitespace-nowrap text-text-2 shadow-pop">
                  <span className="font-medium text-text">{b.label}</span> · {format(b.value)} · {b.detail}
                </div>
              )}
            </td>
            <td className="sr-only">{b.detail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
