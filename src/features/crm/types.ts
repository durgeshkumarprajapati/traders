export const CUSTOMER_TYPES = [
  "INDIVIDUAL",
  "CONTRACTOR",
  "BUILDER",
  "ARCHITECT",
  "DEALER",
  "COMMERCIAL",
  "OTHER",
] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const RELATIONSHIP_TIERS = ["STANDARD", "REGULAR", "PREFERRED", "STRATEGIC"] as const;
export type RelationshipTier = (typeof RELATIONSHIP_TIERS)[number];

export const PROGRAMME_STATUSES = ["NONE", "ACTIVE", "PAUSED", "INACTIVE"] as const;
export type ProgrammeStatus = (typeof PROGRAMME_STATUSES)[number];

export const LIFECYCLE_STATUSES = ["LEAD", "ACTIVE", "REPEAT", "INACTIVE"] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const INTERACTION_TYPES = [
  "PHONE_CALL",
  "WHATSAPP",
  "IN_PERSON",
  "EMAIL",
  "OTHER",
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const FOLLOWUP_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type FollowupPriority = (typeof FOLLOWUP_PRIORITIES)[number];

export const FOLLOWUP_STATUSES = ["PENDING", "COMPLETED", "CANCELLED"] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

export interface CustomerRecord {
  id: string;
  name: string;
  mobile: string;
  rawMobile: string | null;
  email: string | null;
  companyName: string | null;
  address: string | null;
  customerType: CustomerType;
  relationshipTier: RelationshipTier;
  isContractor: boolean;
  contractorClassification: string | null;
  serviceArea: string | null;
  preferredCategories: string[];
  preferredBrands: string[];
  relationshipManagerId: string | null;
  programmeStatus: ProgrammeStatus;
  lifecycleStatus: LifecycleStatus;
  whatsappOptIn: boolean;
  firstInteractionAt: string;
  lastInteractionAt: string;
  mergedIntoId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSummary extends CustomerRecord {
  enquiryCount: number;
  quotationCount: number;
  orderCount: number;
  confirmedOrderCount: number;
  isRepeatEnquiry: boolean;
  isRepeatBuyer: boolean;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInteraction {
  id: string;
  customerId: string;
  enquiryId: string | null;
  interactionType: InteractionType;
  occurredAt: string;
  summary: string;
  nextAction: string | null;
  authorId: string;
  authorName?: string;
  createdAt: string;
}

export interface CustomerFollowup {
  id: string;
  customerId: string;
  customerName?: string;
  customerMobile?: string;
  enquiryId: string | null;
  quotationId: string | null;
  title: string;
  description: string | null;
  dueAt: string;
  priority: FollowupPriority;
  status: FollowupStatus;
  assignedTo: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTimelineEvent {
  id: string;
  kind:
    | "ENQUIRY"
    | "CALLBACK"
    | "QUOTATION"
    | "QUOTATION_RESPONSE"
    | "ORDER"
    | "ORDER_STATUS"
    | "INTERACTION"
    | "FOLLOWUP";
  title: string;
  description: string | null;
  occurredAt: string;
  href?: string;
}

export interface CustomerListFilter {
  search?: string;
  customerType?: CustomerType | "ALL";
  repeatFilter?: "ALL" | "NEW" | "REPEAT_ENQUIRY" | "REPEAT_BUYER";
  page?: number;
  pageSize?: number;
}
