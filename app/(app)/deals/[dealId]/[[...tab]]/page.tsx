"use client";

import { Suspense, useEffect } from "react";
import { pushRecent } from "@/lib/recent";
import { useParams } from "next/navigation";
import { useDB } from "@/lib/store";
import { dealById } from "@/lib/selectors";
import { EmptyState, TabNav } from "@/components/ui/primitives";
import { DealHeader } from "@/components/deals/deal-header";
import { DealTab, allDealTabs } from "@/components/deals/deal-tabs";

export default function DealPage() {
  const params = useParams<{ dealId: string; tab?: string[] }>();
  const db = useDB();
  const deal = dealById(db, params.dealId);
  const tab = params.tab?.[0] ?? "overview";
  useEffect(() => { if (params.dealId) pushRecent({ type: "deal", id: params.dealId }); }, [params.dealId]);

  if (!deal) return <div className="p-6"><EmptyState title="Deal not found">It may have been removed, or the link is wrong.</EmptyState></div>;

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-6 py-6">
      <DealHeader deal={deal} />
      <TabNav tabs={allDealTabs()} active={tab} base={`/deals/${deal.id}`} />
      <Suspense>
        <DealTab tab={tab} deal={deal} />
      </Suspense>
    </div>
  );
}
