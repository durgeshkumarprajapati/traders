import type { DeliveryConfig } from "@/features/catalogue/types";

/**
 * Delivery coverage check. The owner lists PIN codes in the BusinessSettings sheet; this module only compares a customer's
 * PIN with that list. It NEVER guarantees delivery, never states a delivery time and never states a freight charge: the
 * strongest possible answer is "this PIN code is on the list the business has published; confirm with us".
 */
export type CoverageStatus =
  /** Not a six-digit PIN code. */
  | "INVALID"
  /** The owner has not configured delivery coverage (or the sheet is unavailable). */
  | "NOT_CONFIGURED"
  /** The PIN code is on the owner's list. */
  | "LISTED"
  /** The PIN code is not on the owner's list (delivery may still be possible by request). */
  | "NOT_LISTED";

export const PIN_PATTERN = /^[1-9][0-9]{5}$/;

export function normalisePin(input: string): string {
  return input.replace(/[\s-]/g, "");
}

export function isConfigured(config: DeliveryConfig | undefined | null): config is DeliveryConfig {
  return !!config && config.enabled && (config.pincodes.length > 0 || !!config.localities);
}

export function checkCoverage(
  pinInput: string,
  config: DeliveryConfig | undefined | null,
): CoverageStatus {
  const pin = normalisePin(pinInput);
  if (!PIN_PATTERN.test(pin)) return "INVALID";
  if (!isConfigured(config) || config.pincodes.length === 0) return "NOT_CONFIGURED";
  return config.pincodes.includes(pin) ? "LISTED" : "NOT_LISTED";
}

/** Customer-facing wording. None of these may promise delivery, a date or a price. */
export const COVERAGE_MESSAGES: Record<CoverageStatus, string> = {
  INVALID: "Enter a valid six-digit PIN code.",
  NOT_CONFIGURED:
    "We have not published a delivery area online yet. Please send a freight enquiry or contact us to ask whether we can deliver to you.",
  LISTED:
    "This PIN code is in the delivery area we have listed. Delivery is not guaranteed: availability, charges and timing depend on the material, quantity and site, and are confirmed by Sagar Traders. Send a freight enquiry to find out.",
  NOT_LISTED:
    "This PIN code is not in the delivery area we have listed. Delivery may still be possible for some orders: send a freight enquiry and Sagar Traders will tell you.",
};

export const FREIGHT_DISCLAIMER =
  "Sagar Traders does not show freight charges online. Charges and delivery timing are confirmed by the business after you send an enquiry.";
