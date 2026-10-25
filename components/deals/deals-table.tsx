"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState, type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Check, Columns3 } from "lucide-react";
import { STAGES, type Deal } from "@/lib/schema";
import { useDB } from "@/lib/store";
import { companyById, daysInStage, dealMetrics, lastActivityAt, userById, type DealMetrics } from "@/lib/selectors";
import { fmtDate, fmtDateShort, fmtPct, fmtSpread, fmtUsdM, fmtX } from "@/lib/format";
import { Avatar, Chip, EmptyState, TextLink, cn } from "@/components/ui/primitives";
import { DealStatusChip, StrategyChip } from "@/components/ui/chips";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";

type Row = {
  deal: Deal; m: DealMetrics; borrower: string; sponsor: string; leadName: string; leadInitials: string;
  days: number | null; lastActivity: string | null;
};

const COLUMNS_KEY = "covenant-deals-columns";
const DEFAULT_HIDDEN: VisibilityState = { strategy: false, hold: false, risk: false, expectedClose: false, lastActivity: false };

/** Sort key (descending by default): latest-stage active deals first, then closed, then passed / lost / on hold. */
const stageRank = (d: Deal) => (d.status === "active" ? STAGES.indexOf(d.stage) : d.status === "closed" ? -1 : -2);
const nullsLast = (v: number | string | null | undefined) => v ?? null;

