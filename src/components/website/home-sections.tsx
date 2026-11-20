import {
  ArrowRight,
  BadgePercent,
  ChevronRight,
  ClipboardList,
  MapPin,
  ShieldCheck,
  Store,
  TrendingUp,
  Truck,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ContentPlaceholder } from "@/components/common/content-placeholder";
import { PageContainer } from "@/components/common/container";
import { Section } from "@/components/common/section";
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
      description="Select a category to compare brands, technical grades, and indicative depot rates."
      action={
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-label-lg font-semibold text-primary hover:underline"
        >
          <span>View Full Catalog</span>
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      }
    >
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 items-stretch">
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
      description="High-demand structural essentials ready for immediate yard loading."
      action={
        <ButtonLink href="/products" variant="outline" size="sm">
          View All Products
        </ButtonLink>
      }
    >
      {featured.length === 0 ? (
        <ContentPlaceholder>
          Featured products appear here once products are marked as featured.
        </ContentPlaceholder>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

/** 5. Indicative rates table. */
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
      description="Daily benchmark rates for primary wholesale construction commodities."
      action={
        <div className="inline-flex items-center gap-1.5 text-label-sm font-semibold uppercase tracking-wider text-primary">
          <TrendingUp aria-hidden className="size-4" />
          <span>Depot Benchmark Board</span>
        </div>
      }
    >
      <div className="mb-6 max-w-xl rounded-md border border-warning/30 bg-warning/10 p-3.5 text-body-sm text-on-surface shadow-xs">
        <strong className="block font-semibold mb-0.5">Indicative Price Disclaimer:</strong>
        All rates shown are non-binding estimates based on depot benchmark data. Final site delivery
        rates vary with haulage distance, volume thresholds, and applicable GST taxes.
      </div>

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
                <Link
                  className="font-medium hover:text-primary hover:underline"
                  href={`/products/${p.slug}`}
                >
                  {p.name}
                </Link>
              </Td>
              <Td>{brands.find((b) => b.id === p.brandId)?.name ?? "—"}</Td>
              <Td className="tabular-nums font-semibold text-primary">
                {formatPrice(p.price) ?? (
                  <span className="font-normal text-on-surface-variant">Rate on request</span>
                )}
              </Td>
              <Td>{unitLabel(p.unit)}</Td>
              <Td>
                <StockBadge status={p.stockStatus} />
              </Td>
              <Td className="tabular-nums text-on-surface-variant">
                {formatUpdated(p.updatedAt) ?? "—"}
              </Td>
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
    <Section
      id="why"
      title="Why choose us"
      description="Built on straightforward commercial ethics, authentic material grades, and dedicated contractor logistics."
    >
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
        {items.map((item, idx) => {
          const icons = [ShieldCheck, BadgePercent, Store, Truck];
          const Icon = icons[idx % icons.length];
          const iconBg =
            idx % 2 === 0 ? "bg-primary/10 text-primary" : "bg-secondary/20 text-warning";
          return (
            <li key={item.title}>
              <Card className="h-full transition-all duration-200 hover:border-primary hover:shadow-xs">
                <CardBody className="flex flex-col gap-3 p-6">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-md ${iconBg}`}
                  >
                    <Icon className="size-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-title-lg font-bold text-on-surface">{item.title}</h3>
                  <p className="text-body-sm leading-relaxed text-on-surface-variant">
                    {item.description}
                  </p>
                </CardBody>
              </Card>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** 7. Brands — from the Brands sheet; no dealership relationship is implied. */
export function BrandsSection({ brands }: { brands: Brand[] }) {
  if (brands.length === 0) return null;
  return (
    <Section id="brands" title="Brands" description="Brands available in the catalogue.">
      <ul className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
        {brands.map((b) => (
          <li key={b.id}>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-5 py-3 text-label-lg font-bold tracking-wider text-on-surface shadow-xs transition-colors hover:border-primary">
              {b.logoUrl && (
                <Image
                  src={b.logoUrl}
                  alt=""
                  width={24}
                  height={24}
                  className="size-6 object-contain"
                />
              )}
              <span className="uppercase">{b.name}</span>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** 8. Bulk enquiry CTA — high-impact navy card matching the reference template. */
export function BulkEnquiryCtaSection({ settings }: { settings: BusinessSettings }) {
  return (
    <section aria-labelledby="bulk-cta-heading" className="border-t border-border py-section-md">
      <PageContainer>
        <div className="flex flex-col gap-gutter-lg rounded-lg border border-primary/20 bg-primary p-8 text-on-primary shadow-md lg:p-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <span className="mb-4 inline-block rounded bg-secondary px-3 py-1 font-label text-label-sm font-semibold text-on-secondary">
              Bulk Procurement Desk
            </span>
            <h2
              id="bulk-cta-heading"
              className="flex items-center gap-gutter-sm text-headline-xl-mobile md:text-headline-xl font-bold text-on-primary"
            >
              <ClipboardList aria-hidden className="size-7 text-secondary" /> Planning a Major
              Construction Project?
            </h2>
            <p className="mt-3 text-body-lg text-on-primary/85">
              Consolidate your cement, steel, masonry blocks, and sand requirements into one
              multi-material quotation with staggered site delivery scheduling.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <ButtonLink href="/bulk-enquiry" size="lg" variant="secondary" className="shadow-xs">
              Request bulk quotation
            </ButtonLink>
            <WhatsAppButton
              hideIfUnavailable
              number={settings.whatsappNumber}
              message={generalEnquiryMessage(settings.name)}
              size="lg"
              variant="outline"
              className="border-on-primary/30 text-on-primary hover:bg-on-primary/10"
            >
              WhatsApp Desk
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
      description="Our weighbridge and material yard are open for direct contractor inspection and dispatch."
      action={
        <ButtonLink href="/contact" variant="outline" size="sm">
          Contact page
        </ButtonLink>
      }
    >
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        <div className="lg:col-span-7">
          <ContactDetails settings={settings} />
        </div>
        {settings.googleMapsUrl && (
          <div className="lg:col-span-5 rounded-lg border border-border bg-surface p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <MapPin className="size-5" />
              </div>
              <h3 className="text-title-lg font-bold text-on-surface">Depot &amp; Weighbridge</h3>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Physical location verified for heavy commercial truck loading and material sampling.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <a
                href={settings.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-label-md font-semibold text-primary hover:underline"
              >
                Open in Google Maps <ChevronRight className="size-4" aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
