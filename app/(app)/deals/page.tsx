"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { List, Kanban } from "lucide-react";
import { PageHeader, cn } from "@/components/ui/primitives";
import { DealsTable } from "@/components/deals/deals-table";
import { PipelineBoard } from "@/components/deals/pipeline-board";

export default function DealsPage() {
  return (
    <Suspense>
      <Deals />
    </Suspense>
  );
}

function Deals() {
  const view = useSearchParams().get("view") === "pipeline" ? "pipeline" : "list";
  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-6 py-6">
      <PageHeader
        title="Deals"
        subtitle="Every opportunity Fernhill has seen, from sourcing to close."
        actions={
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
        }
      />
      {view === "list" ? <DealsTable /> : <PipelineBoard />}
    </div>
  );
}
