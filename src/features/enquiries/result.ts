/** Result of an enquiry submission Server Action. Serialisable and safe to show: no internal detail. */
export type EnquiryActionResult =
  | {
      ok: true;
      /** Reference number of the saved enquiry; null only when the submission was silently discarded (honeypot). */
      reference: string | null;
    }
  | { ok: false; code: "VALIDATION"; message: string; fieldErrors: Record<string, string> }
  | { ok: false; code: "RATE_LIMITED"; message: string; retryAfterSeconds: number }
  | { ok: false; code: "INVALID_PRODUCTS"; message: string; productIds: string[] }
  | { ok: false; code: "UNAVAILABLE"; message: string };

export const ENQUIRY_MESSAGES = {
  validation: "Please check the highlighted fields and try again.",
  unavailable:
    "We could not save your enquiry right now. Please try again in a few minutes, or contact us directly.",
  invalidProducts:
    "Some products are no longer available. Remove them from your list and try again.",
} as const;
