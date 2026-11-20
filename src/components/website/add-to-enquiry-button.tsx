"use client";

import { useState } from "react";
import { Check, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enquiryList } from "@/features/enquiries/enquiry-list-store";

/** Adds a product to the browser-side enquiry list (quotation list, not a cart). */
export function AddToEnquiryButton({
  productId,
  productName,
  quantity = 1,
  size = "sm",
  variant = "outline",
  className,
}: {
  productId: string;
  productName: string;
  quantity?: number;
  size?: "sm" | "md" | "lg";
  variant?: "outline" | "primary" | "secondary";
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "added" | "full">("idle");
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => {
          setStatus(enquiryList.add(productId, quantity) ? "added" : "full");
          setTimeout(() => setStatus("idle"), 2500);
        }}
      >
        {status === "added" ? (
          <Check aria-hidden className="size-4" />
        ) : (
          <ListPlus aria-hidden className="size-4" />
        )}
        {status === "added" ? "Added" : "Add to enquiry list"}{" "}
        <span className="sr-only">{productName}</span>
      </Button>
      <span role="status" className="sr-only">
        {status === "added"
          ? `${productName} added to your enquiry list.`
          : status === "full"
            ? "Your enquiry list is full."
            : ""}
      </span>
    </>
  );
}
