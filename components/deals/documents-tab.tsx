"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronDown, FileText } from "lucide-react";
import type { DB, Deal, Doc } from "@/lib/schema";
import { docShortName } from "@/lib/render/tokens";
import { fmtDate, titleCase } from "@/lib/format";
import { Chip, EmptyState, Table, TD, TH, THead, TR, cn } from "@/components/ui/primitives";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { DocViewer } from "@/components/common/doc-viewer";

type Citation = { label: string; detail: string; href: string };

/** Everywhere a document is used: extracted values and memo citations. */
export function citationsOf(db: DB, doc: Doc): Citation[] {
  const out: Citation[] = [];
  for (const f of db.extractedFields.filter((x) => x.documentId === doc.id)) {
    out.push({ label: `Financials · ${f.label}`, detail: `p.${f.page}`, href: `/deals/${doc.dealId}/financials?field=${f.fieldKey}` });
  }
  for (const s of db.memoSections) {
    const pages = [...s.content.matchAll(new RegExp(`document:${doc.id}#p(\\d+)`, "g"))].map((m) => m[1]);
    if (pages.length) out.push({ label: `IC Memo · ${s.title}`, detail: pages.map((p) => `p.${p}`).join(", "), href: `/deals/${doc.dealId}/memo` });
  }
  return out;
}

export function DocumentsTab({ db, deal }: { db: DB; deal: Deal }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const docs = db.documents.filter((d) => d.dealId === deal.id).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const open = docs.find((d) => d.id === params.get("doc"));
  const page = Number(params.get("page")) || undefined;

  if (docs.length === 0) return <EmptyState title="No documents yet">Documents from the data room, email or uploads appear here.</EmptyState>;
  if (open) return <DocumentView db={db} doc={open} page={page} onBack={() => router.push(pathname)} />;

  return (
    <Table>
      <THead><tr><TH>Title</TH><TH>Type</TH><TH className="text-right">Version</TH><TH>Source</TH><TH className="text-right">Pages</TH><TH>Extraction</TH><TH>Cited in</TH><TH>Added</TH></tr></THead>
      <tbody>
        {docs.map((d) => {
          const cites = citationsOf(db, d);
          return (
            <TR key={d.id} onClick={() => router.push(`${pathname}?doc=${d.id}`)}>
              <TD className="font-medium"><span className="flex items-center gap-2"><FileText size={15} className="text-text-3" />{d.title}</span></TD>
              <TD><Chip tone="outline">{docShortName(d.docType) === "Doc" ? titleCase(d.docType) : docShortName(d.docType)}</Chip></TD>
              <TD className="text-right tabular-nums">v{d.version}</TD>
              <TD className="text-text-2">{d.source === "vdr" ? "Data room" : titleCase(d.source)}</TD>
              <TD className="text-right tabular-nums">{d.pages.length}</TD>
              <TD>{d.extractionStatus === "done" ? <Chip tone="success">Extracted</Chip> : <Chip>Not extracted</Chip>}</TD>
              <TD><CitedIn cites={cites} /></TD>
              <TD className="text-text-2">{fmtDate(d.uploadedAt)}</TD>
            </TR>
          );
        })}
      </tbody>
    </Table>
  );
}

function CitedIn({ cites }: { cites: Citation[] }) {
  if (cites.length === 0) return <span className="text-text-3">—</span>;
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <Menu>
        <MenuTrigger asChild>
          <button className="flex items-center gap-1 rounded-[8px] px-1.5 py-0.5 text-[13px] text-text-2 hover:bg-surface-2 hover:text-text">
            {cites.length} place{cites.length === 1 ? "" : "s"}<ChevronDown size={13} />
          </button>
        </MenuTrigger>
        <MenuContent className="max-h-[320px] overflow-y-auto">
          <MenuLabel>Cited in</MenuLabel>
          {cites.map((c) => (
            <MenuItem key={c.label + c.detail}>
              <Link href={c.href} className="flex w-full justify-between gap-4"><span>{c.label}</span><span className="font-mono text-[11px] text-text-3">{c.detail}</span></Link>
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </span>
  );
}

function DocumentView({ db, doc, page, onBack }: { db: DB; doc: Doc; page?: number; onBack: () => void }) {
  const cites = citationsOf(db, doc);
  const fields = db.extractedFields.filter((f) => f.documentId === doc.id);
  const pathname = usePathname();
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={onBack} className="flex items-center gap-1 rounded-[8px] px-2 py-1 text-[13px] text-text-2 hover:bg-surface-2 hover:text-text"><ArrowLeft size={14} />All documents</button>
          <span className="font-serif text-[18px]">{doc.title}</span>
          <Chip tone="outline">{docShortName(doc.docType)}</Chip>
          <span className="text-[12px] text-text-3">v{doc.version} · {doc.pages.length} pages · added {fmtDate(doc.uploadedAt)}</span>
        </div>
        <DocViewer doc={doc} focusPage={page} highlights={fields.map((f) => ({ text: f.quote }))} className="h-[calc(100vh-300px)] min-h-[520px]" />
      </div>
      <aside className="space-y-4">
        <div>
          <div className="mb-2 text-[12px] text-text-3">Pages</div>
          <div className="flex flex-wrap gap-1">
            {doc.pages.map((p) => (
              <Link key={p.n} href={`${pathname}?doc=${doc.id}&page=${p.n}`} scroll={false}
                className={cn("flex size-8 items-center justify-center rounded-[8px] border text-[12px] tabular-nums", p.n === page ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-text-2 hover:text-text")}>
                {p.n}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[12px] text-text-3">Cited in {cites.length} place{cites.length === 1 ? "" : "s"}</div>
          <ul className="space-y-1">
            {cites.map((c) => (
              <li key={c.label + c.detail}>
                <Link href={c.href} className="flex justify-between gap-3 rounded-[8px] px-2 py-1.5 text-[13px] hover:bg-surface-2">
                  <span className="min-w-0 truncate">{c.label}</span><span className="shrink-0 font-mono text-[11px] text-text-3">{c.detail}</span>
                </Link>
              </li>
            ))}
            {cites.length === 0 && <li className="text-[13px] text-text-3">Not cited yet.</li>}
          </ul>
        </div>
        {fields.length > 0 && <p className="text-[12px] text-text-3">Highlighted passages are the sources of extracted values.</p>}
      </aside>
    </div>
  );
}