export function DealsTable({ deals }: { deals: Deal[] }) {
  const db = useDB();
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([{ id: "stage", desc: true }]);
  const [visibility, setVisibility] = useState<VisibilityState>(() => {
    try { return { ...DEFAULT_HIDDEN, ...JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? "{}") }; } catch { return DEFAULT_HIDDEN; }
  });

  const rows: Row[] = useMemo(() => deals.map((deal) => {
    const lead = userById(db, deal.leadUserId);
    return {
      deal, m: dealMetrics(db, deal.id),
      borrower: companyById(db, deal.borrowerCompanyId)?.name ?? "",
      sponsor: companyById(db, deal.sponsorCompanyId)?.name ?? "",
      leadName: lead?.name ?? "", leadInitials: lead?.initials ?? "",
      days: deal.status === "active" ? daysInStage(db, deal) : null,
      lastActivity: lastActivityAt(db, deal.id),
    };
  }), [db, deals]);

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { id: "deal", header: "Deal", accessorFn: (r) => r.deal.name, enableHiding: false,
      cell: ({ row: { original: r } }) => <TextLink href={`/deals/${r.deal.id}/overview`} className="font-medium">{r.deal.name}</TextLink> },
    { id: "borrower", header: "Borrower", accessorKey: "borrower", cell: ({ getValue }) => <span className="block max-w-[210px] truncate text-text-2">{getValue<string>()}</span> },
    { id: "sponsor", header: "Sponsor", accessorKey: "sponsor", cell: ({ getValue }) => <span className="text-text-2">{getValue<string>() || "—"}</span> },
    { id: "stage", header: "Stage", accessorFn: (r) => stageRank(r.deal), cell: ({ row: { original: r } }) => <DealStatusChip deal={r.deal} /> },
    { id: "days", header: "Days", accessorFn: (r) => nullsLast(r.days), sortUndefined: "last", meta: { align: "right" },
      cell: ({ row: { original: r } }) => <span className={cn(r.days !== null && r.days > 30 ? "text-warn" : "text-text-2")} title="Days in stage">{r.days ?? "—"}</span> },
    { id: "strategy", header: "Strategy", accessorFn: (r) => r.deal.strategy, cell: ({ row: { original: r } }) => <StrategyChip strategy={r.deal.strategy} /> },
    { id: "size", header: "Size", accessorFn: (r) => r.m.facilitySize, meta: { align: "right" }, cell: ({ getValue }) => fmtUsdM(getValue<number>()) },
    { id: "hold", header: "Hold", accessorFn: (r) => r.m.fundHold, meta: { align: "right" }, cell: ({ getValue }) => <span className="text-text-2">{fmtUsdM(getValue<number>())}</span> },
    { id: "leverage", header: "Leverage", accessorFn: (r) => r.m.leverage ?? undefined, sortUndefined: "last", meta: { align: "right" },
      cell: ({ row: { original: r } }) => (
        <>{fmtX(r.m.leverage)}{r.m.unconfirmed && <span title="Relies on an unconfirmed value" className="ml-1 inline-block size-1.5 rounded-full bg-warn align-middle" />}</>
      ) },
    { id: "spread", header: "Spread", accessorFn: (r) => r.m.spreadBps ?? undefined, sortUndefined: "last", cell: ({ row: { original: r } }) => fmtSpread(r.m.spreadBps) },
    { id: "cushion", header: "Cushion", accessorFn: (r) => r.m.cushion ?? undefined, sortUndefined: "last", meta: { align: "right" },
      cell: ({ row: { original: r } }) => <span className={r.m.cushionWarn ? "text-warn" : "text-text-2"}>{fmtPct(r.m.cushion)}</span> },
    { id: "risk", header: "Risk", accessorFn: (r) => r.deal.riskRating?.value, sortUndefined: "last",
      cell: ({ row: { original: r } }) => r.deal.riskRating ? <Chip tone="outline">{r.deal.riskRating.value} / 5</Chip> : <span className="text-text-3">—</span> },
    { id: "lead", header: "Lead", accessorKey: "leadName", cell: ({ row: { original: r } }) => <Avatar initials={r.leadInitials} title={r.leadName} /> },
    { id: "expectedClose", header: "Exp. close", accessorFn: (r) => r.deal.expectedClose, sortUndefined: "last", cell: ({ getValue }) => <span className="text-text-2">{fmtDate(getValue<string>())}</span> },
    { id: "nextIc", header: "Next IC", accessorFn: (r) => r.m.nextIcDate ?? undefined, sortUndefined: "last", cell: ({ getValue }) => <span className="text-text-2">{fmtDateShort(getValue<string>())}</span> },
    { id: "lastActivity", header: "Last activity", accessorKey: "lastActivity", sortUndefined: "last", cell: ({ getValue }) => <span className="text-text-2">{fmtDateShort(getValue<string>())}</span> },
  ], []);

  // TanStack Table returns non-memoizable functions; the React compiler skips this component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows, columns,
    state: { sorting, columnVisibility: visibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: (updater) => setVisibility((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem(COLUMNS_KEY, JSON.stringify(next)); } catch {}
      return next;
    }),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-text-3">{rows.length} {rows.length === 1 ? "deal" : "deals"}</span>
        <Menu>
          <MenuTrigger asChild>
            <button className="flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-[12px] text-text-2 hover:bg-surface-2 hover:text-text"><Columns3 size={14} />Columns</button>
          </MenuTrigger>
          <MenuContent align="end">
            <MenuLabel>Show columns</MenuLabel>
            {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
              <MenuItem key={c.id} onSelect={() => c.toggleVisibility()}>
                <span className="w-4">{c.getIsVisible() && <Check size={14} />}</span>{String(c.columnDef.header)}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </div>

      {rows.length === 0 ? <EmptyState title="No deals match these filters" /> : (
        <div className="overflow-x-auto rounded-[12px] border border-border bg-surface">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="border-b border-border text-[12px] text-text-3">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const right = (h.column.columnDef.meta as { align?: string } | undefined)?.align === "right";
                    const sorted = h.column.getIsSorted();
                    return (
                      <th key={h.id} className={cn("px-3 py-2 font-medium whitespace-nowrap", right && "text-right")} aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}>
                        <button onClick={h.column.getToggleSortingHandler()} className={cn("inline-flex items-center gap-1 hover:text-text", sorted && "text-text")}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? <ArrowUp size={12} /> : sorted === "desc" ? <ArrowDown size={12} /> : null}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} onClick={() => router.push(`/deals/${row.original.deal.id}/overview`)} className="cursor-pointer border-b border-border last:border-b-0 hover:bg-surface-2/60">
                  {row.getVisibleCells().map((cell) => {
                    const right = (cell.column.columnDef.meta as { align?: string } | undefined)?.align === "right";
                    return (
                      <td key={cell.id} className={cn("px-3 py-2 whitespace-nowrap tabular-nums", right && "text-right")}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
