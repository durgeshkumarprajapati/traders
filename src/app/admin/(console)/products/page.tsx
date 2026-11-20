import { ProductListView } from "@/components/admin/product-list-view";
import { loadAdminCatalogue } from "@/features/catalogue/server";

export const metadata = {
  title: "Products Management | Sagar Traders Admin",
  robots: { index: false, follow: false },
};

export default async function AdminProductsPage() {
  const catResult = await loadAdminCatalogue();

  if (!catResult.ok) {
    return (
      <div className="rounded-md border border-error/40 bg-error/10 p-6 text-error">
        <h2 className="text-title-lg font-bold">Failed to load products</h2>
        <p className="mt-1 text-body-md">
          Google Sheets catalogue is currently unavailable ({catResult.error}). Please verify
          credentials and spreadsheet connectivity.
        </p>
      </div>
    );
  }

  const { products, categories, brands } = catResult.snapshot;

  return <ProductListView products={products} categories={categories} brands={brands} />;
}
