import Image from "next/image";
import Link from "next/link";
import {
  Boxes,
  BrickWall,
  ChevronRight,
  Mountain,
  Package,
  Ruler,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/features/products/types";

const icons: Record<Category["icon"], LucideIcon> = {
  cement: Package,
  steel: Ruler,
  bricks: BrickWall,
  sand: Mountain,
  hardware: Wrench,
  other: Boxes,
};

/** Reusable category card linking to the filtered product listing. */
export function CategoryCard({ category }: { category: Category }) {
  const Icon = icons[category.icon] ?? Boxes;
  return (
    <Link
      href={`/products?category=${category.slug}`}
      className="group flex h-full flex-col items-center justify-between rounded-lg border border-border bg-surface p-4 text-center transition-all duration-200 hover:border-primary hover:shadow-xs"
    >
      <div className="mb-3 flex size-16 items-center justify-center rounded-md bg-surface-muted p-2">
        {category.imageUrl ? (
          <Image
            src={category.imageUrl}
            alt=""
            width={56}
            height={56}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <Icon aria-hidden className="size-8 text-primary" />
        )}
      </div>
      <div>
        <h3 className="text-title-md font-semibold text-on-surface group-hover:text-primary transition-colors">
          {category.name}
        </h3>
        {category.description ? (
          <span className="mt-0.5 block text-body-sm text-on-surface-variant line-clamp-1">
            {category.description}
          </span>
        ) : (
          <span className="mt-0.5 block text-body-sm text-on-surface-variant line-clamp-1">
            Certified materials
          </span>
        )}
      </div>
      <span className="mt-3 inline-flex items-center gap-0.5 text-label-sm font-semibold text-primary">
        View Products <ChevronRight aria-hidden className="size-3.5" />
      </span>
    </Link>
  );
}
