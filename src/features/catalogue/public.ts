import type {
  CatalogueBrand,
  CatalogueCategory,
  CatalogueProduct,
  CatalogueSnapshot,
} from "./types";

export type PublicCatalogue = {
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
  brands: CatalogueBrand[];
  fetchedAt: string;
};

/**
 * What the customer site may show: active products only, plus active categories and brands.
 * (An active product can never reference an inactive/unknown category or brand — validation
 * already excluded those rows.) Phase 5 maps this onto the customer UI types.
 */
export function toPublicCatalogue(snapshot: CatalogueSnapshot): PublicCatalogue {
  return {
    products: snapshot.products.filter((p) => p.isActive),
    categories: snapshot.categories.filter((c) => c.isActive),
    brands: snapshot.brands.filter((b) => b.isActive),
    fetchedAt: snapshot.fetchedAt,
  };
}
