import type { ReactNode } from "react";
import { FileQuestion } from "lucide-react";
import { cn } from "@/lib/cn";

/** Clearly-labelled stand-in for business content that has not been supplied yet (never invented). */
export function ContentPlaceholder({
  children,
  className,
  icon,
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-gutter-sm rounded-md border border-dashed border-border p-gutter-md text-body-md text-on-surface-variant",
        className,
      )}
    >
      <span aria-hidden className="mt-0.5 shrink-0 [&>svg]:size-5">
        {icon ?? <FileQuestion />}
      </span>
      <p>
        <strong className="text-on-surface">Placeholder.</strong> {children}
      </p>
    </div>
  );
}
