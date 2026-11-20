import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Scroll wrapper + table. Header cells are `Th`, rows `Tr`. Use `interactive` rows for clickable/hover rows. */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto rounded-md border border-border">
      <table
        className={cn("w-full border-collapse text-left text-body-md", className)}
        {...props}
      />
    </div>
  );
}
export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("bg-surface-muted", className)} {...props} />;
}
export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}
export function Tr({
  interactive,
  selected,
  className,
  ...props
}: ComponentProps<"tr"> & { interactive?: boolean; selected?: boolean }) {
  return (
    <tr
      aria-selected={selected}
      className={cn(
        "bg-surface",
        interactive && "transition-colors hover:bg-surface-muted",
        selected && "bg-surface-muted",
        className,
      )}
      {...props}
    />
  );
}
export function Th({ className, scope = "col", ...props }: ComponentProps<"th">) {
  return (
    <th
      scope={scope}
      className={cn(
        "border-b border-border px-gutter-md py-gutter-sm text-label-md whitespace-nowrap text-on-surface-variant",
        className,
      )}
      {...props}
    />
  );
}
export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-gutter-md py-gutter-sm align-middle", className)} {...props} />;
}
