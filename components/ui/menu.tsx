"use client";

// Thin, styled wrappers over Radix primitives.

import { Dialog as RDialog, DropdownMenu as RDM, Tooltip as RTooltip } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "./primitives";

const popover = "z-50 min-w-[200px] rounded-[12px] border border-border bg-surface p-1 shadow-pop";
const item = "flex cursor-default items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13px] text-text outline-none select-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50";

export const Menu = RDM.Root;
export const MenuTrigger = RDM.Trigger;
export const MenuSub = RDM.Sub;

export function MenuContent({ children, align = "start", className, side }: { children: React.ReactNode; align?: "start" | "end" | "center"; className?: string; side?: "top" | "bottom" | "right" | "left" }) {
  return (
    <RDM.Portal>
      <RDM.Content sideOffset={6} align={align} side={side} className={cn(popover, className)}>
        {children}
      </RDM.Content>
    </RDM.Portal>
  );
}

export function MenuItem({ children, onSelect, disabled, className }: { children: React.ReactNode; onSelect?: () => void; disabled?: boolean; className?: string }) {
  return <RDM.Item onSelect={onSelect} disabled={disabled} className={cn(item, className)}>{children}</RDM.Item>;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <RDM.Label className="px-2.5 pt-1.5 pb-1 text-[12px] text-text-3">{children}</RDM.Label>;
}

export const MenuSeparator = () => <RDM.Separator className="my-1 h-px bg-border" />;

export function MenuSubTrigger({ children }: { children: React.ReactNode }) {
  return <RDM.SubTrigger className={cn(item, "data-[state=open]:bg-surface-2")}>{children}</RDM.SubTrigger>;
}

export function MenuSubContent({ children }: { children: React.ReactNode }) {
  return (
    <RDM.Portal>
      <RDM.SubContent sideOffset={6} className={popover}>{children}</RDM.SubContent>
    </RDM.Portal>
  );
}

export function Tip({ content, children, side = "right" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={side} sideOffset={6} className="z-50 rounded-[8px] bg-text px-2 py-1 text-[12px] text-bg shadow-pop">
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

export function Dialog({
  open, onOpenChange, title, description, children, className,
}: { open: boolean; onOpenChange: (v: boolean) => void; title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[1px]" />
        <RDialog.Content className={cn("fixed top-1/2 left-1/2 z-50 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-border bg-surface p-6 shadow-pop", className)}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RDialog.Title className="font-serif text-[20px] font-medium">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-1 text-text-2">{description}</RDialog.Description> : <RDialog.Description className="sr-only">{title}</RDialog.Description>}
            </div>
            <RDialog.Close className="rounded-[8px] p-1 text-text-3 hover:bg-surface-2 hover:text-text" aria-label="Close">
              <X size={18} />
            </RDialog.Close>
          </div>
          {children}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
