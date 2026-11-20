import "server-only";
import { SheetsApiError, SheetsTimeoutError } from "./errors";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type HttpDeps = {
  fetch: FetchLike;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  now: () => number;
};

export const defaultHttpDeps: HttpDeps = {
  fetch: (input, init) => fetch(input, init),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  random: Math.random,
  now: () => Date.now(),
};

export type RequestPolicy = {
  /** Per-attempt timeout. */
  timeoutMs: number;
  /** Retries after the first attempt. */
  maxRetries: number;
  /** Total wall-clock budget; no retry starts if it cannot finish inside this. */
  deadlineMs: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Which HTTP statuses may be retried for this call (writes that are not idempotent pass a narrow set). */
  retryStatuses: readonly number[];
  /** Whether network errors / timeouts may be retried (false for non-idempotent writes). */
  retryOnNetworkError: boolean;
};

export const READ_POLICY: RequestPolicy = {
  timeoutMs: 6000,
  maxRetries: 2,
  deadlineMs: 15000,
  baseDelayMs: 300,
  maxDelayMs: 4000,
  retryStatuses: [429, 500, 502, 503, 504],
  retryOnNetworkError: true,
};

/** Idempotent write (same values written again): safe to retry like a read. */
export const IDEMPOTENT_WRITE_POLICY: RequestPolicy = { ...READ_POLICY };

/** Non-idempotent append: only 429 is retried; a timeout or 5xx may have applied the write already. */
export const APPEND_POLICY: RequestPolicy = {
  ...READ_POLICY,
  retryStatuses: [429],
  retryOnNetworkError: false,
};

/** Retry-After in seconds (Google sends seconds). HTTP-date form is ignored → normal backoff. */
export function parseRetryAfterMs(header: string | null, maxMs: number): number | null {
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, maxMs) : null;
}

/** fetch with timeout, bounded exponential backoff + jitter, Retry-After support and a total deadline. */
export async function fetchWithPolicy(
  url: string,
  init: RequestInit,
  policy: RequestPolicy,
  deps: HttpDeps = defaultHttpDeps,
): Promise<Response> {
  const started = deps.now();
  let lastError: unknown;
  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), policy.timeoutMs);
    let retryAfter: number | null = null;
    try {
      const res = await deps.fetch(url, { ...init, signal: controller.signal });
      if (!policy.retryStatuses.includes(res.status) || attempt === policy.maxRetries) return res;
      retryAfter = parseRetryAfterMs(res.headers.get("retry-after"), policy.maxDelayMs);
      lastError = new SheetsApiError(`Google responded with HTTP ${res.status}`, res.status, true);
      await res.body?.cancel().catch(() => undefined);
    } catch (err) {
      const timedOut = controller.signal.aborted;
      lastError = timedOut ? new SheetsTimeoutError(policy.timeoutMs) : err;
      if (!policy.retryOnNetworkError || attempt === policy.maxRetries) {
        throw timedOut
          ? lastError
          : new SheetsApiError("Network error contacting Google", null, true, { cause: err });
      }
    } finally {
      clearTimeout(timer);
    }
    const backoff = Math.min(policy.baseDelayMs * 2 ** attempt, policy.maxDelayMs);
    const delay = retryAfter ?? backoff + Math.floor(deps.random() * policy.baseDelayMs);
    if (deps.now() - started + delay > policy.deadlineMs) break;
    await deps.sleep(delay);
  }
  throw lastError instanceof SheetsApiError
    ? lastError
    : new SheetsApiError("Google request failed", null, true, { cause: lastError });
}
