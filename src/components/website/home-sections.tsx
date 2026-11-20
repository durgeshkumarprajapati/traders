import { ArrowRight, CircleCheck, ClipboardList, Store } from "lucide-react";
import Link from "next/link";
import { ContentPlaceholder } from "@/components/common/content-placeholder";
import { PageContainer } from "@/components/common/container";
import { Section } from "@/components/common/section";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { StockBadge } from "@/components/ui/status-badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { PRICE_DISCLAIMER, formatPrice, formatUpdated } from "@/features/products/format";
import type { Brand, Category, Product } from "@/features/products/types";
import { unitLabel } from "@/features/products/units";
import type { BusinessSettings } from "@/features/settings/business-settings";
import { generalEnquiryMessage } from "@/lib/whatsapp";
import { CategoryCard } from "./category-card";
import { ContactDetails } from "./contact-details";
import { WhatsAppButton } from "./contact-actions";
import { ProductCard } from "./product-card";

/** 2. Hero. No stat tiles or claims: those need owner-verified values. */
export function HeroSection({ settings }: { settings: BusinessSettings }) {
  return (
    <section aria-labelledby="hero-heading" className="py-section-lg">
      <PageContainer>
        <div className="max-w-3xl">
          <p className="text-label-md text-primary">{settings.name}</p>
          <h1 id="hero-heading" className="mt-2 text-display-lg-mobile md:text-display-lg">
            Building and construction materials, quoted to your site
          </h1>
          <p className="mt-gutter-md text-body-lg text-on-surface-variant">
            {settings.tagline ??
              "Browse indicative rates, then send a single-product or multi-product enquiry. The final rate is confirmed with you before any order."}
          </p>
          <div className="mt-gutter-lg flex flex-wrap gap-gutter-sm">
            <ButtonLink href="/products" size="lg">
              Explore products <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
            <ButtonLink href="/bulk-enquiry" size="lg" variant="secondary">
              Get a bulk quote
            </ButtonLink>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}

/** 3. Product categories. */
export function CategoriesSection({ categories }: { categories: Category[] }) {
  return (
    <Section
      id="categories"
      title="Product categories"
      description="Choose a category to see products and indicative rates."
      action={
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-label-lg text-primary hover:underline"
        >
          View all products <ArrowRight aria-hidden className="size-4" />
        </Link>
      }
    >
      <ul className="grid gap-gutter-md sm:grid-cols-2 lg:grid-cols-3">
        {[...categories]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((c) => (
            <li key={c.id}>
              <CategoryCard category={c} />
            </li>
          ))}
      </ul>
    </Section>
  );
}

/** 4. Featured products. */
export function FeaturedProductsSection({
  products,
  brands,
  categories,
  whatsappNumber,
}: {
  products: Product[];
  brands: Brand[];
  categories: Category[];
  whatsappNumber: string | null;
}) {
  const featured = products.filter((p) => p.isFeatured).slice(0, 4);
  return (
    <Section
      id="featured"
      title="Featured products"
      description="Selected materials from the catalogue."
    >
      {featured.length === 0 ? (
        <ContentPlaceholder>
          Featured products appear here once products are marked as featured.
        </ContentPlaceholder>
      ) : (
        <ul className="grid gap-gutter-md sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p) => (
            <li key={p.id}>
              <ProductCard
                product={p}
                brand={brands.find((b) => b.id === p.brandId)}
                category={categories.find((c) => c.id === p.categoryId)}
                whatsappNumber={whatsappNumber}
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** 5. Indicative rates table (never labelled "live"). */
export function RatesSection({
  products,
  brands,
  settings,
}: {
  products: Product[];
  brands: Brand[];
  settings: BusinessSettings;
}) {
  const rows = products.slice(0, 5);
  return (
    <Section
      id="rates"
      title="Indicative rates"
      description="Rates are shown with their unit and last-updated date when available."
    >
      <Table aria-describedby="rates-disclaimer">
        <caption className="sr-only">Indicative rates by product</caption>
        <THead>
          <Tr>
            <Th>Material</Th>
            <Th>Brand</Th>
            <Th>Indicative rate</Th>
            <Th>Unit</Th>
            <Th>Availability</Th>
            <Th>Last updated</Th>
            <Th>
              <span className="sr-only">Enquiry</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((p) => (
            <Tr key={p.id} interactive>
              <Td>
                <Link className="hover:text-primary hover:underline" href={`/products/${p.slug}`}>
                  {p.name}
                </Link>
              </Td>
              <Td>{brands.find((b) => b.id === p.brandId)?.name ?? "—"}</Td>
              <Td>
                {formatPrice(p.price) ?? (
                  <span className="text-on-surface-variant">Rate on request</span>
                )}
              </Td>
              <Td>{unitLabel(p.unit)}</Td>
              <Td>
                <StockBadge status={p.stockStatus} />
              </Td>
              <Td>{formatUpdated(p.updatedAt) ?? "—"}</Td>
              <Td>
                <WhatsAppButton
                  hideIfUnavailable
                  size="sm"
                  number={settings.whatsappNumber}
                  message={`Hello, I would like a rate for ${p.name}.`}
                >
                  Quote <span className="sr-only">for {p.name}</span>
                </WhatsAppButton>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
      <p id="rates-disclaimer" className="mt-gutter-md text-body-sm text-on-surface-variant">
        {PRICE_DISCLAIMER}
      </p>
    </Section>
  );
}

/** 6. Why choose us — ONLY the owner-written statements from business settings; hidden when none are configured. */
export function WhyChooseUsSection({ items }: { items: { title: string; description: string }[] }) {
  if (items.length === 0) return null;
  return (
    <Section id="why" title="Why choose us">
      <ul className="grid gap-gutter-md sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.title}>
            <Card className="h-full">
              <CardBody className="flex gap-gutter-md">
                <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <h3 className="text-title-md">{item.title}</h3>
                  <p className="mt-1 text-body-md text-on-surface-variant">{item.description}</p>
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** 7. Brands — from the Brands sheet; no dealership relationship is implied. */
export function BrandsSection({ brands }: { brands: Brand[] }) {
  return (
    <Section id="brands" title="Brands" description="Brands available in the catalogue.">
      {brands.length === 0 ? (
        <ContentPlaceholder icon={<Store />}>
          Brands appear here once they are added to the catalogue.
        </ContentPlaceholder>
      ) : (
        <ul className="flex flex-wrap gap-gutter-sm">
          {brands.map((b) => (
            <li key={b.id}>
              <Badge
                tone="neutral"
                appearance="outline"
                className="px-gutter-md py-gutter-sm text-label-lg"
              >
                {b.logoUrl && (
                  <Image
                    src={b.logoUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="size-6 object-contain"
                  />
                )}
                {b.name}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** 8. Bulk enquiry CTA — white bordered card with navy/amber accents (not a full-width navy band). */
export function BulkEnquiryCtaSection({ settings }: { settings: BusinessSettings }) {
  return (
    <section aria-labelledby="bulk-cta-heading" className="border-t border-border py-section-md">
      <PageContainer>
        <div className="flex flex-col gap-gutter-lg rounded-lg border-2 border-primary p-gutter-lg md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2
              id="bulk-cta-heading"
              className="flex items-center gap-gutter-sm text-headline-lg-mobile md:text-headline-lg"
            >
              <ClipboardList aria-hidden className="size-6 text-primary" /> Planning a larger
              requirement?
            </h2>
            <p className="mt-2 text-body-lg text-on-surface-variant">
              Put several materials into one enquiry. We will come back to you with a quotation; no
              payment is taken online.
            </p>
          </div>
          <div className="flex flex-wrap gap-gutter-sm">
            <ButtonLink href="/bulk-enquiry" size="lg" variant="secondary">
              Request bulk quotation
            </ButtonLink>
            <WhatsAppButton
              hideIfUnavailable
              number={settings.whatsappNumber}
              message={generalEnquiryMessage(settings.name)}
              size="lg"
              variant="outline"
            >
              WhatsApp
            </WhatsAppButton>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}

/** 9. Contact information (settings-driven). */
export function ContactInfoSection({ settings }: { settings: BusinessSettings }) {
  return (
    <Section
      id="contact-info"
      title="Contact"
      description="How to reach us."
      action={
        <ButtonLink href="/contact" variant="outline" size="sm">
          Contact page
        </ButtonLink>
      }
    >
      <ContactDetails settings={settings} />
    </Section>
  );
}
