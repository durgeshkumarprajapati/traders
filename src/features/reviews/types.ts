export const REVIEW_MODERATION_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "HIDDEN",
] as const;
export type ReviewModerationStatus = (typeof REVIEW_MODERATION_STATUSES)[number];

export interface PublicCustomerReview {
  id: string;
  overallRating: number;
  qualityRating: number;
  deliveryRating: number;
  serviceRating: number;
  feedback: string | null;
  reviewerDisplayName: string | null;
  consentToPublish: boolean;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface AdminCustomerReview extends PublicCustomerReview {
  orderId: string;
  orderReference?: string;
  moderationStatus: ReviewModerationStatus;
  moderatedAt: string | null;
}
