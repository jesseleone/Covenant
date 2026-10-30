"use client";

// Catalog of every extension: what it is, where it appears, who owns it and
// when it last changed, so stale ones can be retired.

import { differenceInCalendarDays, parseISO } from "date-fns";
import { EXTENSIONS, extensionHref } from "@/lib/extensions";
import { STALE_AFTER_DAYS } from "@/lib/extensions/manifest";
import { fmtDate } from "@/lib/format";
import { Chip, EmptyState, PageHeader, Table, TD, TH, THead, TR, TextLink } from "@/components/ui/primitives";

export default function ExtensionsCatalog() {
  const today = new Date();
  const rows = [...EXTENSIONS].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  return (
    <div className="mx-auto max-w-[1280px] space-y-5 px-6 py-6">
      <PageHeader
        title="Extensions"
        subtitle="Views built by the team on top of Covenant. Each one only reads data, or adds notes and diligence items, through the extension SDK."
      />
      {rows.length === 0 ? (
        <EmptyState title="No extensions yet">Ask Claude Code to build one: it will create a folder under extensions/ and send it for approval.</EmptyState>
      ) : (
        <Table>
          <THead><tr><TH>Name</TH><TH>What it does</TH><TH>Where</TH><TH>Owner</TH><TH>Last updated</TH></tr></THead>
          <tbody>
            {rows.map((e) => {
              const age = differenceInCalendarDays(today, parseISO(e.manifest.updatedAt));
              return (
                <TR key={e.slug}>
                  <TD className="font-medium"><TextLink href={extensionHref(e)}>{e.manifest.name}</TextLink></TD>
                  <TD className="max-w-[420px] text-text-2">{e.manifest.description}</TD>
                  <TD className="whitespace-nowrap">{e.placement === "nav" ? "Left menu page" : "Tab on each deal"}</TD>
                  <TD className="whitespace-nowrap">
                    {e.manifest.owner.name} <a href={`https://github.com/${e.manifest.owner.github}`} target="_blank" rel="noreferrer" className="text-text-3 hover:text-accent">@{e.manifest.owner.github}</a>
                  </TD>
                  <TD className="whitespace-nowrap">
                    {fmtDate(e.manifest.updatedAt)}
                    {age > STALE_AFTER_DAYS && <Chip tone="warn" className="ml-2" title={`No changes in ${age} days; check it's still used.`}>Review: {age} days old</Chip>}
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
