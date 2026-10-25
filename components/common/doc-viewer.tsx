"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { Doc } from "@/lib/schema";
import { cn } from "@/components/ui/primitives";

export type Highlight = { text: string; active?: boolean };

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Wrap each quote in <mark>. A quote spanning table cells ("Revenue | 121.0 | …")
 * marks every cell of that row instead, so the table stays intact.
 */
export function applyHighlights(markdown: string, highlights: Highlight[]): string {
  let out = markdown;
  const seen = new Set<string>();
  // Active first, so a shared quote is marked as active.
  for (const h of [...highlights].sort((a, b) => Number(!!b.active) - Number(!!a.active))) {
    if (!h.text || seen.has(h.text)) continue;
    seen.add(h.text);
    const cls = h.active ? "hl-active" : "hl-soft";
    if (h.text.includes(" | ")) {
      const lines = out.split("\n");
      const i = lines.findIndex((l) => l.trim().startsWith("|") && l.includes(h.text));
      if (i >= 0) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|");
        lines[i] = `| ${cells.map((c) => (c.trim() ? `<mark class="${cls}">${c.trim()}</mark>` : c.trim())).join(" | ")} |`;
        out = lines.join("\n");
      }
    } else {
      const at = out.indexOf(h.text);
      if (at >= 0) out = `${out.slice(0, at)}<mark class="${cls}">${escapeHtml(h.text)}</mark>${out.slice(at + h.text.length)}`;
    }
  }
  return out;
}

/**
 * All pages of a document as sheets, in a scroll container. Scrolls to the
 * active highlight, or to `focusPage`, whenever either changes.
 */
export function DocViewer({ doc, focusPage, highlights = [], className }: { doc: Doc; focusPage?: number; highlights?: Highlight[]; className?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const activeKey = highlights.find((h) => h.active)?.text ?? "";

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>("mark.hl-active") ?? root.querySelector<HTMLElement>(`[data-page="${focusPage ?? 1}"]`);
    if (!target) return;
    const top = target.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    root.scrollTo({ top: Math.max(0, top - (target.tagName === "MARK" ? root.clientHeight / 3 : 12)), behavior: "smooth" });
  }, [doc.id, focusPage, activeKey]);

  return (
    <div ref={scroller} className={cn("overflow-y-auto rounded-[12px] bg-surface-2/60 p-4", className)}>
      <div className="mx-auto max-w-[720px] space-y-4">
        {doc.pages.map((p) => (
          <article key={p.n} data-page={p.n} className={cn("doc-sheet rounded-[6px] border border-border bg-surface px-8 py-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)]", focusPage === p.n && "ring-1 ring-accent/30")}>
            <div className="mb-3 flex justify-between font-mono text-[11px] text-text-3">
              <span className="truncate">{doc.title}</span>
              <span>p.{p.n} / {doc.pages.length}</span>
            </div>
            <div className="prose-serif text-[15px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {applyHighlights(p.markdown, highlights)}
              </ReactMarkdown>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
