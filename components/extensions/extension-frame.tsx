"use client";

// Renders an extension inside an error boundary, so a broken extension shows
// a message (with who to contact) instead of taking the page down.

import { Component, type ReactNode } from "react";
import { Puzzle } from "lucide-react";
import type { Extension } from "@/lib/extensions";
import { Chip } from "@/components/ui/primitives";

class Boundary extends Component<{ ext: Extension; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(`Extension "${this.props.ext.slug}" failed:`, error); }
  render() {
    const { ext } = this.props;
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-[12px] border border-dashed border-border-strong px-6 py-10 text-center">
        <div className="font-serif text-[17px]">{ext.manifest.name} hit a problem</div>
        <div className="mx-auto mt-1 max-w-md text-text-3">
          The rest of Covenant is unaffected. Let {ext.manifest.owner.name} (@{ext.manifest.owner.github}) know.
        </div>
        <pre className="mx-auto mt-3 max-w-md truncate font-mono text-[11px] text-text-3">{this.state.error.message}</pre>
      </div>
    );
  }
}

/** A small label marking extension-built screens and who owns them. */
export function ExtensionBadge({ ext }: { ext: Extension }) {
  return (
    <Chip tone="outline" title={`Extension built by ${ext.manifest.owner.name}. See the Extensions catalog.`}>
      <Puzzle size={11} />Extension · {ext.manifest.owner.name}
    </Chip>
  );
}

export function ExtensionFrame({ ext, children }: { ext: Extension; children: ReactNode }) {
  return <Boundary ext={ext}>{children}</Boundary>;
}
