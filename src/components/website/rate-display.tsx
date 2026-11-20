import { formatRate, formatUpdated } from "@/features/products/format";
import type { Product } from "@/features/products/types";
import { cn } from "@/lib/cn";

/**
 * Indicative rate with unit and last-updated date. A product with no valid price shows
 * "Rate on request" — never 0 and never a stale/made-up value. Pair with PRICE_DISCLAIMER.
 */
export function RateDisplay({
  product,
  size = "md",
  className,
}: {
  product: Pick<Product, "price" | "unit" | "updatedAt">;
  size?: "md" | "lg";
  className?: string;
}) {
  const rate = formatRate(product.price, product.unit);
  const updated = formatUpdated(product.updatedAt);
  return (
    <div className={className}>
      <p
        className={cn(
          rate ? "text-on-surface" : "text-on-surface-variant",
          size === "lg" ? "text-headline-md" : "text-title-lg",
        )}
      >
        <span className="sr-only">Indicative rate: </span>
        {rate ?? "Rate on request"}
      </p>
      {updated && <p className="text-body-sm text-on-surface-variant">Updated: {updated}</p>}
    </div>
  );
}
