import { PrintButton } from "@/components/admin/print-button";
import { ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Notification } from "@/components/ui/notification";
import { loadCatalogue } from "@/features/catalogue/server";
import { unitLabel } from "@/features/products/units";
import { productUrl } from "@/features/qr/qr";
import { PRODUCT_ID } from "@/features/material-lists/types";
import { publicEnv } from "@/lib/env/public";

export const metadata = {
  title: "QR labels | Sagar Traders Admin",
  robots: { index: false, follow: false },
};
const MAX_LABELS = 48;

/**
 * Printable QR labels for catalogue products (`?ids=a,b,c`, up to 48). Reached only through the admin console layout, which
 * enforces the administrator session on the server. Each QR encodes just the public product URL; only ACTIVE products appear
 * because inactive ones have no public page to open.
 */
export default async function QrLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const ids = [
    ...new Set(
      ((await searchParams).ids ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => PRODUCT_ID.test(s)),
    ),
  ].slice(0, MAX_LABELS);
  const load = await loadCatalogue();
  if (!load.ok)
    return (
      <Notification tone="error">
        The catalogue could not be read, so QR labels cannot be created right now.
      </Notification>
    );

  const byId = new Map(load.catalogue.products.map((p) => [p.id, p]));
  const brands = new Map(load.catalogue.brands.map((b) => [b.id, b.name]));
  const labels = ids.flatMap((id) => {
    const p = byId.get(id);
    if (!p) return [];
    try {
      return [
        {
          p,
          url: productUrl(publicEnv.NEXT_PUBLIC_SITE_URL, p.slug),
          brand: p.brandId ? (brands.get(p.brandId) ?? null) : null,
        },
      ];
    } catch {
      return [];
    }
  });
  const unavailable = ids.length - labels.length;

  return (
    <div className="space-y-gutter-lg">
      <div className="flex flex-wrap items-center justify-between gap-gutter-md print:hidden">
        <div>
          <h1 className="text-headline-lg-mobile font-bold md:text-headline-lg">QR labels</h1>
          <p className="text-body-md text-on-surface-variant">
            Each code opens the product&apos;s public page. Print on plain paper or labels.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/products" variant="outline">
            Back to products
          </ButtonLink>
          {labels.length > 0 && (
            <PrintButton label={`Print ${labels.length} label${labels.length === 1 ? "" : "s"}`} />
          )}
        </div>
      </div>
      {unavailable > 0 && (
        <Notification tone="warning">
          {unavailable} selected product(s) are not active in the public catalogue and have no
          public page, so no QR code was made for them.
        </Notification>
      )}
      {labels.length === 0 ? (
        <p className="text-body-md">
          No products selected. Open this page from the QR button in Products.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-gutter-md sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-2 print:gap-4">
          {labels.map(({ p, url, brand }) => (
            <li
              key={p.id}
              className="break-inside-avoid rounded-md border border-border p-gutter-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- generated SVG; printing needs a plain image */}
              <img
                src={`/api/qr/product/${p.slug}?format=svg`}
                alt={`QR code for ${p.name}`}
                width={176}
                height={176}
                className="mx-auto size-44 bg-surface"
              />
              <p className="mt-gutter-sm text-title-md font-bold [overflow-wrap:anywhere]">
                {p.name}
              </p>
              <p className="text-body-sm text-on-surface-variant">
                {[brand, p.sku && `SKU ${p.sku}`, `per ${unitLabel(p.unit)}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-body-sm [overflow-wrap:anywhere]">{url}</p>
              <div className="mt-2 flex flex-wrap gap-2 print:hidden">
                <ButtonAnchor
                  href={`/api/qr/product/${p.slug}?format=png&size=768&download=1`}
                  size="sm"
                  variant="outline"
                  download
                >
                  PNG
                </ButtonAnchor>
                <ButtonAnchor
                  href={`/api/qr/product/${p.slug}?format=svg&download=1`}
                  size="sm"
                  variant="outline"
                  download
                >
                  SVG
                </ButtonAnchor>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
