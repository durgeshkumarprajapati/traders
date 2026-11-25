import { ReviewsModerationView } from "@/components/admin/reviews-moderation-view";
import { listAdminReviews } from "@/features/reviews/server/reviews";

export const metadata = {
  title: "Customer Reviews | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminReviewsPage() {
  const reviews = await listAdminReviews();
  return <ReviewsModerationView reviews={reviews} />;
}
