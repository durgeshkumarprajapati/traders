import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/cn";

/** Product image (Cloudinary via next/image) or a neutral placeholder; never a fabricated photo. */
export function ProductImage({
  src,
  name,
  className,
  priority,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
}: {
  src: string | null;
  name: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-4/3 w-full overflow-hidden rounded bg-surface-muted",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          fill
          sizes={sizes}
          priority={priority}
          className="object-contain"
        />
      ) : (
        <div
          role="img"
          aria-label={`No image available for ${name}`}
          className="flex size-full items-center justify-center text-on-surface-variant"
        >
          <Package aria-hidden className="size-10" />
        </div>
      )}
    </div>
  );
}
