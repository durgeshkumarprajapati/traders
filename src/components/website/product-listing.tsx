import { PackageSearch } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/navigation-aids";
import { loadCatalogue } from "@/features/catalogue/server";
import { PRICE_DISCLAIMER } from "@/features/products/format";
import {
  filterAndSort,
  listingQuery,
  paginate,
  parseListingParams,
} from "@/features/products/query";
import { CatalogueEmpty, CatalogueUnavailable } from "./catalogue-states";
import { ProductCard } from "./product-card";
import { ProductFilters } from "./product-filters";

/**
 * Listing body. Reads URL search params and the cached catalogue snapshot, so it must render inside
 * <Suspense> (cacheComponents). The whole catalogue is read ONCE (shared cache entry); search, filters,
 * sorting and pagination are applied in memory — no extra Sheets request per filter or page.
 * Only active products (with active categories/brands) are ever in the data.
 */
export async function ProductListing({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseListingParams(await searchParams);
  const load = await loadCatalogue();
  if (!load.ok) return <CatalogueUnavailable />;

  const data = load.catalogue;
  if (data.products.length === 0) return <CatalogueEmpty />;

  const results = filterAndSort(data, params);
  const pg = paginate(results, params.page);
  const whatsappNumber = load.settings.whatsappNumber;
  const activeCount =
    Number(Boolean(params.q)) +
    Number(Boolean(params.category)) +
    params.brands.length +
    params.stock.length;
  const href = (page: number) => `/products${listingQuery(params, { page })}`;
  const brandById = new Map(data.brands.map((b) => [b.id, b]));
  const categoryById = new Map(data.categories.map((c) => [c.id, c]));

  return (
    <div className="grid gap-gutter-xl lg:grid-cols-4">
      <aside aria-label="Product filters" className="lg:col-span-1">
        <ProductFilters
          categories={data.categories}
          brands={data.brands}
          params={params}
          activeCount={activeCount}
        />
      </aside>
      <div className="lg:col-span-3">
        <p role="status" className="mb-gutter-md text-body-md text-on-surface-variant">
          {pg.total === 0
            ? "No products found."
            : `Showing ${pg.start + 1}–${pg.start + pg.items.length} of ${pg.total} products`}
        </p>
        {pg.total === 0 ? (
          <EmptyState
            icon={<PackageSearch />}
            title="No products match your filters"
            description="Try a different search term or remove some filters."
            action={
              <ButtonLink href="/products" variant="outline">
                Clear all filters
              </ButtonLink>
            }
          />
        ) : (
          <>
            <ul className="grid gap-gutter-md sm:grid-cols-2 xl:grid-cols-3">
              {pg.items.map((p) => (
                <li key={p.id}>
                  <ProductCard
                    product={p}
                    brand={brandById.get(p.brandId)}
                    category={categoryById.get(p.categoryId)}
                    whatsappNumber={whatsappNumber}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-gutter-xl flex justify-center">
              <Pagination page={pg.page} pageCount={pg.pageCount} hrefFor={href} />
            </div>
          </>
        )}
        <p className="mt-gutter-lg text-body-sm text-on-surface-variant">{PRICE_DISCLAIMER}</p>
      </div>
    </div>
  );
}

/** Loading state for the listing (Suspense fallback and route loading UI). */
export function ProductListingSkeleton() {
  return (
    <div
      className="grid gap-gutter-xl lg:grid-cols-4"
      aria-busy="true"
      aria-label="Loading products"
    >
      <Skeleton className="hidden h-96 lg:block" />
      <div className="grid gap-gutter-md sm:grid-cols-2 xl:grid-cols-3 lg:col-span-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    </div>
  );
}
