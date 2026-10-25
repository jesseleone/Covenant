"use client";

// Renders memo / chat text: Markdown plus live token values (dotted underline,
// hover for source, click to open it) and citation chips (hover preview).

import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import type { DB } from "@/lib/schema";
import { segment, type Segment } from "@/lib/render/tokens";
import { documentById, userById } from "@/lib/selectors";
import { cn } from "@/components/ui/primitives";
import { Tip } from "@/components/ui/menu";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function RichText({ db, dealId, content, className }: { db: DB; dealId?: string; content: string; className?: string }) {
  const segs = segment(db, dealId, content);
  const md = segs.map((s, i) =>
    s.kind === "text" ? s.text
      : s.kind === "token" ? `<span data-seg="${i}">${esc(s.resolved.text)}</span>`
      : `<a data-seg="${i}" href="${esc(s.cite.href)}">${esc(s.cite.label)}</a>`,
  ).join("");

  return (
    <div className={cn("prose-serif", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          span: ({ node, children, ...props }) => {
            const i = Number((node?.properties as Record<string, unknown> | undefined)?.dataSeg);
            const seg = segs[i];
            if (seg?.kind === "token") return <TokenValue seg={seg} />;
            return <span {...props}>{children}</span>;
          },
          a: ({ node, href = "", children }) => {
            const i = Number((node?.properties as Record<string, unknown> | undefined)?.dataSeg);
            const seg = segs[i];
            if (seg?.kind === "cite") return <CiteChip db={db} target={seg.target} label={seg.cite.label} href={seg.cite.href} />;
            return href.startsWith("/") ? <Link href={href}>{children}</Link> : <a href={href} target="_blank" rel="noreferrer">{children}</a>;
          },
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

function TokenValue({ seg }: { seg: Extract<Segment, { kind: "token" }> }) {
  const router = useRouter();
  const r = seg.resolved;
  const content = (
    <div className="max-w-[280px] space-y-0.5 font-sans">
      {r.label && <div className="text-[11px] opacity-70">{r.label}</div>}
      <div className="text-[13px] font-medium">{r.text}</div>
      {r.cite && <div className="font-mono text-[11px] opacity-80">Source: {r.cite.label}{r.status === "corrected" ? " (corrected)" : ""}</div>}
      {r.unconfirmed && <div className="text-[11px] text-warn">Not yet confirmed by a reviewer</div>}
      <div className="pt-0.5 text-[11px] opacity-60">Live value · click to open the source</div>
    </div>
  );
  return (
    <Tip content={content} side="top">
      <span
        role="link" tabIndex={0}
        onClick={() => r.cite && router.push(r.cite.href)}
        onKeyDown={(e) => e.key === "Enter" && r.cite && router.push(r.cite.href)}
        className={cn(
          "cursor-pointer rounded-[3px] border-b border-dotted transition-colors hover:bg-accent-soft",
          r.unconfirmed ? "border-warn bg-warn-soft/60" : "border-accent/60",
        )}
      >
        {r.text}
      </span>
    </Tip>
  );
}

/** A short preview of what a citation points at. */
function preview(db: DB, target: string): { title: string; body?: string } {
  const [type, rest] = [target.slice(0, target.indexOf(":")), target.slice(target.indexOf(":") + 1)];
  const [id, anchor] = rest.split("#");
  if (type === "document") {
    const doc = documentById(db, id);
    const page = doc?.pages.find((p) => `p${p.n}` === anchor) ?? doc?.pages[0];
    const text = (page?.markdown ?? "").replace(/[#*|_>-]+/g, " ").replace(/\s+/g, " ").trim();
    return { title: `${doc?.title ?? "Document"}${page ? ` · p.${page.n}` : ""}`, body: text.slice(0, 220) + (text.length > 220 ? "…" : "") };
  }
  if (type === "dd_item") {
    const d = db.ddItems.find((x) => x.id === id);
    return { title: d ? `Diligence · ${d.title}` : "Diligence item", body: d ? `${d.status}${d.mitigant ? ` · ${d.mitigant}` : ""}` : undefined };
  }
  if (type === "deal") return { title: db.deals.find((d) => d.id === id)?.name ?? "Deal" };
  if (type === "company") return { title: db.companies.find((c) => c.id === id)?.name ?? "Company" };
  if (type === "person") return { title: db.people.find((p) => p.id === id)?.fullName ?? "Person" };
  if (type === "term_set") { const t = db.termSets.find((x) => x.id === id); return { title: t ? `Term set v${t.version} · ${t.status}` : "Term set" }; }
  if (type === "ic_event") {
    const e = db.icEvents.find((x) => x.id === id);
    return { title: e ? `${e.stage === "final" ? "Final" : "Screening"} IC · ${e.date.slice(0, 10)}` : "IC event", body: e?.decision ? `Decision: ${e.decision.replace(/_/g, " ")} · ${e.votes.map((v) => userById(db, v.userId)?.name).join(", ")}` : undefined };
  }
  return { title: target };
}

export function CiteChip({ db, target, label, href }: { db: DB; target: string; label: string; href: string }) {
  const p = preview(db, target);
  return (
    <Tip side="top" content={<div className="max-w-[320px] space-y-1 font-sans"><div className="text-[12px] font-medium">{p.title}</div>{p.body && <div className="font-serif text-[12px] leading-snug opacity-80">{p.body}</div>}</div>}>
      <Link href={href} className="cite-chip mx-0.5 inline-flex translate-y-[-1px] items-center rounded-full bg-surface-2 px-1.5 py-[1px] align-middle font-mono text-[11px] leading-[16px] text-text-2 no-underline transition-colors hover:bg-accent-soft hover:text-accent">
        {label}
      </Link>
    </Tip>
  );
}
