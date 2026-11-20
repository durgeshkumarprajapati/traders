import Image from "next/image";
import { Boxes, BrickWall, Mountain, Package, Ruler, Wrench, type LucideIcon } from "lucide-react";
import { InteractiveCard } from "@/components/ui/card";
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
  const Icon = icons[category.icon];
  return (
    <InteractiveCard
      href={`/products?category=${category.slug}`}
      className="flex h-full items-center gap-gutter-md"
    >
      {category.imageUrl ? (
        <Image
          src={category.imageUrl}
          alt=""
          width={48}
          height={48}
          className="size-12 shrink-0 rounded border border-border object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded border border-border text-primary"
        >
          <Icon className="size-6" />
        </span>
      )}
      <span className="text-title-lg">{category.name}</span>
    </InteractiveCard>
  );
}
