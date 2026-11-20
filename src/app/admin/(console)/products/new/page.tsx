import { ProductForm } from "@/components/admin/product-form";
import { loadAdminCatalogue } from "@/features/catalogue/server";

export const metadata = {
  title: "Add Product | Sagar Traders Admin",
  robots: { index: false, follow: false },
};

export default async function AdminNewProductPage() {
  const catResult = await loadAdminCatalogue();

  if (!catResult.ok) {
    return (
      <div className="rounded-md border border-error/40 bg-error/10 p-6 text-error">
        <h2 className="text-title-lg font-bold">Catalogue Unavailable</h2>
        <p className="mt-1 text-body-md">
          Cannot load categories and brands from Google Sheets ({catResult.error}). Please verify
          credentials and spreadsheet connectivity before adding products.
        </p>
      </div>
    );
  }

  const { categories, brands } = catResult.snapshot;

  return <ProductForm categories={categories} brands={brands} />;
}
