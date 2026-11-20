import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PageContainer } from "./container";

/** Page section with an h2 and consistent vertical rhythm. Sections are separated by hairlines, not coloured bands. */
export function Section({
  id,
  title,
  description,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={cn("border-t border-border py-section-md", className)}
    >
      <PageContainer>
        <div className="mb-gutter-lg flex flex-wrap items-end justify-between gap-gutter-md">
          <div>
            <h2 id={`${id}-heading`} className="text-headline-lg-mobile md:text-headline-lg">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-body-lg text-on-surface-variant">{description}</p>
            )}
          </div>
          {action}
        </div>
        {children}
      </PageContainer>
    </section>
  );
}
