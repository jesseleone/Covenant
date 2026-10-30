"use client";

// Deal tab router; each tab lives in its own file. Extensions with placement
// "deal-tab" are added after the built-in tabs.

import { Puzzle } from "lucide-react";
import type { Deal } from "@/lib/schema";
import { dealTabExtensions, extensionBySlug } from "@/lib/extensions";
import { ExtensionBadge, ExtensionFrame } from "@/components/extensions/extension-frame";
import { useDB } from "@/lib/store";
import { EmptyState } from "@/components/ui/primitives";
import { NotesPanel } from "@/components/common/notes-panel";
import { StakeholdersTab } from "./stakeholders-tab";
import { OverviewTab } from "./overview-tab";
import { FinancialsTab } from "./financials-tab";
import { DocumentsTab } from "./documents-tab";
import { SecuritiesTab } from "./securities-tab";
import { DiligenceTab } from "./diligence-tab";
import { MemoTab } from "./memo-tab";
import { IcTab } from "./ic-tab";
import { HistoryTab } from "./history-tab";

export const DEAL_TABS = [
  { slug: "overview", label: "Overview" },
  { slug: "financials", label: "Financials" },
  { slug: "securities", label: "Securities" },
  { slug: "diligence", label: "Due Diligence" },
  { slug: "memo", label: "IC Memo" },
  { slug: "ic", label: "IC & Approvals" },
  { slug: "stakeholders", label: "Stakeholders" },
  { slug: "documents", label: "Documents" },
  { slug: "notes", label: "Notes" },
  { slug: "history", label: "History" },
];

/** Built-in tabs plus extension tabs (marked with a puzzle icon). */
export const allDealTabs = () => [
  ...DEAL_TABS,
  ...dealTabExtensions().map((e) => ({
    slug: e.slug, label: e.manifest.name,
    badge: <Puzzle size={12} className="text-text-3" aria-label="Extension" />,
  })),
];

export function DealTab({ tab, deal }: { tab: string; deal: Deal }) {
  const db = useDB();
  switch (tab) {
    case "overview": return <OverviewTab db={db} deal={deal} />;
    case "financials": return <FinancialsTab db={db} deal={deal} />;
    case "securities": return <SecuritiesTab db={db} deal={deal} />;
    case "diligence": return <DiligenceTab db={db} deal={deal} />;
    case "memo": return <MemoTab db={db} deal={deal} />;
    case "ic": return <IcTab db={db} deal={deal} />;
    case "stakeholders": return <StakeholdersTab db={db} deal={deal} />;
    case "documents": return <DocumentsTab db={db} deal={deal} />;
    case "notes": return <NotesPanel db={db} subject={{ type: "deal", id: deal.id }} notes={db.notes.filter((n) => n.subject.type === "deal" && n.subject.id === deal.id)} />;
    case "history": return <HistoryTab db={db} deal={deal} />;
    default: {
      const ext = extensionBySlug(tab);
      if (!ext || ext.placement !== "deal-tab") return <EmptyState title="Unknown tab" />;
      const View = ext.Component;
      return (
        <div className="space-y-3">
          <div className="flex justify-end"><ExtensionBadge ext={ext} /></div>
          <ExtensionFrame ext={ext}><View deal={deal} /></ExtensionFrame>
        </div>
      );
    }
  }
}
