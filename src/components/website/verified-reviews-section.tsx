import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PublicCustomerReview } from "@/features/reviews/types";

export function VerifiedReviewsSection({ reviews }: { reviews: PublicCustomerReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <section aria-labelledby="verified-reviews-heading" className="space-y-gutter-md">
      <div>
        <h2 id="verified-reviews-heading" className="text-headline-lg text-primary">
          Verified Customer Reviews
        </h2>
        <p className="text-body-md text-on-surface-variant">
          Feedback submitted by customers after confirmed order delivery.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-gutter-md md:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r) => (
          <Card key={r.id} className="p-gutter-md space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 font-bold text-primary">
                <Star aria-hidden className="size-4 text-secondary" />
                <span>{r.overallRating}/5</span>
              </div>
              {r.verifiedPurchase && <Badge tone="success">Verified Purchase</Badge>}
            </div>
            {r.feedback && <p className="text-body-md text-on-surface">{r.feedback}</p>}
            <p className="text-body-sm text-on-surface-variant">
              — {r.consentToPublish && r.reviewerDisplayName ? r.reviewerDisplayName : "Verified Buyer"} •{" "}
              {new Date(r.createdAt).toLocaleDateString("en-IN")}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
