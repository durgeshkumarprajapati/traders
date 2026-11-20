import { CloudOff, PackageSearch } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

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
