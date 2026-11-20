import { z } from "zod";
import { mobileSchema, optionalEmail, text } from "./schemas";

/**
 * SERVER-SIDE input contracts for the public enquiry forms. Re-validate everything the browser sent.
 * Unknown keys are stripped (zod default), so client-supplied product names, brands, units or prices can
 * never reach the database: bulk items carry ONLY a product id and a quantity.
 */
const idempotencyKey = z.uuid("Invalid submission key.");

/** Honeypot field: real people never see it; bots fill it. Checked on the RAW input before validation. */
export const HONEYPOT_FIELD = "website";

export const submissionItemSchema = z.object({
  productId: z
    .string()
    .trim()
    .min(1, "Product is required.")
    .max(64, "Invalid product.")
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid product."),
  quantity: z
    .number({ error: "Enter a quantity." })
    .positive("Quantity must be greater than 0.")
    .max(1_000_000, "Quantity is too large.")
    .refine(
      (q) =>
        Number.isInteger(Math.round(q * 1000)) && Math.abs(q * 1000 - Math.round(q * 1000)) < 1e-6,
      "Quantity can have at most 3 decimal places.",
    ),
});

const common = {
  idempotencyKey,
  name: text("Name", 2, 100),
  mobile: mobileSchema,
  email: optionalEmail,
  [HONEYPOT_FIELD]: z.string().max(200).optional(),
};

export const bulkSubmissionSchema = z
  .object({
    ...common,
    deliveryLocation: text("Delivery location", 3, 300),
    message: z.string().trim().max(1000, "Message must be at most 1000 characters."),
    items: z
      .array(submissionItemSchema)
      .min(1, "Add at least one product to your enquiry list.")
      .max(50, "An enquiry can contain at most 50 products."),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    for (const [i, it] of v.items.entries()) {
      if (seen.has(it.productId)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", i, "productId"],
          message: "Each product can appear only once.",
        });
      }
      seen.add(it.productId);
    }
  });

export const contactSubmissionSchema = z.object({
  ...common,
  message: text("Message", 10, 1000),
});

export type BulkSubmission = z.infer<typeof bulkSubmissionSchema>;
export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;

/** First message per top-level field (camelCase, as the forms use them). */
export function toSubmissionFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] === "idempotencyKey" ? "form" : String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
