import { AppError } from "@/lib/errors";

/**
 * Supabase error hierarchy. `publicMessage` is generic and safe to show; `detail` is for logs only.
 * Neither may contain the service-role key, request bodies, or database error text.
 */
export class SupabaseError extends AppError {
  constructor(
    code: ConstructorParameters<typeof AppError>[0],
    publicMessage: string,
    public readonly detail: string,
    options?: { cause?: unknown },
  ) {
    super(code, publicMessage, options);
    this.name = new.target.name;
  }
}

const UNAVAILABLE = "The service is temporarily unavailable.";

export class SupabaseConfigError extends SupabaseError {
  constructor(
    public readonly missing: string[],
    public readonly invalid: string[],
  ) {
    super(
      "INTERNAL",
      UNAVAILABLE,
      `Supabase configuration problem. Missing: [${missing.join(", ")}] Invalid: [${invalid.join(", ")}]`,
    );
  }
}

export class SupabaseApiError extends SupabaseError {
  constructor(
    detail: string,
    public readonly status: number | null,
    public readonly pgCode: string | null,
    public readonly retryable: boolean,
    options?: { cause?: unknown },
  ) {
    super("UPSTREAM", UNAVAILABLE, detail, options);
  }
}

export class SupabaseTimeoutError extends SupabaseApiError {
  constructor(timeoutMs: number) {
    super(`Supabase request timed out after ${timeoutMs} ms`, null, null, true);
  }
}
