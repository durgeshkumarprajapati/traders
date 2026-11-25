import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminCustomerReview, PublicCustomerReview, ReviewModerationStatus } from "../types";

export async function listApprovedPublicReviews(limit = 6): Promise<PublicCustomerReview[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("customer_reviews")
      .select(
        "id, overall_rating, quality_rating, delivery_rating, service_rating, feedback, reviewer_display_name, consent_to_publish, verified_purchase, created_at",
      )
      .eq("moderation_status", "APPROVED")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      overallRating: Number(r.overall_rating),
      qualityRating: Number(r.quality_rating),
      deliveryRating: Number(r.delivery_rating),
      serviceRating: Number(r.service_rating),
      feedback: (r.feedback as string) || null,
      reviewerDisplayName: r.consent_to_publish
        ? ((r.reviewer_display_name as string) || null)
        : null,
      consentToPublish: Boolean(r.consent_to_publish),
      verifiedPurchase: Boolean(r.verified_purchase),
      createdAt: String(r.created_at),
    }));
  } catch {
    return [];
  }
}

export async function listAdminReviews(
  clientOverride?: SupabaseClient,
): Promise<AdminCustomerReview[]> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const { data } = await supabase
    .from("customer_reviews")
    .select("*, order:order_id(reference)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []).map((r: Record<string, unknown>) => {
    const ord = r.order as { reference?: string } | null;
    return {
      id: String(r.id),
      orderId: String(r.order_id),
      orderReference: ord?.reference,
      overallRating: Number(r.overall_rating),
      qualityRating: Number(r.quality_rating),
      deliveryRating: Number(r.delivery_rating),
      serviceRating: Number(r.service_rating),
      feedback: (r.feedback as string) || null,
      reviewerDisplayName: (r.reviewer_display_name as string) || null,
      consentToPublish: Boolean(r.consent_to_publish),
      verifiedPurchase: Boolean(r.verified_purchase),
      moderationStatus: String(r.moderation_status) as ReviewModerationStatus,
      moderatedAt: (r.moderated_at as string) || null,
      createdAt: String(r.created_at),
    };
  });
}
