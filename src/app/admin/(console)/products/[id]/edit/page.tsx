import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ProductForm } from "@/components/admin/product-form";
import { loadAdminCatalogue } from "@/features/catalogue/server";

export const metadata = {
  title: "Edit Product | Sagar Traders Admin",
  robots: { index: false, follow: false },
};

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  const catResult = await loadAdminCatalogue();
  if (!catResult.ok) {
    return (
      <div className="rounded-md border border-error/40 bg-error/10 p-6 text-error">
        <h2 className="text-title-lg font-bold">Catalogue Unavailable</h2>
        <p className="mt-1 text-body-md">
          Cannot load product details from Google Sheets ({catResult.error}).
        </p>
      </div>
    );
  }

  const { products, categories, brands } = catResult.snapshot;
  const product = products.find((p) => p.id.toLowerCase() === id.toLowerCase());

  if (!product) {
    notFound();
  }

  return <ProductForm initialData={product} categories={categories} brands={brands} />;
}
