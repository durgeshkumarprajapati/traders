import { z } from "zod";
import { REVIEW_MODERATION_STATUSES } from "./types";

export const submitOrderReviewSchema = z.object({
  token: z.string().min(32).max(128),
  overallRating: z.number().int().min(1).max(5),
  qualityRating: z.number().int().min(1).max(5),
  deliveryRating: z.number().int().min(1).max(5),
  serviceRating: z.number().int().min(1).max(5),
  feedback: z.string().trim().max(2000).optional(),
  reviewerDisplayName: z.string().trim().max(100).optional(),
  consentToPublish: z.boolean().default(false),
});

export const moderateReviewSchema = z.object({
  reviewId: z.string().uuid(),
  status: z.enum(REVIEW_MODERATION_STATUSES),
});
