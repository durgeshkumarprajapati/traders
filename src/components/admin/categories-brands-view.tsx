"use client";

import { useMemo, useState, useTransition } from "react";
import { Edit, Eye, EyeOff, Layers, Plus, Search, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { Notification } from "@/components/ui/notification";
import { Spinner } from "@/components/ui/feedback";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import {
  createBrandAction,
  createCategoryAction,
  toggleBrandActiveAction,
  toggleCategoryActiveAction,
  updateBrandAction,
  updateCategoryAction,
} from "@/features/admin/actions";
import type { CatalogueBrand, CatalogueCategory, CatalogueProduct } from "@/features/admin/types";

interface CategoriesBrandsViewProps {
  categories: CatalogueCategory[];
  brands: CatalogueBrand[];
  products: CatalogueProduct[];
}

export function CategoriesBrandsView({ categories, brands, products }: CategoriesBrandsViewProps) {
  const [categorySearch, setCategorySearch] = useState("");
  const [brandSearch, setBrandSearch] = useState("");

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Category Modal State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CatalogueCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catOrder, setCatOrder] = useState("");
  const [catActive, setCatActive] = useState(true);
  const [catErrors, setCatErrors] = useState<Record<string, string>>({});

  // Brand Modal State
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<CatalogueBrand | null>(null);
  const [brandName, setBrandName] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [brandLogo, setBrandLogo] = useState("");
  const [brandDesc, setBrandDesc] = useState("");
  const [brandActive, setBrandActive] = useState(true);
  const [brandErrors, setBrandErrors] = useState<Record<string, string>>({});

  // Dependent product counts
  const categoryProductCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (p.isActive) {
        map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
      }
    }
    return map;
  }, [products]);

  const brandProductCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      if (p.isActive && p.brandId) {
        map.set(p.brandId, (map.get(p.brandId) ?? 0) + 1);
      }
    }
    return map;
  }, [products]);

  // Filtered lists
  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)),
    );
  }, [categories, categorySearch]);

  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        (b.description && b.description.toLowerCase().includes(q)),
    );
  }, [brands, brandSearch]);

  // ── Category Handlers ──────────────────────────────────────────────────────────

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCatName("");
    setCatSlug("");
    setCatDesc("");
    setCatOrder(String(categories.length + 1));
    setCatActive(true);
    setCatErrors({});
    setActionError(null);
    setActionSuccess(null);
    setCategoryModalOpen(true);
  };

  const openEditCategory = (cat: CatalogueCategory) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatSlug(cat.slug);
    setCatDesc(cat.description ?? "");
    setCatOrder(cat.displayOrder !== null ? String(cat.displayOrder) : "");
    setCatActive(cat.isActive);
    setCatErrors({});
    setActionError(null);
    setActionSuccess(null);
    setCategoryModalOpen(true);
  };

  const handleCatNameChange = (val: string) => {
    setCatName(val);
    if (!editingCategory) {
      setCatSlug(
        val
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .slice(0, 80),
      );
    }
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!catName.trim()) errs.name = "Category name is required.";
    if (!catSlug.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(catSlug.trim())) {
      errs.slug = "Valid slug is required (lowercase alphanumeric and single hyphens).";
    }
    if (catOrder.trim()) {
      const num = Number(catOrder);
      if (isNaN(num) || num < 1 || num > 999) {
        errs.order = "Display order must be an integer between 1 and 999.";
      }
    }
    setCatErrors(errs);
    if (Object.keys(errs).length > 0) return;

    startTransition(async () => {
      const payload = {
        name: catName.trim(),
        slug: catSlug.trim(),
        description: catDesc.trim() ? catDesc.trim() : null,
        displayOrder: catOrder.trim() ? Number(catOrder) : null,
        isActive: catActive,
      };

      if (editingCategory) {
        const res = await updateCategoryAction(editingCategory.id, payload);
        if (res.ok) {
          setActionSuccess(`Category "${res.data.name}" updated successfully.`);
          setCategoryModalOpen(false);
        } else {
          setActionError(res.message);
        }
      } else {
        const res = await createCategoryAction(payload);
        if (res.ok) {
          setActionSuccess(`Category "${res.data.name}" created successfully.`);
          setCategoryModalOpen(false);
        } else {
          setActionError(res.message);
        }
      }
    });
  };

  const handleToggleCategory = (cat: CatalogueCategory) => {
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const res = await toggleCategoryActiveAction(cat.id, !cat.isActive);
      if (res.ok) {
        setActionSuccess(
          `Category "${cat.name}" ${!cat.isActive ? "activated" : "deactivated"} successfully.`,
        );
      } else {
        setActionError(res.message);
      }
    });
  };

  // ── Brand Handlers ─────────────────────────────────────────────────────────────

  const openCreateBrand = () => {
    setEditingBrand(null);
    setBrandName("");
    setBrandSlug("");
    setBrandLogo("");
    setBrandDesc("");
    setBrandActive(true);
    setBrandErrors({});
    setActionError(null);
    setActionSuccess(null);
    setBrandModalOpen(true);
  };

  const openEditBrand = (brand: CatalogueBrand) => {
    setEditingBrand(brand);
    setBrandName(brand.name);
    setBrandSlug(brand.slug);
    setBrandLogo(brand.logoUrl ?? "");
    setBrandDesc(brand.description ?? "");
    setBrandActive(brand.isActive);
    setBrandErrors({});
    setActionError(null);
    setActionSuccess(null);
    setBrandModalOpen(true);
  };

  const handleBrandNameChange = (val: string) => {
    setBrandName(val);
    if (!editingBrand) {
      setBrandSlug(
        val
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .slice(0, 80),
      );
    }
  };

  const handleBrandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!brandName.trim()) errs.name = "Brand name is required.";
    if (!brandSlug.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(brandSlug.trim())) {
      errs.slug = "Valid slug is required (lowercase alphanumeric and single hyphens).";
    }
    setBrandErrors(errs);
    if (Object.keys(errs).length > 0) return;

    startTransition(async () => {
      const payload = {
        name: brandName.trim(),
        slug: brandSlug.trim(),
        logoUrl: brandLogo.trim() ? brandLogo.trim() : null,
        description: brandDesc.trim() ? brandDesc.trim() : null,
        isActive: brandActive,
      };

      if (editingBrand) {
        const res = await updateBrandAction(editingBrand.id, payload);
        if (res.ok) {
          setActionSuccess(`Brand "${res.data.name}" updated successfully.`);
          setBrandModalOpen(false);
        } else {
          setActionError(res.message);
        }
      } else {
        const res = await createBrandAction(payload);
        if (res.ok) {
          setActionSuccess(`Brand "${res.data.name}" created successfully.`);
          setBrandModalOpen(false);
        } else {
          setActionError(res.message);
        }
      }
    });
  };

  const handleToggleBrand = (brand: CatalogueBrand) => {
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const res = await toggleBrandActiveAction(brand.id, !brand.isActive);
      if (res.ok) {
        setActionSuccess(
          `Brand "${brand.name}" ${!brand.isActive ? "activated" : "deactivated"} successfully.`,
        );
      } else {
        setActionError(res.message);
      }
    });
  };

  // ── Tab Items ──────────────────────────────────────────────────────────────────

  const tabItems = [
    {
      id: "categories",
      label: `Categories (${categories.length})`,
      icon: <Layers className="size-4" aria-hidden />,
      content: (
        <div className="space-y-4 pt-4">
          <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-72">
              <Input
                type="text"
                placeholder="Search categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                icon={<Search aria-hidden />}
              />
            </div>
            <Button variant="primary" size="sm" onClick={openCreateCategory}>
              <Plus className="size-4 mr-1.5" aria-hidden /> Add Category
            </Button>
          </div>

          <div className="rounded-md border border-border bg-surface overflow-hidden">
            <Table stacked>
              <THead>
                <Tr>
                  <Th>Order</Th>
                  <Th>Category Name</Th>
                  <Th>Slug</Th>
                  <Th>Active Products</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {filteredCategories.map((c) => {
                  const activeProdCount = categoryProductCount.get(c.id) ?? 0;
                  return (
                    <Tr key={c.id}>
                      <Td label="Order" className="font-mono text-body-md font-semibold">
                        {c.displayOrder ?? "—"}
                      </Td>
                      <Td label="Category">
                        <div className="font-semibold text-on-surface">{c.name}</div>
                        {c.description && (
                          <div className="text-body-md text-on-surface-variant line-clamp-1">
                            {c.description}
                          </div>
                        )}
                      </Td>
                      <Td label="Slug" className="font-mono text-body-md text-on-surface-variant">
                        {c.slug}
                      </Td>
                      <Td label="Active products">
                        <span className="font-semibold text-on-surface">{activeProdCount}</span>
                      </Td>
                      <Td label="Status">
                        {c.isActive ? (
                          <Badge tone="success" appearance="solid">
                            Active
                          </Badge>
                        ) : (
                          <Badge tone="neutral" appearance="outline">
                            Inactive
                          </Badge>
                        )}
                      </Td>
                      <Td className="md:text-right">
                        <div className="flex flex-wrap items-center gap-1 md:justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditCategory(c)}
                            aria-label={`Edit category ${c.name}`}
                          >
                            <Edit className="size-3.5 mr-1" aria-hidden /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => handleToggleCategory(c)}
                            aria-label={
                              c.isActive
                                ? `Deactivate category ${c.name}`
                                : `Activate category ${c.name}`
                            }
                            className={
                              c.isActive
                                ? "text-error hover:text-error"
                                : "text-success hover:text-success"
                            }
                          >
                            {c.isActive ? (
                              <>
                                <EyeOff className="size-3.5 mr-1" aria-hidden /> Deactivate
                              </>
                            ) : (
                              <>
                                <Eye className="size-3.5 mr-1" aria-hidden /> Activate
                              </>
                            )}
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </div>
      ),
    },
    {
      id: "brands",
      label: `Brands (${brands.length})`,
      icon: <Tag className="size-4" aria-hidden />,
      content: (
        <div className="space-y-4 pt-4">
          <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-72">
              <Input
                type="text"
                placeholder="Search brands..."
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                icon={<Search aria-hidden />}
              />
            </div>
            <Button variant="primary" size="sm" onClick={openCreateBrand}>
              <Plus className="size-4 mr-1.5" aria-hidden /> Add Brand
            </Button>
          </div>

          <div className="rounded-md border border-border bg-surface overflow-hidden">
            <Table stacked>
              <THead>
                <Tr>
                  <Th>Brand Name</Th>
                  <Th>Slug</Th>
                  <Th>Active Products</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {filteredBrands.map((b) => {
                  const activeProdCount = brandProductCount.get(b.id) ?? 0;
                  return (
                    <Tr key={b.id}>
                      <Td label="Brand">
                        <div className="font-semibold text-on-surface">{b.name}</div>
                        {b.description && (
                          <div className="text-body-md text-on-surface-variant line-clamp-1">
                            {b.description}
                          </div>
                        )}
                      </Td>
                      <Td label="Slug" className="font-mono text-body-md text-on-surface-variant">
                        {b.slug}
                      </Td>
                      <Td label="Active products">
                        <span className="font-semibold text-on-surface">{activeProdCount}</span>
                      </Td>
                      <Td label="Status">
                        {b.isActive ? (
                          <Badge tone="success" appearance="solid">
                            Active
                          </Badge>
                        ) : (
                          <Badge tone="neutral" appearance="outline">
                            Inactive
                          </Badge>
                        )}
                      </Td>
                      <Td className="md:text-right">
                        <div className="flex flex-wrap items-center gap-1 md:justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditBrand(b)}
                            aria-label={`Edit brand ${b.name}`}
                          >
                            <Edit className="size-3.5 mr-1" aria-hidden /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => handleToggleBrand(b)}
                            aria-label={
                              b.isActive ? `Deactivate brand ${b.name}` : `Activate brand ${b.name}`
                            }
                            className={
                              b.isActive
                                ? "text-error hover:text-error"
                                : "text-success hover:text-success"
                            }
                          >
                            {b.isActive ? (
                              <>
                                <EyeOff className="size-3.5 mr-1" aria-hidden /> Deactivate
                              </>
                            ) : (
                              <>
                                <Eye className="size-3.5 mr-1" aria-hidden /> Activate
                              </>
                            )}
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-gutter-md">
      {/* Header */}
      <div className="border-b border-border pb-gutter-md">
        <h1 className="text-headline-lg-mobile font-bold md:text-headline-lg text-on-surface">
          Categories & Brands
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Manage product taxonomy, manufacturers, display order, and active catalog relationships.
        </p>
      </div>

      {actionError && (
        <Notification tone="error" role="alert">
          {actionError}
        </Notification>
      )}
      {actionSuccess && (
        <Notification tone="success" role="status">
          {actionSuccess}
        </Notification>
      )}

      {/* Tabs */}
      <Tabs items={tabItems} defaultId="categories" label="Catalogue taxonomy" />

      {/* Category Create/Edit Modal */}
      <Modal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={editingCategory ? `Edit Category: ${editingCategory.name}` : "Add New Category"}
        description="Categories organize materials across customer browsing and filter navigations."
      >
        <form onSubmit={handleCategorySubmit} className="space-y-4">
          <Field label="Category Name" required error={catErrors.name}>
            {(p) => (
              <Input
                {...p}
                value={catName}
                onChange={(e) => handleCatNameChange(e.target.value)}
                placeholder="e.g. Steel & TMT Rebars"
              />
            )}
          </Field>

          <Field label="URL Slug" required helper="Unique URL path segment" error={catErrors.slug}>
            {(p) => (
              <Input
                {...p}
                value={catSlug}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setCatSlug(e.target.value.toLowerCase().trim())}
                placeholder="e.g. steel-tmt-rebars"
              />
            )}
          </Field>

          <Field
            label="Display Order (Optional)"
            helper="Lower numbers appear first (1, 2, 3...)"
            error={catErrors.order}
          >
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min="1"
                max="999"
                value={catOrder}
                onChange={(e) => setCatOrder(e.target.value)}
                placeholder="1"
              />
            )}
          </Field>

          <Field label="Description (Optional)">
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Brief category summary for site visitors..."
              />
            )}
          </Field>

          <Checkbox
            label={<span className="font-medium text-on-surface">Active category</span>}
            checked={catActive}
            onChange={(e) => setCatActive(e.target.checked)}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCategoryModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isPending}>
              {isPending ? (
                <>
                  <Spinner className="size-4 mr-2" /> Saving...
                </>
              ) : (
                "Save Category"
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Brand Create/Edit Modal */}
      <Modal
        open={brandModalOpen}
        onClose={() => setBrandModalOpen(false)}
        title={editingBrand ? `Edit Brand: ${editingBrand.name}` : "Add New Brand"}
        description="Register a verified manufacturer or brand supplied by Sagar Traders."
      >
        <form onSubmit={handleBrandSubmit} className="space-y-4">
          <Field label="Brand Name" required error={brandErrors.name}>
            {(p) => (
              <Input
                {...p}
                value={brandName}
                onChange={(e) => handleBrandNameChange(e.target.value)}
                placeholder="e.g. Brand Name"
              />
            )}
          </Field>

          <Field
            label="URL Slug"
            required
            helper="Unique URL path segment"
            error={brandErrors.slug}
          >
            {(p) => (
              <Input
                {...p}
                value={brandSlug}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setBrandSlug(e.target.value.toLowerCase().trim())}
                placeholder="e.g. brand-name"
              />
            )}
          </Field>

          <Field label="Logo URL (Optional)" helper="Approved HTTPS image URL">
            {(p) => (
              <Input
                {...p}
                type="url"
                value={brandLogo}
                onChange={(e) => setBrandLogo(e.target.value)}
                placeholder="https://res.cloudinary.com/..."
              />
            )}
          </Field>

          <Field label="Description (Optional)">
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={brandDesc}
                onChange={(e) => setBrandDesc(e.target.value)}
                placeholder="Brand summary and authorized supply information..."
              />
            )}
          </Field>

          <Checkbox
            label={<span className="font-medium text-on-surface">Active brand</span>}
            checked={brandActive}
            onChange={(e) => setBrandActive(e.target.checked)}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBrandModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isPending}>
              {isPending ? (
                <>
                  <Spinner className="size-4 mr-2" /> Saving...
                </>
              ) : (
                "Save Brand"
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
