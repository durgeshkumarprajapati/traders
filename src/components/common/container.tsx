import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Public/page container: max-w-7xl (1280px) with 16–32px gutters (spec: Layout & Spacing). */
export function PageContainer({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-7xl px-gutter-md md:px-gutter-lg lg:px-gutter-xl",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeading({ title, description }: { title: string; description?: string }) {
  return (
    <header className="py-section-sm">
      <h1 className="text-headline-lg-mobile md:text-headline-xl">{title}</h1>
      {description && <p className="mt-2 text-body-lg text-on-surface-variant">{description}</p>}
    </header>
  );
}
