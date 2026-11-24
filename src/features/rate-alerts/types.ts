import { z } from "zod";
import { HONEYPOT_FIELD } from "@/features/enquiries/submission-schemas";
import { optionalEmail } from "@/features/enquiries/schemas";

export const RATE_ALERT_CONSENT_TEXT =
  "I agree to receive email alerts about this product's listed rate. I can unsubscribe at any time.";

export const RATE_ALERT_MESSAGES = {
  unavailable:
    "Rate alerts are not available yet. We have not set up a way to email customers, so no subscription can be created. Please contact us for current rates.",
  // The same text is returned for a new and an already-subscribed address, so the form cannot be used to discover who is subscribed.
  checkInbox:
    "If this address can receive alerts, we have sent a confirmation email. Alerts only start after you confirm it.",
} as const;

const PRICE = /^\d{1,7}(\.\d{1,2})?$/;

export const rateAlertSubscribeSchema = z
  .object({
    productId: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid product."),
    email: optionalEmail.refine((v) => v !== "", "Email is required."),
    alertType: z.enum(["ANY_CHANGE", "DROPS_BELOW"]),
    targetPrice: z.string().trim().default(""),
    consent: z.literal(true, { error: "Please agree to receive alerts." }),
    [HONEYPOT_FIELD]: z.string().max(200).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.alertType === "DROPS_BELOW" && (!PRICE.test(v.targetPrice) || Number(v.targetPrice) <= 0))
      ctx.addIssue({
        code: "custom",
        path: ["targetPrice"],
        message: "Enter a target rate in rupees, for example 350 or 349.50.",
      });
  });

export type RateAlertResult =
  | { ok: true; message: string }
  | { ok: false; code: "VALIDATION"; message: string; fieldErrors: Record<string, string> }
  | { ok: false; code: "RATE_LIMITED" | "UNAVAILABLE" | "INVALID_PRODUCT"; message: string };

/** Rupees (number from the sheet, at most 2 decimals) to integer paise. */
export const toPaise = (rupees: number): number => Math.round(rupees * 100);

/** "349.5" → 34950 by integer string arithmetic (no floating point). */
export function parseRupeesToPaise(input: string): number | null {
  if (!PRICE.test(input)) return null;
  const [whole, frac = ""] = input.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatPaise(paise: number): string {
  const whole = Math.trunc(paise / 100).toLocaleString("en-IN");
  return `₹${whole}.${String(paise % 100).padStart(2, "0")}`;
}
