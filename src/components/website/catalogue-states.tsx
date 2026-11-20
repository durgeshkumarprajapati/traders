import { CloudOff, Info, PackageSearch } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";

/**
 * Non-blocking indicator displayed when the website is showing the static fallback catalogue.
 * Explains data limitation without alarming the customer or making the application look broken.
 */
export function CatalogueFallbackNotice({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "mb-gutter-md flex items-center gap-2 rounded-md border border-outline-variant bg-surface-variant/40 px-3.5 py-2.5 text-body-sm text-on-surface-variant",
        className,
      )}
    >
      <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span>
        Showing our general product catalogue. Please confirm current rates and availability with
        our team.
      </span>
    </div>
  );
}

/**
 * Shown when the spreadsheet cannot be read. Honest and generic: no sample products, no stale
 * data, no technical detail. (The cause is logged server-side.)
 */
export function CatalogueUnavailable({ className }: { className?: string }) {
  return (
    <EmptyState
      tone="error"
      icon={<CloudOff />}
      title="Product information is temporarily unavailable"
      description="We could not load our catalogue right now. Please try again in a few minutes, or contact us for a quotation."
      action={<ButtonLink href="/contact">Contact us</ButtonLink>}
      className={className}
    />
  );
}

/** The spreadsheet was read successfully but contains no active products yet (different from a failure). */
export function CatalogueEmpty({ className }: { className?: string }) {
  return (
    <EmptyState
      icon={<PackageSearch />}
      title="No products are listed yet"
      description="Our catalogue is being updated. You can still send us an enquiry and we will get back to you."
      action={<ButtonLink href="/contact">Send an enquiry</ButtonLink>}
      className={className}
    />
  );
}
