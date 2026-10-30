"use client";

// A left-menu page provided by an extension (extensions/<slug>, placement "nav").

import { useParams } from "next/navigation";
import { extensionBySlug } from "@/lib/extensions";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { ExtensionBadge, ExtensionFrame } from "@/components/extensions/extension-frame";

export default function ExtensionPage() {
  const { slug } = useParams<{ slug: string }>();
  const ext = extensionBySlug(slug);

  if (!ext || ext.placement !== "nav") {
    return <div className="p-6"><EmptyState title="Page not found">No extension page called “{slug}”. See the Extensions catalog.</EmptyState></div>;
  }
  const View = ext.Component;
  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-6 py-6">
      <PageHeader title={ext.manifest.name} subtitle={ext.manifest.description} actions={<ExtensionBadge ext={ext} />} />
      <ExtensionFrame ext={ext}><View /></ExtensionFrame>
    </div>
  );
}
