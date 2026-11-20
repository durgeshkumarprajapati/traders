import type { StockStatus } from "@/components/ui/status-badge";
import type { ProductUnit } from "./units";

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Lucide icon key; presentation only. */
  icon: "cement" | "steel" | "bricks" | "sand" | "hardware" | "other";
  displayOrder: number;
  /** Cloudinary image URL when configured (category card shows it instead of the icon). */
  imageUrl: string | null;
};

export type Brand = {
  id: string;
  slug: string;
  name: string;
  /** Logo URL when configured. */ logoUrl: string | null;
};

export type SpecRow = { label: string; value: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  /** Optional; unique when present. */
  sku: string | null;
  categoryId: string;
  brandId: string | null;
  description: string;
  specifications: SpecRow[];
  /** Cloudinary URL once connected; null renders a neutral placeholder image. */
  imageUrl: string | null;
  /** Indicative price. `null` = no price (shown as "Rate on request"); never coerced to 0. */
  price: number | null;
  unit: ProductUnit;
  stockStatus: StockStatus | null;
  isFeatured: boolean;
  /** ISO timestamp of the last price/data update; null = unknown (never fabricated). */
  updatedAt: string | null;
};
