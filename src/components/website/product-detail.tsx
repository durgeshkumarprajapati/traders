import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/common/container";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { StockBadge } from "@/components/ui/status-badge";
import { Table, TBody, Td, Th, Tr } from "@/components/ui/table";
import { findProductBySlug, relatedProducts } from "@/features/catalogue/view";
import { loadCatalogue } from "@/features/catalogue/server";
import { PRICE_DISCLAIMER } from "@/features/products/format";
import { unitLabel } from "@/features/products/units";
import { CatalogueFallbackNotice, CatalogueUnavailable } from "./catalogue-states";
import { ProductCard } from "./product-card";
import { ProductEnquiryPanel } from "./product-enquiry-panel";
import { ProductImage } from "./product-image";
import { RateDisplay } from "./rate-display";

type Params = Promise<{ slug: string }>;

/** Title/description from the real product; generic when missing, inactive or the sheet is unavailable. */
export async function productMetadata(params: Params): Promise<Metadata> {
  const { slug } = await params;
  const load = await loadCatalogue();
  const product = load.ok ? findProductBySlug(load.catalogue, slug) : undefined;
  if (!product) return { title: "Product" };
  const desc = product.description.slice(0, 160) || undefined;
  return {
    title: product.name,
    description: desc,
    alternates: {
      canonical: `/products/${product.slug}`,
    },
    openGraph: {
      title: product.name,
      description: desc,
      ...(product.imageUrl ? { images: [{ url: product.imageUrl }] } : {}),
    },
  };
}

/**
 * Product page body (server component; render inside <Suspense>). The slug is untrusted: it must look
 * like a slug and match an ACTIVE product in the validated public catalogue, otherwise `notFound()`.
 */
export async function ProductDetail({ params }: { params: Params }) {
  const { slug } = await params;
  const load = await loadCatalogue();

  if (!load.ok) {
    return (
      <PageContainer className="pb-section-lg">
        <div className="pt-gutter-lg">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Products", href: "/products" },
              { label: "Product" },
            ]}
          />
        </div>
        <CatalogueUnavailable className="mt-gutter-lg" />
      </PageContainer>
    );
  }

  const product = findProductBySlug(load.catalogue, slug);
  if (!product) notFound();

  const { catalogue, settings } = load;
  const brand = product.brandId
    ? catalogue.brands.find((b) => b.id === product.brandId)
    : undefined;
  const category = catalogue.categories.find((c) => c.id === product.categoryId);
  const related = relatedProducts(catalogue, product);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    ...(category ? { category: category.name } : {}),
    ...(brand ? { brand: { "@type": "Brand", name: brand.name } } : {}),
    ...(typeof product.price === "number" && product.price > 0
      ? {
          offers: {
            "@type": "Offer",
            price: product.price,
            priceCurrency: "INR",
            availability:
              product.stockStatus === "IN_STOCK"
                ? "https://schema.org/InStock"
                : product.stockStatus === "OUT_OF_STOCK"
                  ? "https://schema.org/OutOfStock"
                  : product.stockStatus === "AVAILABLE_ON_ORDER" ||
                      product.stockStatus === "LIMITED_STOCK"
                    ? "https://schema.org/PreOrder"
                    : undefined,
          },
        }
      : {}),
  };

  return (
    <PageContainer className="pb-section-lg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="pt-gutter-lg">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            ...(category
              ? [{ label: category.name, href: `/products?category=${category.slug}` }]
              : []),
            { label: product.name },
          ]}
        />
      </div>
      {load.source === "STATIC" && <CatalogueFallbackNotice className="mt-gutter-md" />}
      <div className="mt-gutter-lg grid grid-cols-1 gap-gutter-xl lg:grid-cols-2">
        <ProductImage
          src={product.imageUrl}
          name={product.name}
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
        <div className="space-y-gutter-md">
          <p className="text-label-md text-on-surface-variant">{brand?.name ?? category?.name}</p>
          <h1 className="text-headline-lg-mobile md:text-headline-xl">{product.name}</h1>
          <div className="flex flex-wrap items-center gap-gutter-md">
            <StockBadge status={product.stockStatus} />
            {product.sku && (
              <span className="text-body-sm text-on-surface-variant">SKU: {product.sku}</span>
            )}
          </div>
          <RateDisplay product={product} size="lg" />
          <p className="text-body-sm text-on-surface-variant">{PRICE_DISCLAIMER}</p>
          {product.description && (
            <p className="text-body-lg whitespace-pre-line">{product.description}</p>
          )}
          <ProductEnquiryPanel
            productId={product.id}
            productName={product.name}
            brandName={brand?.name ?? null}
            sku={product.sku}
            unit={unitLabel(product.unit)}
            whatsappNumber={settings.whatsappNumber}
            businessEmail={settings.email}
            businessPhone={settings.phone}
          />
        </div>
      </div>

      {product.specifications.length > 0 && (
        <section aria-labelledby="specs-heading" className="mt-section-md">
          <h2
            id="specs-heading"
            className="mb-gutter-md text-headline-lg-mobile md:text-headline-lg"
          >
            Specifications
          </h2>
          <Table>
            <caption className="sr-only">Specifications for {product.name}</caption>
            <TBody>
              {product.specifications.map((s) => (
                <Tr key={s.label}>
                  <Th
                    scope="row"
                    className="w-2/5 bg-surface-muted align-top whitespace-normal sm:w-1/3"
                  >
                    {s.label}
                  </Th>
                  <Td>{s.value}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-section-md">
          <h2
            id="related-heading"
            className="mb-gutter-md text-headline-lg-mobile md:text-headline-lg"
          >
            Related products
          </h2>
          <ul className="grid grid-cols-1 gap-gutter-md sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <li key={p.id}>
                <ProductCard
                  product={p}
                  brand={p.brandId ? catalogue.brands.find((b) => b.id === p.brandId) : undefined}
                  category={category}
                  whatsappNumber={settings.whatsappNumber}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
