import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export type Tone = "primary" | "secondary" | "success" | "warning" | "error" | "info" | "neutral";

const toneSolid: Record<Tone, string> = {
  primary: "bg-primary text-on-primary",
  secondary: "bg-secondary text-on-secondary",
  success: "bg-success text-on-success",
  warning: "bg-warning text-on-warning",
  error: "bg-error text-on-error",
  info: "bg-info text-on-info",
  neutral: "bg-surface-muted text-on-surface",
};
const toneOutline: Record<Tone, string> = {
  primary: "border-primary text-primary",
  secondary: "border-secondary text-on-surface",
  success: "border-success text-success",
  warning: "border-warning text-warning",
  error: "border-error text-error",
  info: "border-info text-info",
  neutral: "border-border text-on-surface-variant",
};
export const toneDot: Record<Tone, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
  neutral: "bg-on-surface-variant",
};

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm text-label-md whitespace-nowrap",
  {
    variants: {
      appearance: { solid: "px-2 py-0.5", outline: "border bg-surface px-2 py-0.5" },
    },
    defaultVariants: { appearance: "solid" },
  },
);

type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { tone?: Tone };

/** Status badge (text label). */
export function Badge({ tone = "neutral", appearance, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        badgeVariants({ appearance }),
        appearance === "outline" ? toneOutline[tone] : toneSolid[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Numeric badge, e.g. "12" next to a nav item. */
export function CountBadge({
  count,
  max = 99,
  tone = "secondary",
  className,
  ...props
}: Omit<ComponentProps<"span">, "children"> & { count: number; max?: number; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-label-sm",
        toneSolid[tone],
        className,
      )}
      {...props}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}

/** Dot badge: coloured dot + label. The dot is decorative; the label carries the meaning. */
export function DotBadge({
  tone = "neutral",
  className,
  children,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-label-md text-on-surface", className)}
      {...props}
    >
      <span aria-hidden className={cn("size-2 rounded-full", toneDot[tone])} />
      {children}
    </span>
  );
}
