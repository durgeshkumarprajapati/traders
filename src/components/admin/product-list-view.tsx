"use client";

import { useMemo, useState, useTransition } from "react";
import { Edit, Eye, EyeOff, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { Notification } from "@/components/ui/notification";
import { StockBadge } from "@/components/ui/status-badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { toggleProductActiveAction } from "@/features/admin/actions";
import type { CatalogueBrand, CatalogueCategory, CatalogueProduct } from "@/features/admin/types";
import { formatPrice, formatUpdated } from "@/features/products/format";
import { STOCK_STATUSES } from "@/features/products/stock";
import { unitLabel } from "@/features/products/units";

interface ProductListViewProps {
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
  brands: CatalogueBrand[];
}

export function ProductListView({ products, categories, brands }: ProductListViewProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name-asc");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const brandMap = useMemo(() => new Map(brands.map((b) => [b.id, b.name])), [brands]);

  // Filtering & sorting logic
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search query
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          (p.sku && p.sku.toLowerCase().includes(q)),
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter((p) => p.categoryId === categoryFilter);
    }

    // Brand filter
    if (brandFilter !== "all") {
      result = result.filter((p) => p.brandId === brandFilter);
    }

    // Stock status filter
    if (stockFilter !== "all") {
      result = result.filter((p) => p.stockStatus === stockFilter);
    }

    // Active status filter
    if (activeFilter === "active") {
      result = result.filter((p) => p.isActive);
    } else if (activeFilter === "inactive") {
      result = result.filter((p) => !p.isActive);
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "price-asc":
          return (a.price ?? Infinity) - (b.price ?? Infinity);
        case "price-desc":
          return (b.price ?? -Infinity) - (a.price ?? -Infinity);
        case "updated-desc":
          return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
        default:
          return 0;
      }
    });

    return result;
  }, [products, search, categoryFilter, brandFilter, stockFilter, activeFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  const handleToggleActive = (productId: string, currentStatus: boolean, productName: string) => {
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const res = await toggleProductActiveAction(productId, !currentStatus);
      if (res.ok) {
        setActionSuccess(
          `Product "${productName}" ${!currentStatus ? "activated" : "deactivated"} successfully.`,
        );
      } else {
        setActionError(res.message);
      }
    });
  };

  const handleResetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setBrandFilter("all");
    setStockFilter("all");
    setActiveFilter("all");
    setSortBy("name-asc");
    setPage(1);
  };

  return (
    <div className="space-y-gutter-md">
      {/* Header & Actions */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-gutter-md">
        <div>
          <h1 className="text-headline-lg-mobile font-bold md:text-headline-lg text-on-surface">
            Products
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Manage material inventory, prices, units, and catalogue availability.
          </p>
        </div>
        <ButtonLink href="/admin/products/new" size="sm" variant="primary">
          <Plus aria-hidden className="size-4" /> Add Product
        </ButtonLink>
      </div>

      {/* Notifications */}
      {actionError && (
        <Notification tone="error" role="alert" className="mb-2">
          {actionError}
        </Notification>
      )}
      {actionSuccess && (
        <Notification tone="success" role="status" className="mb-2">
          {actionSuccess}
        </Notification>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-md border border-border bg-surface p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="relative">
            <Input
              type="text"
              placeholder="Search by name, slug, SKU..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              icon={<Search aria-hidden />}
            />
          </div>

          {/* Category Filter */}
          <Select
            aria-label="Filter by Category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {!c.isActive && "(Inactive)"}
              </option>
            ))}
          </Select>

          {/* Brand Filter */}
          <Select
            aria-label="Filter by Brand"
            value={brandFilter}
            onChange={(e) => {
              setBrandFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Brands ({brands.length})</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {!b.isActive && "(Inactive)"}
              </option>
            ))}
          </Select>

          {/* Stock Status Filter */}
          <Select
            aria-label="Filter by Stock Status"
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Stock Statuses</option>
            {STOCK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <span className="text-body-md text-on-surface-variant font-medium">Status:</span>
            <Select
              className="h-10 w-full sm:h-8 sm:w-36"
              aria-label="Filter by Active Status"
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </Select>

            <span className="text-body-md text-on-surface-variant font-medium sm:ml-2">Sort:</span>
            <Select
              className="h-10 w-full sm:h-8 sm:w-44"
              aria-label="Sort products"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name-asc">Name (A to Z)</option>
              <option value="name-desc">Name (Z to A)</option>
              <option value="price-asc">Price (Low to High)</option>
              <option value="price-desc">Price (High to Low)</option>
              <option value="updated-desc">Recently Updated</option>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-body-md text-on-surface-variant">
              Showing <strong>{filteredProducts.length}</strong> of {products.length} products
            </span>
            {(search ||
              categoryFilter !== "all" ||
              brandFilter !== "all" ||
              stockFilter !== "all" ||
              activeFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-primary sm:h-8"
                onClick={handleResetFilters}
              >
                Reset filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Product Table */}
      <div className="rounded-md border border-border bg-surface overflow-hidden">
        {paginatedProducts.length > 0 ? (
          <div>
            <Table stacked>
              <THead>
                <Tr>
                  <Th>Material / SKU</Th>
                  <Th>Category</Th>
                  <Th>Brand</Th>
                  <Th>Listed Rate</Th>
                  <Th>Unit</Th>
                  <Th>Stock Status</Th>
                  <Th>Status</Th>
                  <Th>Last Updated</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {paginatedProducts.map((p) => {
                  const catName = categoryMap.get(p.categoryId) ?? p.categoryId;
                  const brandName = p.brandId ? (brandMap.get(p.brandId) ?? p.brandId) : "—";

                  return (
                    <Tr key={p.id}>
                      <Td>
                        <div className="font-semibold text-on-surface">{p.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="text-body-md text-on-surface-variant font-mono">
                            {p.slug}
                          </span>
                          {p.sku && (
                            <span className="text-label-md font-mono bg-surface-muted px-1.5 py-0.5 rounded border border-border font-medium">
                              SKU: {p.sku}
                            </span>
                          )}
                          {p.isFeatured && (
                            <Badge tone="warning" appearance="solid" className="px-1 py-0">
                              Featured
                            </Badge>
                          )}
                        </div>
                      </Td>
                      <Td label="Category" className="text-body-sm">
                        {catName}
                      </Td>
                      <Td label="Brand" className="text-body-sm">
                        {brandName}
                      </Td>
                      <Td label="Listed rate" className="text-body-sm font-semibold">
                        {formatPrice(p.price) ?? (
                          <span className="text-on-surface-variant font-normal">On request</span>
                        )}
                      </Td>
                      <Td label="Unit" className="text-body-sm">
                        {unitLabel(p.unit)}
                      </Td>
                      <Td label="Stock status">
                        <StockBadge status={p.stockStatus} />
                      </Td>
                      <Td label="Status">
                        {p.isActive ? (
                          <Badge tone="success" appearance="solid">
                            Active
                          </Badge>
                        ) : (
                          <Badge tone="neutral" appearance="outline">
                            Inactive
                          </Badge>
                        )}
                      </Td>
                      <Td
                        label="Last updated"
                        className="text-body-md text-on-surface-variant md:whitespace-nowrap"
                      >
                        {formatUpdated(p.updatedAt) ?? "—"}
                      </Td>
                      <Td className="md:text-right md:whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1 md:justify-end">
                          <ButtonLink
                            href={`/admin/products/${p.id}/edit`}
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${p.name}`}
                          >
                            <Edit className="size-3.5 mr-1" aria-hidden /> Edit
                          </ButtonLink>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => handleToggleActive(p.id, p.isActive, p.name)}
                            aria-label={p.isActive ? `Deactivate ${p.name}` : `Activate ${p.name}`}
                            className={
                              p.isActive
                                ? "text-error hover:text-error"
                                : "text-success hover:text-success"
                            }
                          >
                            {p.isActive ? (
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
        ) : (
          <div className="p-12 text-center text-on-surface-variant">
            <p className="text-body-lg font-semibold text-on-surface">No products found</p>
            <p className="text-body-md text-on-surface-variant mt-1">
              No materials match your current search and filter criteria.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleResetFilters}>
              Clear Filters
            </Button>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-muted/30 px-4 py-3">
            <span className="text-body-md text-on-surface-variant">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
