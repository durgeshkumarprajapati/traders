"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { moderateReviewAction } from "@/features/reviews/actions";
import type { AdminCustomerReview } from "@/features/reviews/types";

export function ReviewsModerationView({ reviews }: { reviews: AdminCustomerReview[] }) {
  const [pending, startTransition] = useTransition();

  function setStatus(reviewId: string, status: "APPROVED" | "REJECTED" | "HIDDEN") {
    startTransition(async () => {
      await moderateReviewAction({ reviewId, status });
    });
  }

  return (
    <div className="space-y-gutter-lg">
      <div>
        <h1 className="text-headline-lg text-primary">Customer Reviews &amp; Feedback</h1>
        <p className="text-body-md text-on-surface-variant">
          Verified-purchase reviews submitted from delivered orders. Only approved reviews appear
          publicly.
        </p>
      </div>

      {reviews.length === 0 ? (
        <Card className="p-gutter-xl text-center">
          <Star aria-hidden className="mx-auto size-8 text-on-surface-variant" />
          <p className="mt-2 text-title-md text-on-surface">No reviews submitted yet</p>
        </Card>
      ) : (
        <div className="space-y-gutter-sm">
          {reviews.map((r) => (
            <Card key={r.id} className="p-gutter-md space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-title-md font-bold text-primary">
                    Overall {r.overallRating}/5
                  </span>
                  <Badge
                    tone={
                      r.moderationStatus === "APPROVED"
                        ? "success"
                        : r.moderationStatus === "PENDING"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {r.moderationStatus}
                  </Badge>
                  {r.verifiedPurchase && <Badge tone="info">Verified Purchase</Badge>}
                </div>
                <Link
                  href={`/admin/orders/${r.orderId}`}
                  className="text-label-md text-primary hover:underline"
                >
                  Order {r.orderReference ?? r.orderId.slice(0, 8)}
                </Link>
              </div>
              <p className="text-body-sm text-on-surface-variant">
                Quality: {r.qualityRating}/5 • Delivery: {r.deliveryRating}/5 • Service:{" "}
                {r.serviceRating}/5 • Submitted {new Date(r.createdAt).toLocaleString("en-IN")}
              </p>
              {r.feedback && <p className="text-body-md text-on-surface">{r.feedback}</p>}
              <p className="text-body-sm text-on-surface-variant">
                Display name:{" "}
                {r.consentToPublish
                  ? r.reviewerDisplayName || "Consented (no name)"
                  : "Anonymous (no consent for name)"}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={pending || r.moderationStatus === "APPROVED"}
                  onClick={() => setStatus(r.id, "APPROVED")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || r.moderationStatus === "HIDDEN"}
                  onClick={() => setStatus(r.id, "HIDDEN")}
                >
                  Hide
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending || r.moderationStatus === "REJECTED"}
                  onClick={() => setStatus(r.id, "REJECTED")}
                >
                  Reject
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
