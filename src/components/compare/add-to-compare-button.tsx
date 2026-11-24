"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compareHref, MAX_COMPARE } from "@/features/compare/compare";
import { compareStore, useCompareIds } from "@/features/compare/store";

/** Adds / removes a product from the comparison list (max three). Announces the result and the "list is full" case. */
export function AddToCompareButton({
  productId,
  productName,
  size = "sm",
  variant = "ghost",
  className,
}: {
  productId: string;
  productName: string;
  size?: "sm" | "md" | "lg";
  variant?: "outline" | "ghost";
  className?: string;
}) {
  const ids = useCompareIds();
  const [note, setNote] = useState("");
  const inList = ids.includes(productId);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        aria-pressed={inList}
        onClick={() => {
          const r = compareStore.toggle(productId);
          setNote(
            r === "full"
              ? `You can compare up to ${MAX_COMPARE} products. Remove one first.`
              : r === "removed"
                ? `${productName} removed from comparison.`
                : r === "added"
                  ? `${productName} added to comparison.`
                  : "",
          );
        }}
      >
        {inList ? (
          <Check aria-hidden className="size-4" />
        ) : (
          <Scale aria-hidden className="size-4" />
        )}
        {inList ? "Comparing" : "Compare"} <span className="sr-only">{productName}</span>
      </Button>
      <span role="status" className="sr-only">
        {note}
      </span>
      {inList && ids.length > 1 && (
        <Link
          href={compareHref([...ids])}
          className="text-label-md font-semibold text-primary underline"
        >
          View comparison ({ids.length})
        </Link>
      )}
    </>
  );
}
