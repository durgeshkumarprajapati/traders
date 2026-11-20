import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageContainer } from "@/components/common/container";
import { websiteNav } from "@/config/navigation";
import { PRICE_DISCLAIMER } from "@/features/products/format";
import type { Category } from "@/features/products/types";
import type { BusinessSettings } from "@/features/settings/business-settings";

const link =
  "inline-flex min-h-7 items-center text-on-surface-variant transition-colors hover:text-primary hover:underline pointer-coarse:min-h-11";

/** Footer content comes from business settings and the catalogue; nothing is hard-coded business data. */
export function SiteFooter({
  settings,
  categories,
}: {
  settings: BusinessSettings;
  categories: Category[];
}) {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <PageContainer className="grid grid-cols-1 gap-8 py-12 md:grid-cols-2 lg:grid-cols-5 [&>*]:min-w-0">
        <div className="lg:col-span-2">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-secondary">
              <Building2 className="size-5" aria-hidden="true" />
            </div>
            <span className="text-headline-sm font-bold text-primary">{settings.name}</span>
          </div>
          <p className="mb-4 max-w-sm text-body-md leading-relaxed text-on-surface-variant md:text-body-sm">
            {settings.tagline ??
              "Wholesale and retail supplier of certified construction materials, structural steel, Portland cement, bricks, and infrastructure plumbing supplies."}
          </p>
          {settings.gstNumber && (
            <span className="inline-block rounded-md border border-border bg-surface-muted px-2.5 py-1 text-label-sm text-on-surface-variant">
              GSTIN: {settings.gstNumber}
            </span>
          )}
        </div>

        <nav aria-label="Footer quick links">
          <h2 className="mb-4 text-title-md font-bold text-on-surface">Quick links</h2>
          <ul className="space-y-1 text-body-md md:text-body-sm">
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
          <h2 className="mb-4 text-title-md font-bold text-on-surface">Materials</h2>
          <ul className="space-y-1 text-body-md md:text-body-sm">
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
          <h2 className="mb-4 text-title-md font-bold text-on-surface">Contact</h2>
          <ul className="space-y-2.5 text-body-md text-on-surface-variant [overflow-wrap:anywhere] md:text-body-sm">
            {settings.phone && (
              <li>
                <a href={`tel:${settings.phone.replace(/[^0-9+]/g, "")}`} className={link}>
                  {settings.phone}
                </a>
              </li>
            )}
            {settings.email && (
              <li>
                <a href={`mailto:${settings.email}`} className={link}>
                  {settings.email}
                </a>
              </li>
            )}
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
              <Link href="/contact" className="font-semibold text-primary hover:underline">
                Contact page
              </Link>
            </li>
          </ul>
        </div>
      </PageContainer>

      <div className="border-t border-border bg-surface-muted">
        <PageContainer className="flex flex-col gap-2 py-4 text-body-md text-on-surface-variant md:text-body-sm md:flex-row md:items-center md:justify-between">
          <p>© {settings.name}. All rights reserved.</p>
          <p>{PRICE_DISCLAIMER}</p>
        </PageContainer>
      </div>
    </footer>
  );
}
