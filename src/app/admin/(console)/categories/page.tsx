import { CategoriesBrandsView } from "@/components/admin/categories-brands-view";
import { loadAdminCatalogue } from "@/features/catalogue/server";

export const metadata = {
  title: "Categories & Brands | Sagar Traders Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCategoriesPage() {
  const catResult = await loadAdminCatalogue();

  if (!catResult.ok) {
    return (
      <div className="rounded-md border border-error/40 bg-error/10 p-6 text-error">
        <h2 className="text-title-lg font-bold">Catalogue Unavailable</h2>
        <p className="mt-1 text-body-md">
          Google Sheets catalogue is currently unavailable ({catResult.error}). Please verify
          credentials and connectivity.
        </p>
      </div>
    );
  }

  const { categories, brands, products } = catResult.snapshot;

  return <CategoriesBrandsView categories={categories} brands={brands} products={products} />;
}
