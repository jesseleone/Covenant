import { format, parseISO } from "date-fns";
import type { ExtractedField } from "@/lib/schema";

export const fmtUsdM = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `$${v.toFixed(digits)}M`;

export const fmtX = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? "n/a" : `${v.toFixed(digits)}x`;

/** `frac` is a fraction (0.265 → "26.5%"). */
export const fmtPct = (frac: number | null | undefined, digits = 1) =>
  frac === null || frac === undefined || !Number.isFinite(frac) ? "n/a" : `${(frac * 100).toFixed(digits)}%`;

export const fmtSpread = (bps: number | null | undefined) => (bps === null || bps === undefined ? "—" : `S+${bps}`);
export const fmtBps = (bps: number | null | undefined) => (bps === null || bps === undefined ? "—" : `${bps} bps`);

const toDate = (iso: string) => parseISO(iso.length === 10 ? `${iso}T12:00:00` : iso);
export const fmtDate = (iso?: string | null) => (iso ? format(toDate(iso), "d MMM yyyy") : "—");
export const fmtDateShort = (iso?: string | null) => (iso ? format(toDate(iso), "d MMM") : "—");
export const fmtMonthYear = (iso?: string | null) => (iso ? format(toDate(iso), "MMM yyyy") : "—");
export const fmtDateTime = (iso?: string | null) => (iso ? format(toDate(iso), "d MMM yyyy, HH:mm") : "—");

export function fmtFieldValue(f: Pick<ExtractedField, "value" | "unit" | "fieldKey">): string {
  const v = f.value;
  if (typeof v === "string") return v;
  switch (f.unit) {
    case "usd_m": return fmtUsdM(v);
    case "pct": return `${v}%`;
    case "x": return fmtX(v);
    case "count": return f.fieldKey === "founded" ? String(v) : v.toLocaleString("en-US");
    default: return String(v);
  }
}

export const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const companyTypeLabel = (t: string) => (t === "qoe_provider" ? "QoE provider" : titleCase(t));
