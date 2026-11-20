import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * RECONSTRUCTED (no card.html sticker sheet supplied). Inferred from page markup:
 * - elevated: white surface, hairline border (spec forbids card drop-shadows)
 * - action: card with a footer action area
 * - interactive: whole card is a link; border darkens to primary on hover
 */
const base = "rounded-md border border-border bg-surface";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn(base, className)} {...props} />;
}
export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("border-b border-border p-gutter-md", className)} {...props} />;
}
export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("text-title-lg", className)} {...props} />;
}
export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-gutter-md", className)} {...props} />;
}
/** Footer holding the card's actions (the "action" card variant). */
export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-gutter-sm border-t border-border p-gutter-md",
        className,
      )}
      {...props}
    />
  );
}
export function InteractiveCard({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(base, "block p-gutter-md transition-colors hover:border-primary", className)}
      {...props}
    />
  );
}
