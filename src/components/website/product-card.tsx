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
    <Card className="flex h-full flex-col">
      <CardBody className="flex flex-1 flex-col gap-gutter-sm">
        <ProductImage src={product.imageUrl} name={product.name} />
        <div className="flex items-center justify-between gap-gutter-sm">
          <p className="text-label-md text-on-surface-variant">{brand?.name ?? category?.name}</p>
          <StockBadge status={product.stockStatus} />
        </div>
        <Heading className="text-title-lg">
          <Link href={`/products/${product.slug}`} className="hover:text-primary hover:underline">
            {product.name}
          </Link>
        </Heading>
        {product.sku && <p className="text-body-sm text-on-surface-variant">SKU: {product.sku}</p>}
        <RateDisplay product={product} className="mt-auto" />
      </CardBody>
      <CardFooter className="flex-wrap">
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
