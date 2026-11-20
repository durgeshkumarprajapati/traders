import "server-only";
import { z } from "zod";

export type EmailMessage = { subject: string; text: string; fromName: string; replyTo?: string };

export type EmailFailureKind = "TIMEOUT" | "NETWORK" | "HTTP" | "REJECTED";
export type EmailResult =
  | { ok: true }
  | {
      ok: false;
      kind: EmailFailureKind;
      status: number | null;
      retryable: boolean;
      summary: string;
    };

export type Web3FormsConfig = { accessKey: string };

/** Web3Forms access keys are UUIDs. Returns null when the key is missing or malformed (never throws, never echoes the value). */
export function loadWeb3FormsConfig(
  env: Record<string, string | undefined> = process.env,
): Web3FormsConfig | null {
  const key = env.WEB3FORMS_ACCESS_KEY?.trim();
  return key && /^[A-Za-z0-9-]{16,64}$/.test(key) ? { accessKey: key } : null;
}

export const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
export const EMAIL_TIMEOUT_MS = 8000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
const response = z.object({ success: z.boolean().optional(), message: z.string().optional() });

/** Provider text is kept short and stripped of control characters before it is stored or logged. */
const clean = (s: string) =>
  s
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 100);

/**
 * Send ONE email through Web3Forms (server-side; the access key never leaves the server).
 * Returns a classified result instead of throwing; the summary is safe to store (no key, no recipient,
 * no customer data). Retrying is the outbox's job, not this function's.
 */
export async function sendWeb3FormsEmail(
  config: Web3FormsConfig,
  message: EmailMessage,
  fetchImpl: FetchLike = (u, i) => fetch(u, i),
): Promise<EmailResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  try {
    const res = await fetchImpl(WEB3FORMS_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        access_key: config.accessKey,
        subject: message.subject,
        from_name: message.fromName,
        ...(message.replyTo ? { replyto: message.replyTo } : {}),
        message: message.text,
      }),
      signal: controller.signal,
    });
    const body = response.safeParse(await res.json().catch(() => null));
    const providerMessage = body.success && body.data.message ? clean(body.data.message) : "";
    if (res.ok && body.success && body.data.success === true) return { ok: true };
    const transient = res.status >= 500 || res.status === 429;
    return {
      ok: false,
      kind: res.ok ? "REJECTED" : "HTTP",
      status: res.status,
      retryable: transient,
      summary: `Web3Forms ${res.ok ? "rejected the message" : `returned HTTP ${res.status}`}${providerMessage ? `: ${providerMessage}` : ""}`,
    };
  } catch {
    return controller.signal.aborted
      ? {
          ok: false,
          kind: "TIMEOUT",
          status: null,
          retryable: true,
          summary: `Web3Forms did not respond within ${EMAIL_TIMEOUT_MS} ms`,
        }
      : {
          ok: false,
          kind: "NETWORK",
          status: null,
          retryable: true,
          summary: "Network error contacting Web3Forms",
        };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Owner-facing, plain-language next step for a failed send. For the operator (test route / docs) — never shown to
 * customers. Contains no secrets and makes no claim beyond what the classified result proves.
 */
export function explainEmailFailure(result: Extract<EmailResult, { ok: false }>): string {
  if (result.kind === "TIMEOUT" || result.kind === "NETWORK")
    return "The server could not reach Web3Forms (timeout or network error). This is usually temporary: run the test again, and check the host's outbound network access.";
  if (result.status === 401 || result.status === 403)
    return "Web3Forms refused the request. Check that WEB3FORMS_ACCESS_KEY is correct, active and its recipient email is verified. Web3Forms may also restrict server-side (API) submissions on its free plan — confirm this with Web3Forms; a paid plan or a different email provider may be required.";
  if (result.status === 429)
    return "Web3Forms is rate limiting this key. Wait and retry; enquiries are kept and retried automatically.";
  if (result.status !== null && result.status >= 500)
    return "Web3Forms reported a server error. Enquiries are kept and retried automatically.";
  if (result.kind === "REJECTED" || result.status === 400 || result.status === 422)
    return "Web3Forms received the request but did not send an email. Check that WEB3FORMS_ACCESS_KEY is the key created for the inbox that should receive enquiries.";
  return "Web3Forms did not accept the message. See the summary for the provider's response.";
}
