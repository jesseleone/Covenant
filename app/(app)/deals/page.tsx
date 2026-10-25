"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { List, Kanban, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser, useDB } from "@/lib/store";
import { Button, PageHeader, cn } from "@/components/ui/primitives";
import { DealsTable } from "@/components/deals/deals-table";
import { PipelineBoard } from "@/components/deals/pipeline-board";
import { DealFilterBar, useDealFilters } from "@/components/deals/deal-filters";

export default function DealsPage() {
  return (
    <Suspense>
      <Deals />
    </Suspense>
  );
}

function Deals() {
  const db = useDB();
  const user = useCurrentUser();
  const view = useSearchParams().get("view") === "pipeline" ? "pipeline" : "list";
  const filters = useDealFilters(db, user);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6">
      <PageHeader
        title="Deals"
        subtitle="Every opportunity Fernhill has seen, from sourcing to close."
        actions={
          <>
            <div className="flex rounded-[10px] border border-border bg-surface p-0.5" role="tablist" aria-label="View">
              {([["list", "List", List], ["pipeline", "Pipeline", Kanban]] as const).map(([v, label, Icon]) => (
                <Link
                  key={v}
                  href={`/deals?view=${v}`}
                  role="tab"
                  aria-selected={view === v}
                  className={cn("flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-[13px]", view === v ? "bg-surface-2 font-medium text-text" : "text-text-2 hover:text-text")}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              ))}
            </div>
            <Button variant="primary" onClick={() => toast("New deal", { description: "The create flow (with duplicate checks) arrives in a later build step." })}>
              <Plus size={16} />New deal
            </Button>
          </>
        }
      />
      <DealFilterBar db={db} filters={filters} />
      {view === "list" ? <DealsTable deals={filters.deals} /> : <PipelineBoard deals={filters.deals} />}
    </div>
  );
}
