import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function Spinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center", className)}>
      <Loader2
        aria-hidden
        className="size-5 animate-spin text-primary motion-reduce:animate-none"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded bg-surface-muted motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

/** Empty / error placeholder block. `tone="error"` for failed loads. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "empty",
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "empty" | "error";
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center gap-gutter-sm rounded-md border border-dashed border-border p-section-md text-center",
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden
          className={cn(
            "[&>svg]:size-8",
            tone === "error" ? "text-error" : "text-on-surface-variant",
          )}
        >
          {icon}
        </span>
      )}
      <h3 className="text-title-lg">{title}</h3>
      {description && (
        <p className="max-w-md text-body-md text-on-surface-variant">{description}</p>
      )}
      {action && <div className="mt-gutter-sm">{action}</div>}
    </div>
  );
}
