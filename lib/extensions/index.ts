// The extensions the app knows about. The list is generated from the
// extensions/*/manifest.json files (scripts/gen-extensions.ts runs before
// dev, build, test and typecheck), so adding an extension needs no edit here.

import type { ComponentType } from "react";
import type { Deal } from "@/lib/schema";
import type { ExtensionManifest } from "./manifest";
import { GENERATED } from "./registry.generated";

type Base = { slug: string; manifest: ExtensionManifest };
export type NavExtension = Base & { placement: "nav"; Component: ComponentType };
export type DealTabExtension = Base & { placement: "deal-tab"; Component: ComponentType<{ deal: Deal }> };
export type Extension = NavExtension | DealTabExtension;

export const EXTENSIONS = GENERATED.map((e) => ({ ...e, placement: e.manifest.placement })) as Extension[];

export const navExtensions = () => EXTENSIONS.filter((e): e is NavExtension => e.placement === "nav");
export const dealTabExtensions = () => EXTENSIONS.filter((e): e is DealTabExtension => e.placement === "deal-tab");
export const extensionBySlug = (slug: string) => EXTENSIONS.find((e) => e.slug === slug);

/** Where an extension opens: its own page, or its tab on a deal. */
export const extensionHref = (e: Extension, dealId = "deal_larch") => (e.placement === "nav" ? `/x/${e.slug}` : `/deals/${dealId}/${e.slug}`);
