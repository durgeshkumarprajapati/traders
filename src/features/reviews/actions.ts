"use server";

import { revalidatePath } from "next/cache";
import { hashTrackingToken } from "@/features/enquiries/server/tracking";
import { guardTokenAccess } from "@/features/quotations/server/access";
import { withAdminAction, type AdminActionResult } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { loadSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseRpc } from "@/lib/supabase/rest";
import { moderateReviewSchema, submitOrderReviewSchema } from "./schemas";
import type { ReviewModerationStatus } from "./types";

export async function submitOrderReviewAction(
  rawInput: unknown,
): Promise<{ ok: true; reviewId: string } | { ok: false; message: string }> {
  const parsed = submitOrderReviewSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid review." };
  }
  const gate = await guardTokenAccess();
  if (!gate.allowed) return { ok: false, message: "Too many attempts. Please wait a few minutes." };

  const v = parsed.data;
  try {
    const rpc = createSupabaseRpc(loadSupabaseConfig());
    const res = await rpc<{ ok: boolean; reason?: string; review_id?: string }>(
      "submit_order_review",
      {
        p_token_hash: hashTrackingToken(v.token),
        p_overall: v.overallRating,
        p_quality: v.qualityRating,
        p_delivery: v.deliveryRating,
        p_service: v.serviceRating,
        p_feedback: v.feedback ?? null,
        p_display_name: v.reviewerDisplayName ?? null,
        p_consent: v.consentToPublish,
      },
    );
    if (!res?.ok || !res.review_id) {
      if (res?.reason === "NOT_DELIVERED") {
        return { ok: false, message: "Reviews can be submitted once the order is delivered." };
      }
      if (res?.reason === "ALREADY_REVIEWED") {
        return { ok: false, message: "A review has already been submitted for this order." };
      }
      return { ok: false, message: "Unable to submit review for this order." };
    }
    revalidatePath(`/order/${v.token}`);
    revalidatePath("/admin/reviews");
    return { ok: true, reviewId: res.review_id };
  } catch (error) {
    logger.error("submit_order_review_failed", { error });
    return { ok: false, message: "Could not submit review right now." };
  }
}

export async function moderateReviewAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string; status: ReviewModerationStatus }>> {
  const parsed = moderateReviewSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", message: "Invalid moderation request." };
  }
  return withAdminAction("moderateReview", async (admin, client) => {
    const { error } = await client
      .from("customer_reviews")
      .update({
        moderation_status: parsed.data.status,
        moderated_by: admin.id,
        moderated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.reviewId);

    if (error) throw new AppError("INTERNAL", "Failed to update review status.");
    await client.from("audit_logs").insert({
      actor_id: admin.id,
      actor_type: "ADMIN",
      action: `REVIEW_${parsed.data.status}`,
      entity_type: "customer_review",
      entity_id: parsed.data.reviewId,
      details: { status: parsed.data.status },
    });
    revalidatePath("/admin/reviews");
    revalidatePath("/");
    return { id: parsed.data.reviewId, status: parsed.data.status };
  });
}
