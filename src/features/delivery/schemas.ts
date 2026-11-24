import { z } from "zod";
import { HONEYPOT_FIELD } from "@/features/enquiries/submission-schemas";
import { mobileSchema, optionalEmail, text } from "@/features/enquiries/schemas";
import { PIN_PATTERN, normalisePin } from "./coverage";

/** Public check (no personal data): just a PIN code. */
export const pinCheckSchema = z.object({
  pincode: z
    .string()
    .max(12)
    .transform(normalisePin)
    .refine((v) => PIN_PATTERN.test(v), "Enter a valid six-digit PIN code."),
});

/** Freight enquiry: a structured GENERAL enquiry. No price, no delivery promise is ever accepted or produced. */
export const freightSubmissionSchema = z.object({
  idempotencyKey: z.uuid("Invalid submission key."),
  name: text("Name", 2, 100),
  mobile: mobileSchema,
  email: optionalEmail,
  pincode: z
    .string()
    .max(12)
    .transform(normalisePin)
    .refine((v) => PIN_PATTERN.test(v), "Enter a valid six-digit PIN code."),
  locality: text("Locality or site address", 3, 200),
  materials: text("Materials needed", 3, 400),
  quantityNote: z.string().trim().max(200, "At most 200 characters.").default(""),
  message: z.string().trim().max(500, "At most 500 characters.").default(""),
  [HONEYPOT_FIELD]: z.string().max(200).optional(),
});
export type FreightSubmission = z.infer<typeof freightSubmissionSchema>;
