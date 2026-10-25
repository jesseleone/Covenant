"use client";

import { Check, Pencil } from "lucide-react";
import { STAGE_LABELS, STRATEGY_LABELS, type Deal, type Stage, type Strategy } from "@/lib/schema";
import type { Strength } from "@/lib/selectors";
import { Chip, type Tone } from "./primitives";

export const StageChip = ({ stage }: { stage: Stage }) => <Chip tone="neutral">{STAGE_LABELS[stage]}</Chip>;

export const StrategyChip = ({ strategy }: { strategy: Strategy }) => <Chip tone="outline">{STRATEGY_LABELS[strategy]}</Chip>;

export function DealStatusChip({ deal }: { deal: Deal }) {
  if (deal.status === "active") return <StageChip stage={deal.stage} />;
  const map: Record<string, [Tone, string]> = {
    closed: ["success", "Closed"], passed: ["danger", "Passed"], lost: ["danger", "Lost"], on_hold: ["warn", "On hold"],
  };
  const [tone, label] = map[deal.status];
  return <Chip tone={tone}>{label}</Chip>;
}

export function FieldStatusChip({ status }: { status: "proposed" | "confirmed" | "corrected" }) {
  if (status === "proposed") return <Chip tone="warn">Proposed</Chip>;
  if (status === "corrected") return <Chip tone="success"><Pencil size={11} />Corrected</Chip>;
  return <Chip tone="success"><Check size={12} />Confirmed</Chip>;
}

export function SeverityChip({ severity }: { severity?: "red_flag" | "high" | "medium" | "low" }) {
  if (!severity) return null;
  const map: Record<string, [Tone, string]> = { red_flag: ["danger", "Red flag"], high: ["warn", "High"], medium: ["neutral", "Medium"], low: ["outline", "Low"] };
  const [tone, label] = map[severity];
  return <Chip tone={tone}>{label}</Chip>;
}

export function StrengthChip({ strength }: { strength: Strength }) {
  const tone: Tone = strength === "strong" ? "success" : strength === "medium" ? "neutral" : "outline";
  return <Chip tone={tone}>{strength[0].toUpperCase() + strength.slice(1)}</Chip>;
}

export function DecisionChip({ decision }: { decision?: string }) {
  if (!decision) return <Chip tone="warn">Pending</Chip>;
  const map: Record<string, [Tone, string]> = {
    approve: ["success", "Approve"], approve_with_conditions: ["success", "Approve with conditions"],
    defer: ["warn", "Defer"], decline: ["danger", "Decline"], abstain: ["neutral", "Abstain"],
  };
  const [tone, label] = map[decision] ?? ["neutral", decision];
  return <Chip tone={tone}>{label}</Chip>;
}

export function TermSetStatusChip({ status }: { status: "draft" | "issued" | "locked" }) {
  return status === "locked" ? <Chip tone="success">Locked</Chip> : status === "issued" ? <Chip tone="accent">Issued</Chip> : <Chip>Draft</Chip>;
}
