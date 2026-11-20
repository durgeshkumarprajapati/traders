/**
 * Worksheet (tab) names and column contracts — the exact definitions from
 * docs/PROJECT_BLUEPRINT.md §14.2. Columns are matched by HEADER NAME (case-insensitive), not
 * position, so reordering or adding columns is safe. Row numbers are reporting aids only and are
 * never used as identifiers.
 */
export type WorksheetDef = {
  name: string;
  /** Headers that must exist. */
  required: readonly string[];
  /** Headers that may exist. */
  optional: readonly string[];
};

export const PRODUCTS: WorksheetDef = {
  name: "Products",
  required: [
    "product_id",
    "product_name",
    "slug",
    "sku",
    "category_id",
    "brand_id",
    "description",
    "specifications",
    "image_url",
    "price",
    "unit",
    "stock_status",
    "is_featured",
    "is_active",
    "created_at",
    "updated_at",
  ],
  // Display label for unit = CUSTOM. Optional so existing sheets keep working until a custom unit is used.
  optional: ["unit_custom"],
};

export const CATEGORIES: WorksheetDef = {
  name: "Categories",
  required: [
    "category_id",
    "category_name",
    "slug",
    "description",
    "image_url",
    "display_order",
    "is_active",
  ],
  optional: [],
};

export const BRANDS: WorksheetDef = {
  name: "Brands",
  required: ["brand_id", "brand_name", "slug", "logo_url", "description", "is_active"],
  optional: [],
};

export const SETTINGS: WorksheetDef = {
  name: "BusinessSettings",
  required: ["setting_key", "setting_value"],
  optional: [],
};

export const PRICE_HISTORY: WorksheetDef = {
  name: "PriceHistory",
  required: ["history_id", "product_id", "previous_price", "new_price", "updated_at", "updated_by"],
  optional: [],
};

/** Hard cap per worksheet. A larger sheet is rejected rather than silently truncated. */
export const MAX_ROWS = 5000;
