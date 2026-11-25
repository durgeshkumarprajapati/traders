import { z } from "zod";
import {
  CUSTOMER_TYPES,
  FOLLOWUP_PRIORITIES,
  FOLLOWUP_STATUSES,
  INTERACTION_TYPES,
  LIFECYCLE_STATUSES,
  PROGRAMME_STATUSES,
  RELATIONSHIP_TIERS,
} from "./types";

/**
 * Normalizes an Indian mobile number to its 10-digit form (`^[6-9]\d{9}$`),
 * stripping spaces, hyphens, parentheses, optional `+91`, `91`, or leading `0`.
 * Returns `null` if the input is not a valid 10-digit Indian mobile number.
 */
export function normalizeIndianMobile(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || !/^\+?[\d\s\-().]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return digits;
}

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).nullable().optional(),
  companyName: z.string().trim().max(150).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  customerType: z.enum(CUSTOMER_TYPES),
  relationshipTier: z.enum(RELATIONSHIP_TIERS),
  isContractor: z.boolean(),
  contractorClassification: z.string().trim().max(100).nullable().optional(),
  serviceArea: z.string().trim().max(150).nullable().optional(),
  preferredCategories: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  preferredBrands: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  programmeStatus: z.enum(PROGRAMME_STATUSES),
  lifecycleStatus: z.enum(LIFECYCLE_STATUSES),
  whatsappOptIn: z.boolean().optional(),
});

export const customerNoteSchema = z.object({
  customerId: z.string().uuid(),
  body: z.string().trim().min(1, "Note cannot be empty").max(2000),
});

export const updateCustomerNoteSchema = z.object({
  noteId: z.string().uuid(),
  customerId: z.string().uuid(),
  body: z.string().trim().min(1, "Note cannot be empty").max(2000),
});

export const customerInteractionSchema = z.object({
  customerId: z.string().uuid(),
  enquiryId: z.string().uuid().nullable().optional(),
  interactionType: z.enum(INTERACTION_TYPES),
  occurredAt: z.string().datetime().optional(),
  summary: z.string().trim().min(2, "Summary is required").max(2000),
  nextAction: z.string().trim().max(500).nullable().optional(),
});

export const createFollowupSchema = z.object({
  customerId: z.string().uuid(),
  enquiryId: z.string().uuid().nullable().optional(),
  quotationId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2, "Title is required").max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  dueAt: z.string().min(1, "Due date & time is required"),
  priority: z.enum(FOLLOWUP_PRIORITIES).default("MEDIUM"),
});

export const updateFollowupSchema = z.object({
  followupId: z.string().uuid(),
  status: z.enum(FOLLOWUP_STATUSES).optional(),
  dueAt: z.string().optional(),
  priority: z.enum(FOLLOWUP_PRIORITIES).optional(),
});

export const mergeCustomersSchema = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
});
