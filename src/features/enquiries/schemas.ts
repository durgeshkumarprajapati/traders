import { z } from "zod";

/**
 * Client-safe input schemas for the enquiry forms. Phase 6 reuses them on the server
 * (the server must re-validate and must never trust client prices/names).
 * The mobile rule is PROVISIONAL (10-digit Indian mobile, optional +91) until the owner confirms it.
 */
export const text = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .min(min, `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

export const mobileSchema = z
  .string()
  .trim()
  .min(1, "Mobile number is required.")
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit mobile number.");

export const optionalEmail = z
  .string()
  .trim()
  .max(254, "Email is too long.")
  .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email address.");

export const contactEnquirySchema = z.object({
  name: text("Name", 2, 100),
  mobile: mobileSchema,
  email: optionalEmail,
  message: text("Message", 10, 1000),
});

export const bulkItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z
    .number({ message: "Enter a quantity." })
    .positive("Quantity must be greater than 0.")
    .max(1_000_000, "Quantity is too large."),
});

export const bulkEnquirySchema = z.object({
  name: text("Name", 2, 100),
  mobile: mobileSchema,
  email: optionalEmail,
  deliveryLocation: text("Delivery location", 3, 300),
  message: z.string().trim().max(1000, "Message must be at most 1000 characters."),
  items: z
    .array(bulkItemSchema)
    .min(1, "Add at least one product to your enquiry list.")
    .max(50, "An enquiry can contain at most 50 products."),
});

export type FieldErrors = Record<string, string>;

/** First error message per field path (items.0.quantity → "items"). */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
