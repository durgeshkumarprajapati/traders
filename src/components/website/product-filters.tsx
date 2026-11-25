"use client";

import Form from "next/form";
import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Input, Radio, Select } from "@/components/ui/form-controls";
import { Drawer } from "@/components/ui/modal";
import { STOCK_STATUSES, stockStatusLabel } from "@/components/ui/status-badge";
import { VoiceSearchButton } from "./voice-search-button";
import {
  PRICE_FILTERS,
  PRICE_FILTER_LABELS,
  SORT_LABELS,
  SORT_OPTIONS,
  type ListingParams,
} from "@/features/products/query";
import type { Brand, Category } from "@/features/products/types";
import type { UnitOption } from "@/features/products/units";

type Props = {
  categories: Category[];
  brands: Brand[];
  /** Units present in the catalogue (see availableUnitOptions). */
  units?: UnitOption[];
  params: ListingParams;
  activeCount: number;
};

function FilterForm({
  categories,
  brands,
  units = [],
  params,
  onSubmit,
}: Omit<Props, "activeCount"> & { onSubmit?: () => void }) {
  const [searchValue, setSearchValue] = useState(params.q);
  return (
    // next/form: GET navigation to /products with the fields as query params (works without JS too).
    <Form
      action="/products"
      onSubmit={onSubmit}
      className="space-y-gutter-lg"
      aria-label="Filter products"
    >
      <div data-tour="product-search" className="space-y-2">
        <Field label="Search products">
          {(p) => (
            <Input
              icon={<Search />}
              type="search"
              name="q"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search name, vernacular terms (sariya, eent, reti), brand, SKU"
              maxLength={100}
              {...p}
            />
          )}
        </Field>
        <VoiceSearchButton onTranscript={(spoken) => setSearchValue(spoken)} />
      </div>
      <fieldset className="space-y-gutter-sm">
        <legend className="mb-gutter-sm text-label-lg">Category</legend>
        <Radio name="category" value="" label="All categories" defaultChecked={!params.category} />
        {categories.map((c) => (
          <Radio
            key={c.id}
            name="category"
            value={c.slug}
            label={c.name}
            defaultChecked={params.category === c.slug}
          />
        ))}
      </fieldset>
      <fieldset className="space-y-gutter-sm">
        <legend className="mb-gutter-sm text-label-lg">Brand</legend>
        {brands.map((b) => (
          <Checkbox
            key={b.id}
            name="brand"
            value={b.slug}
            label={b.name}
            defaultChecked={params.brands.includes(b.slug)}
          />
        ))}
      </fieldset>
      <fieldset className="space-y-gutter-sm">
        <legend className="mb-gutter-sm text-label-lg">Availability</legend>
        {STOCK_STATUSES.map((s) => (
          <Checkbox
            key={s}
            name="stock"
            value={s}
            label={stockStatusLabel(s)}
            defaultChecked={params.stock.includes(s)}
          />
        ))}
      </fieldset>
      {units.length > 0 && (
        <fieldset className="space-y-gutter-sm">
          <legend className="mb-gutter-sm text-label-lg">Unit</legend>
          {units.map((u) => (
            <Checkbox
              key={u.code}
              name="unit"
              value={u.code}
              label={u.label}
              defaultChecked={params.units?.includes(u.code)}
            />
          ))}
        </fieldset>
      )}
      <fieldset className="space-y-gutter-sm">
        <legend className="mb-gutter-sm text-label-lg">Price</legend>
        {PRICE_FILTERS.map((f) => (
          <Radio
            key={f}
            name="price"
            value={f === "any" ? "" : f}
            label={PRICE_FILTER_LABELS[f]}
            defaultChecked={(params.price ?? "any") === f}
          />
        ))}
      </fieldset>
      <Field label="Sort by">
        {(p) => (
          <Select name="sort" defaultValue={params.sort} {...p}>
            {SORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex gap-gutter-sm">
        <Button type="submit" className="flex-1">
          Apply filters
        </Button>
        <ButtonLink href="/products" variant="outline">
          Reset
        </ButtonLink>
      </div>
    </Form>
  );
}

/** Desktop: inline sidebar. Below `lg`: a "Filters" button opening the same form in a drawer. */
export function ProductFilters({ categories, brands, units, params, activeCount }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="lg:hidden">
        <Button
          variant="outline"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          Filters{activeCount > 0 && ` (${activeCount})`}
        </Button>
        <Drawer open={open} onClose={() => setOpen(false)} title="Filter products">
          <FilterForm
            categories={categories}
            brands={brands}
            units={units}
            params={params}
            onSubmit={() => setOpen(false)}
          />
        </Drawer>
      </div>
      <div className="hidden lg:block rounded-lg border border-border bg-surface p-5 shadow-xs">
        <h2 className="mb-gutter-md text-title-lg font-bold text-on-surface">Filters</h2>
        <FilterForm categories={categories} brands={brands} units={units} params={params} />
      </div>
    </>
  );
}
