import "server-only";
import { z } from "zod";
import type { SupabaseConfig } from "./config";
import { SupabaseApiError, SupabaseTimeoutError } from "./errors";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type RestDeps = {
  fetch: FetchLike;
  sleep: (ms: number) => Promise<void>;
  random: () => number;
};

export const defaultRestDeps: RestDeps = {
  fetch: (input, init) => fetch(input, init),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  random: Math.random,
};

/** Per-attempt timeout. Enquiry submission must never hang the customer's request. */
export const RPC_TIMEOUT_MS = 6000;

export type RpcOptions = {
  /** Extra attempts after the first. ONLY for idempotent functions (create_enquiry is idempotent per key). */
  retries?: number;
};

/** Call a database function (PostgREST RPC). Functions run in ONE transaction on the database side. */
export type Rpc = <T = unknown>(
  fn: string,
  args: Record<string, unknown>,
  options?: RpcOptions,
) => Promise<T>;

const pgError = z.object({ code: z.string().optional() });

export function createSupabaseRpc(config: SupabaseConfig, deps: RestDeps = defaultRestDeps): Rpc {
  return async function rpc<T>(
    fn: string,
    args: Record<string, unknown>,
    options: RpcOptions = {},
  ): Promise<T> {
    if (!/^[a-z_]+$/.test(fn))
      throw new SupabaseApiError("invalid function name", null, null, false);
    const url = `${config.url}/rest/v1/rpc/${fn}`;
    const retries = options.retries ?? 0;
    let last: SupabaseApiError | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
      try {
        const res = await deps.fetch(url, {
          method: "POST",
          headers: {
            apikey: config.serviceRoleKey,
            authorization: `Bearer ${config.serviceRoleKey}`,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(args),
          signal: controller.signal,
        });
        const text = await res.text();
        if (res.ok) return (text ? JSON.parse(text) : null) as T;
        // Never surface the database message (it can echo submitted data): keep only the SQLSTATE and HTTP status.
        let pgCode: string | null = null;
        try {
          const e = pgError.safeParse(JSON.parse(text));
          pgCode = e.success ? (e.data.code ?? null) : null;
        } catch {
          /* non-JSON error body */
        }
        last = new SupabaseApiError(
          `Supabase RPC ${fn} failed (HTTP ${res.status}${pgCode ? `, SQLSTATE ${pgCode}` : ""})`,
          res.status,
          pgCode,
          res.status >= 500 || res.status === 429,
        );
      } catch (err) {
        if (err instanceof SupabaseApiError) throw err;
        last = controller.signal.aborted
          ? new SupabaseTimeoutError(RPC_TIMEOUT_MS)
          : new SupabaseApiError(`Network error calling Supabase RPC ${fn}`, null, null, true, {
              cause: err,
            });
      } finally {
        clearTimeout(timer);
      }
      if (!last.retryable || attempt === retries) throw last;
      await deps.sleep(200 * 2 ** attempt + Math.floor(deps.random() * 100));
    }
    throw last ?? new SupabaseApiError("unreachable", null, null, false);
  };
}
