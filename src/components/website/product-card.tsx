import Link from "next/link";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { StockBadge } from "@/components/ui/status-badge";
import type { Brand, Category, Product } from "@/features/products/types";
import { unitLabel } from "@/features/products/units";
import { normalizeWhatsAppNumber, productEnquiryMessage } from "@/lib/whatsapp";
import { AddToEnquiryButton } from "./add-to-enquiry-button";
import { WhatsAppButton } from "./contact-actions";
import { ProductImage } from "./product-image";
import { RateDisplay } from "./rate-display";

/** Reusable product card (home featured, listing, related products). */
export function ProductCard({
  product,
  brand,
  category,
  whatsappNumber,
  headingLevel = 3,
}: {
  product: Product;
  brand?: Brand;
  category?: Category;
  whatsappNumber: string | null;
  headingLevel?: 2 | 3;
}) {
  const Heading = `h${headingLevel}` as const;
  return (
    <Card className="flex h-full flex-col overflow-hidden transition-all duration-200 hover:border-primary hover:shadow-xs">
      <div className="relative flex h-48 items-center justify-center border-b border-border bg-surface-muted p-4">
        <div className="absolute top-3 left-3 z-10">
          <StockBadge status={product.stockStatus} />
        </div>
        <span className="absolute top-3 right-3 text-label-sm font-medium text-on-surface-variant">
          Indicative Rate
        </span>
        <ProductImage src={product.imageUrl} name={product.name} />
      </div>
      <CardBody className="flex flex-1 flex-col justify-between p-5">
        <div>
          <div className="mb-1 flex items-center justify-between text-body-sm text-on-surface-variant">
            <span>{brand?.name ?? category?.name}</span>
            {product.sku && <span className="text-label-sm">SKU: {product.sku}</span>}
          </div>
          <Heading className="text-title-lg font-bold text-on-surface">
            <Link
              href={`/products/${product.slug}`}
              className="transition-colors hover:text-primary hover:underline"
            >
              {product.name}
            </Link>
          </Heading>
          <div className="mt-3">
            <RateDisplay product={product} />
          </div>
        </div>
      </CardBody>
      <CardFooter className="flex-wrap gap-2 border-t border-border pt-3">
        <ButtonLink href={`/products/${product.slug}`} variant="outline" size="sm">
          View details<span className="sr-only">: {product.name}</span>
        </ButtonLink>
        <AddToEnquiryButton productId={product.id} productName={product.name} />
        {normalizeWhatsAppNumber(whatsappNumber) && (
          <WhatsAppButton
            size="sm"
            number={whatsappNumber}
            message={productEnquiryMessage({
              productName: product.name,
              brandName: brand?.name,
              sku: product.sku,
              unitLabel: unitLabel(product.unit),
            })}
          >
            WhatsApp <span className="sr-only">enquiry: {product.name}</span>
          </WhatsAppButton>
        )}
      </CardFooter>
    </Card>
  );
}
