import "server-only";
import { z } from "zod";
import { SHEETS_SCOPES, type SheetsConfig, type SheetsScope } from "./config";
import { SheetsAuthError, SheetsError } from "./errors";
import { GOOGLE_TOKEN_URL, signServiceAccountJwt } from "./jwt";
import { READ_POLICY, defaultHttpDeps, fetchWithPolicy, type HttpDeps } from "./http";

const tokenResponse = z.object({
  access_token: z.string().min(10),
  expires_in: z.number().positive(),
});
const tokenError = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
});

/** Refresh when fewer than this many seconds remain. */
const REFRESH_MARGIN_SECONDS = 60;

export type TokenProvider = { getAccessToken(scope: SheetsScope): Promise<string> };

/**
 * Service-account OAuth token provider. Tokens are cached per scope (read vs write) and concurrent
 * requests share one in-flight exchange. This in-memory cache is only a latency/quota optimisation:
 * every instance can mint its own token, so nothing depends on it for correctness.
 */
export function createTokenProvider(
  config: SheetsConfig,
  deps: HttpDeps = defaultHttpDeps,
): TokenProvider {
  const cache = new Map<SheetsScope, { token: string; expiresAtMs: number }>();
  const inflight = new Map<SheetsScope, Promise<string>>();

  async function exchange(scope: SheetsScope): Promise<string> {
    const nowMs = deps.now();
    let assertion: string;
    try {
      assertion = signServiceAccountJwt({
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
        scope: SHEETS_SCOPES[scope],
        nowSeconds: Math.floor(nowMs / 1000),
      });
    } catch {
      // Deliberately drop the original error: key-parsing messages must not reach logs.
      throw new SheetsAuthError(
        "the service-account private key could not be used to sign a token (check GOOGLE_PRIVATE_KEY)",
      );
    }
    const res = await fetchWithPolicy(
      GOOGLE_TOKEN_URL,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion,
        }).toString(),
      },
      READ_POLICY,
      deps,
    );
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const e = tokenError.safeParse(body);
      const code = e.success && e.data.error ? e.data.error : `HTTP ${res.status}`;
      throw new SheetsAuthError(
        `token endpoint rejected the request (${code}). Check the service-account e-mail/key and that the account is enabled`,
      );
    }
    const ok = tokenResponse.safeParse(body);
    if (!ok.success) throw new SheetsAuthError("token endpoint returned an unexpected response");
    cache.set(scope, {
      token: ok.data.access_token,
      expiresAtMs: nowMs + ok.data.expires_in * 1000,
    });
    return ok.data.access_token;
  }

  return {
    async getAccessToken(scope) {
      const hit = cache.get(scope);
      if (hit && hit.expiresAtMs - deps.now() > REFRESH_MARGIN_SECONDS * 1000) return hit.token;
      const pending = inflight.get(scope);
      if (pending) return pending;
      const p = exchange(scope)
        .catch((err: unknown) => {
          throw err instanceof SheetsError
            ? err
            : new SheetsAuthError("unexpected error while requesting a token", { cause: err });
        })
        .finally(() => inflight.delete(scope));
      inflight.set(scope, p);
      return p;
    },
  };
}
