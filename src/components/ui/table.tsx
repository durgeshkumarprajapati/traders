"use client";

import { createContext, useContext, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Stacked mode (`<Table stacked>`): below `md` every row becomes a labelled card instead of a squeezed
 * multi-column table, so no data is hidden and nothing needs horizontal scrolling. Give each `Td` a
 * `label` (shown above its value on phones). Explicit ARIA roles keep the table semantics when the
 * elements are no longer displayed as a table. Without `stacked`, the table scrolls inside its wrapper.
 */
const StackedContext = createContext(false);

/** Scroll wrapper + table. Header cells are `Th`, rows `Tr`. Use `interactive` rows for clickable/hover rows. */
export function Table({
  className,
  stacked = false,
  ...props
}: ComponentProps<"table"> & { stacked?: boolean }) {
  return (
    <StackedContext.Provider value={stacked}>
      <div className="w-full overflow-x-auto rounded-md border border-border">
        <table
          role={stacked ? "table" : undefined}
          className={cn(
            "w-full border-collapse text-left text-body-md",
            stacked && "max-md:block",
            className,
          )}
          {...props}
        />
      </div>
    </StackedContext.Provider>
  );
}
export function THead({ className, ...props }: ComponentProps<"thead">) {
  const stacked = useContext(StackedContext);
  return (
    <thead
      role={stacked ? "rowgroup" : undefined}
      className={cn("bg-surface-muted", stacked && "max-md:sr-only", className)}
      {...props}
    />
  );
}
export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  const stacked = useContext(StackedContext);
  return (
    <tbody
      role={stacked ? "rowgroup" : undefined}
      className={cn("divide-y divide-border", stacked && "max-md:block", className)}
      {...props}
    />
  );
}
export function Tr({
  interactive,
  selected,
  className,
  ...props
}: ComponentProps<"tr"> & { interactive?: boolean; selected?: boolean }) {
  const stacked = useContext(StackedContext);
  return (
    <tr
      role={stacked ? "row" : undefined}
      aria-selected={selected}
      className={cn(
        "bg-surface",
        stacked && "max-md:block max-md:p-gutter-md",
        interactive && "transition-colors hover:bg-surface-muted",
        selected && "bg-surface-muted",
        className,
      )}
      {...props}
    />
  );
}
export function Th({ className, scope = "col", ...props }: ComponentProps<"th">) {
  const stacked = useContext(StackedContext);
  return (
    <th
      role={stacked ? "columnheader" : undefined}
      scope={scope}
      className={cn(
        "border-b border-border px-gutter-md py-gutter-sm text-label-md whitespace-nowrap text-on-surface-variant",
        className,
      )}
      {...props}
    />
  );
}
export function Td({
  className,
  label,
  ...props
}: ComponentProps<"td"> & {
  /** Column name shown above the value in stacked (phone) layout. */ label?: string;
}) {
  const stacked = useContext(StackedContext);
  return (
    <td
      role={stacked ? "cell" : undefined}
      data-label={label}
      className={cn(
        "px-gutter-md py-gutter-sm align-middle",
        stacked &&
          "max-md:block max-md:px-0 max-md:py-gutter-xs max-md:whitespace-normal max-md:text-left",
        stacked &&
          label &&
          "max-md:before:mb-0.5 max-md:before:block max-md:before:text-label-md max-md:before:text-on-surface-variant max-md:before:content-[attr(data-label)]",
        className,
      )}
      {...props}
    />
  );
}
