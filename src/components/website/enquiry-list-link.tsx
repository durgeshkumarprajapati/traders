"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { CountBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { useEnquiryItems } from "@/features/enquiries/enquiry-list-store";
import { cn } from "@/lib/cn";

/** Header link to the bulk enquiry page with a live count of items in the enquiry list. */
export function EnquiryListLink({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const count = useEnquiryItems().length;
  return (
    <Link
      href="/bulk-enquiry"
      className={cn(
        buttonVariants({ variant: "outline", size: children ? "md" : "icon" }),
        "relative",
        className,
      )}
      aria-label={`Enquiry list, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <ClipboardList aria-hidden className="size-4" />
      {children}
      {count > 0 && (
        <CountBadge
          count={count}
          tone="secondary"
          className="absolute -top-2 -right-2"
          aria-hidden
        />
      )}
    </Link>
  );
}
