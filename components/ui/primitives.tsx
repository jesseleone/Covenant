"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...v: ClassValue[]) => twMerge(clsx(v));

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "bg-surface-2 text-text hover:bg-border",
  ghost: "text-text-2 hover:bg-surface-2 hover:text-text",
  outline: "border border-border-strong bg-surface text-text hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
};
const sizes: Record<Size, string> = { sm: "h-7 px-2.5 text-[13px] gap-1.5", md: "h-9 px-3.5 text-[14px] gap-2" };

export const buttonClass = (variant: Variant = "secondary", size: Size = "md", className?: string) =>
  cn(
    "inline-flex select-none items-center justify-center rounded-[8px] font-medium whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
    variants[variant], sizes[size], className,
  );

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant, size, className, ...props }, ref) {
    return <button ref={ref} type="button" className={buttonClass(variant, size, className)} {...props} />;
  },
);

// ---------------------------------------------------------------------------
// Chips
// ---------------------------------------------------------------------------

export type Tone = "neutral" | "accent" | "success" | "warn" | "danger" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-2",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  outline: "border border-border text-text-2",
};

export function Chip({ tone = "neutral", className, children, title }: { tone?: Tone; className?: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[12px] font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export function Avatar({ initials, title, size = 24, className }: { initials: string; title?: string; size?: number; className?: string }) {
  return (
    <span
      title={title}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-medium text-text-2 ring-1 ring-border", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials}
    </span>
  );
}

export const initialsOf = (name: string) =>
  name.replace(/^Dr\.\s*/, "").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

// ---------------------------------------------------------------------------
// Card / section
// ---------------------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-[12px] border border-border bg-surface", className)}>{children}</div>;
}

export function Section({ title, actions, children, className }: { title: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-[18px] font-medium">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[12px] text-text-3", className)}>{children}</div>;
}

export function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      <div className="truncate">{children}</div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-dashed border-border-strong px-6 py-10 text-center">
      <div className="font-serif text-[17px]">{title}</div>
      {children && <div className="mx-auto mt-1 max-w-md text-text-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-[12px] border border-border bg-surface", className)}>
      <table className="w-full border-collapse text-left text-[13px]">{children}</table>
    </div>
  );
}
export const THead = ({ children }: { children: React.ReactNode }) => (
  <thead className="border-b border-border text-[12px] text-text-3">{children}</thead>
);
export const TH = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
  <th className={cn("px-3 py-2 font-medium whitespace-nowrap", className)}>{children}</th>
);
export const TR = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <tr onClick={onClick} className={cn("border-b border-border last:border-b-0", onClick && "cursor-pointer hover:bg-surface-2/60", className)}>{children}</tr>
);
export const TD = ({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) => (
  <td colSpan={colSpan} className={cn("px-3 py-2 align-top", className)}>{children}</td>
);

// ---------------------------------------------------------------------------
// Links and tabs
// ---------------------------------------------------------------------------

export function TextLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("text-text hover:text-accent hover:underline underline-offset-2", className)} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}

export function TabNav({ tabs, active, base }: { tabs: { slug: string; label: string; badge?: React.ReactNode }[]; active: string; base: string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border" aria-label="Tabs">
      {tabs.map((t) => {
        const on = t.slug === active;
        return (
          <Link
            key={t.slug}
            href={`${base}/${t.slug}`}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] transition-colors",
              on ? "border-accent font-medium text-text" : "border-transparent text-text-2 hover:text-text",
            )}
          >
            {t.label}
            {t.badge}
          </Link>
        );
      })}
    </nav>
  );
}

export function PageHeader({ title, subtitle, actions, breadcrumb }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; breadcrumb?: React.ReactNode }) {
  return (
    <header className="space-y-1">
      {breadcrumb && <div className="text-[13px] text-text-3">{breadcrumb}</div>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-[30px] leading-tight font-medium">{title}</h1>
          {subtitle && <div className="mt-1 text-text-2">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
