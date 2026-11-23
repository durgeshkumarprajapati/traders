import { z } from "zod";
import { UNIT_CODES } from "@/features/products/units";

/** Server-side validation of admin quotation input (Server Actions are public HTTP endpoints; never trust the shape). */
export const quotationItemSchema = z.object({
  productId: z.string().trim().max(64).nullish(),
  sku: z.string().trim().max(64).nullish(),
  productName: z.string().trim().min(1, "Every line needs a description").max(200),
  brandName: z.string().trim().max(100).nullish(),
  unitCode: z.enum(UNIT_CODES),
  unitLabel: z.string().trim().min(1).max(40),
  quantity: z.number().positive("Quantity must be greater than zero").max(1_000_000),
  unitPrice: z.number().positive("Enter the quoted rate for every line").max(1_000_000_000),
  notes: z.string().trim().max(500).nullish(),
});

export const quotationInputSchema = z.object({
  enquiryId: z.string().uuid(),
  items: z.array(quotationItemSchema).min(1, "Add at least one line item").max(100),
  discountAmount: z.number().min(0).max(100_000_000_000).default(0),
  taxAmount: z.number().min(0).max(100_000_000_000).default(0),
  termsAndConditions: z.string().trim().max(3000).nullish(),
  validDays: z
    .number()
    .int()
    .min(1, "Validity must be 1–90 days")
    .max(90, "Validity must be 1–90 days"),
});

export type QuotationInput = z.infer<typeof quotationInputSchema>;
