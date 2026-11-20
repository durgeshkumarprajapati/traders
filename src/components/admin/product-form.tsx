"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Notification } from "@/components/ui/notification";
import { Spinner } from "@/components/ui/feedback";
import { createProductAction, updateProductAction } from "@/features/admin/actions";
import type { CatalogueBrand, CatalogueCategory, CatalogueProduct } from "@/features/admin/types";
import { STOCK_STATUSES, type StockStatus } from "@/features/products/stock";
import { UNIT_CODES, type UnitCode } from "@/features/products/units";

interface ProductFormProps {
  initialData?: CatalogueProduct;
  categories: CatalogueCategory[];
  brands: CatalogueBrand[];
}

export function ProductForm({ initialData, categories, brands }: ProductFormProps) {
  const router = useRouter();
  const isEditing = Boolean(initialData);

  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [sku, setSku] = useState(initialData?.sku ?? "");
  const [categoryId, setCategoryId] = useState(initialData?.categoryId ?? categories[0]?.id ?? "");
  const [brandId, setBrandId] = useState(initialData?.brandId ?? brands[0]?.id ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [price, setPrice] = useState(
    initialData?.price !== null && initialData?.price !== undefined
      ? String(initialData.price)
      : "",
  );
  const [unitCode, setUnitCode] = useState<UnitCode>(initialData?.unit.code ?? "BAG");
  const [customUnitLabel, setCustomUnitLabel] = useState(initialData?.unit.customLabel ?? "");
  const [stockStatus, setStockStatus] = useState<StockStatus>(
    initialData?.stockStatus ?? "IN_STOCK",
  );
  const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured ?? false);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl ?? "");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Auto-generate slug from name if creating
  const handleNameChange = (newName: string) => {
    setName(newName);
    if (!isEditing) {
      const generated = newName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 80);
      setSlug(generated);
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) errors.name = "Material name is required.";
    else if (name.trim().length > 200) errors.name = "Name cannot exceed 200 characters.";

    if (!slug.trim()) errors.slug = "Slug is required.";
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())) {
      errors.slug = "Slug must contain only lowercase alphanumeric characters and single hyphens.";
    }

    if (sku.trim() && sku.trim().length > 64) {
      errors.sku = "SKU cannot exceed 64 characters.";
    }

    if (!categoryId) errors.categoryId = "Category selection is required.";
    if (!brandId) errors.brandId = "Brand selection is required.";

    if (price.trim() !== "") {
      const num = Number(price);
      if (isNaN(num) || num <= 0) {
        errors.price = "Price must be a positive number (leave empty if rate on request).";
      }
    }

    if (unitCode === "CUSTOM" && !customUnitLabel.trim()) {
      errors.customUnitLabel = "Display label is required when unit code is CUSTOM.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!validate()) return;

    startTransition(async () => {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        sku: sku.trim() ? sku.trim() : null,
        categoryId,
        brandId,
        description: description.trim() ? description.trim() : undefined,
        price: price.trim() !== "" ? Number(price) : null,
        unit: {
          code: unitCode,
          customLabel: unitCode === "CUSTOM" ? customUnitLabel.trim() : undefined,
        },
        stockStatus,
        isFeatured,
        isActive,
        imageUrl: imageUrl.trim() ? imageUrl.trim() : null,
      };

      if (isEditing && initialData) {
        const res = await updateProductAction(
          initialData.id,
          payload,
          initialData.updatedAt ?? null,
        );
        if (res.ok) {
          router.push("/admin/products");
          router.refresh();
        } else {
          setFormError(res.message);
        }
      } else {
        const res = await createProductAction(payload);
        if (res.ok) {
          router.push("/admin/products");
          router.refresh();
        } else {
          setFormError(res.message);
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl space-y-gutter-lg pb-section-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-gutter-md">
        <div>
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-1.5 text-label-sm font-medium text-primary hover:underline mb-2"
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to products
          </Link>
          <h1 className="text-display-sm font-bold text-on-surface">
            {isEditing ? `Edit Product: ${initialData?.name ?? ""}` : "Add New Material"}
          </h1>
          <p className="text-body-md text-on-surface-variant">
            {isEditing
              ? "Update material specifications, stock status, and rates in Google Sheets."
              : "Register a new building material into the Google Sheets catalogue."}
          </p>
        </div>
      </div>

      {formError && (
        <Notification tone="error" role="alert">
          {formError}
        </Notification>
      )}

      {/* Primary Details Card */}
      <Card className="border border-border bg-surface">
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle className="text-title-lg">Product Identification</CardTitle>
        </CardHeader>
        <CardBody className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Material Name" required error={fieldErrors.name}>
              {(p) => (
                <Input
                  {...p}
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Premium Grade Cement"
                />
              )}
            </Field>

            <Field
              label="URL Slug"
              required
              helper="URL-friendly identifier (e.g. premium-grade-cement)"
              error={fieldErrors.slug}
            >
              {(p) => (
                <Input
                  {...p}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().trim())}
                  placeholder="e.g. premium-grade-cement"
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="SKU (Optional)" helper="Unique stock unit code" error={fieldErrors.sku}>
              {(p) => (
                <Input
                  {...p}
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g. UT-PPC-50KG"
                />
              )}
            </Field>

            <Field label="Category" required error={fieldErrors.categoryId}>
              {(p) => (
                <Select {...p} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {!c.isActive && "(Inactive)"}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Brand" required error={fieldErrors.brandId}>
              {(p) => (
                <Select {...p} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {!b.isActive && "(Inactive)"}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field
            label="Description (Optional)"
            helper="Overview of technical grade and application"
          >
            {(p) => (
              <Textarea
                {...p}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="High-performance Portland Pozzolana Cement suitable for all general construction, plastering, and RCC work..."
              />
            )}
          </Field>
        </CardBody>
      </Card>

      {/* Pricing & Units Card */}
      <Card className="border border-border bg-surface">
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle className="text-title-lg">Pricing & Measurement Unit</CardTitle>
        </CardHeader>
        <CardBody className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Indicative Rate (₹)"
              helper="Leave blank if rate is available only on request"
              error={fieldErrors.price}
            >
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 385.00"
                />
              )}
            </Field>

            <Field label="Unit Code" required helper="Canonical unit representation">
              {(p) => (
                <Select
                  {...p}
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value as UnitCode)}
                >
                  {UNIT_CODES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {unitCode === "CUSTOM" && (
              <Field
                label="Custom Unit Display Label"
                required
                helper="e.g. 50kg Bag, 3m Bundle"
                error={fieldErrors.customUnitLabel}
              >
                {(p) => (
                  <Input
                    {...p}
                    value={customUnitLabel}
                    onChange={(e) => setCustomUnitLabel(e.target.value)}
                    placeholder="e.g. 50kg Bag"
                  />
                )}
              </Field>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Inventory & Display Settings */}
      <Card className="border border-border bg-surface">
        <CardHeader className="border-b border-border px-6 py-4">
          <CardTitle className="text-title-lg">Inventory & Catalog Visibility</CardTitle>
        </CardHeader>
        <CardBody className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Stock Availability Status" required>
              {(p) => (
                <Select
                  {...p}
                  value={stockStatus}
                  onChange={(e) => setStockStatus(e.target.value as StockStatus)}
                >
                  {STOCK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label="Product Image URL (Optional)"
              helper="Must be an approved HTTPS image URL"
            >
              {(p) => (
                <Input
                  {...p}
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                />
              )}
            </Field>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-6">
            <Checkbox
              label={
                <span className="font-medium text-on-surface">
                  Active (Display in customer catalogue and search)
                </span>
              }
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />

            <Checkbox
              label={
                <span className="font-medium text-on-surface">
                  Featured (Highlight on homepage featured section)
                </span>
              }
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
            />
          </div>
        </CardBody>
        <CardFooter className="flex items-center justify-between border-t border-border px-6 py-4 bg-surface-muted/30">
          <ButtonLink href="/admin/products" variant="outline">
            Cancel
          </ButtonLink>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? (
              <>
                <Spinner className="size-4 mr-2" /> Saving...
              </>
            ) : (
              <>
                <Save className="size-4 mr-2" aria-hidden />
                {isEditing ? "Save Product Changes" : "Create Product"}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
