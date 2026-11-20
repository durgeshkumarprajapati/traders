import Link from "next/link";
import { PageContainer } from "@/components/common/container";
import { websiteNav } from "@/config/navigation";
import { PRICE_DISCLAIMER } from "@/features/products/format";
import type { Category } from "@/features/products/types";
import type { BusinessSettings } from "@/features/settings/business-settings";

const link = "text-on-surface-variant transition-colors hover:text-primary hover:underline";

/** Footer content comes from business settings and the catalogue; nothing is hard-coded business data. */
export function SiteFooter({
  settings,
  categories,
}: {
  settings: BusinessSettings;
  categories: Category[];
}) {
  return (
    <footer className="mt-auto border-t border-border bg-surface-muted">
      <PageContainer className="grid gap-gutter-xl py-section-md sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-title-lg text-primary">{settings.name}</p>
          {settings.tagline && (
            <p className="mt-2 text-body-md text-on-surface-variant">{settings.tagline}</p>
          )}
          {settings.gstNumber && (
            <p className="mt-2 text-body-sm text-on-surface-variant">GSTIN: {settings.gstNumber}</p>
          )}
        </div>
        <nav aria-label="Footer quick links">
          <h2 className="text-title-md">Quick links</h2>
          <ul className="mt-gutter-sm space-y-gutter-sm text-body-md">
            {websiteNav.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className={link}>
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Footer categories">
          <h2 className="text-title-md">Materials</h2>
          <ul className="mt-gutter-sm space-y-gutter-sm text-body-md">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/products?category=${c.slug}`} className={link}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="text-title-md">Contact</h2>
          <ul className="mt-gutter-sm space-y-gutter-sm text-body-md text-on-surface-variant">
            {settings.phone && <li>{settings.phone}</li>}
            {settings.email && <li>{settings.email}</li>}
            {settings.address && <li className="whitespace-pre-line">{settings.address}</li>}
            {settings.businessHours && (
              <li className="whitespace-pre-line">{settings.businessHours}</li>
            )}
            {Object.entries(settings.social).map(([network, url]) => (
              <li key={network}>
                <a href={url} target="_blank" rel="noopener noreferrer" className={link}>
                  {network.charAt(0).toUpperCase() + network.slice(1)}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
            <li>
              <Link href="/contact" className={link}>
                Contact page
              </Link>
            </li>
          </ul>
        </div>
      </PageContainer>
      <div className="border-t border-border">
        <PageContainer className="space-y-1 py-gutter-md text-body-sm text-on-surface-variant">
          <p>{PRICE_DISCLAIMER}</p>
          <p>© {settings.name}</p>
        </PageContainer>
      </div>
    </footer>
  );
}
