import "server-only";

/**
 * Customer-facing transactional email (rate-alert confirmations and notifications).
 *
 * NO PROVIDER IS CONFIGURED. Web3Forms (the only email integration in this project) is a form relay that emails the BUSINESS owner;
 * it cannot send to arbitrary customer addresses and must not be used for that. Until the owner approves and verifies a real
 * transactional provider (domain/sender verification, DKIM/SPF, a suppression/bounce policy), this returns null and every feature
 * that needs it reports "unavailable" instead of pretending to send. Adding a provider means implementing `CustomerEmailProvider`
 * here and nowhere else. See docs/PHASE_13_REPORT.md.
 */
export type CustomerEmail = { to: string; subject: string; text: string };
export type CustomerEmailResult = { ok: true } | { ok: false; error: string };
export type CustomerEmailProvider = {
  send: (message: CustomerEmail) => Promise<CustomerEmailResult>;
};

export function loadCustomerEmailProvider(): CustomerEmailProvider | null {
  return null;
}
