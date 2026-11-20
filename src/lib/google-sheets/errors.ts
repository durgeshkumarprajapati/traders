import { AppError } from "@/lib/errors";

/**
 * Sheets error hierarchy. `publicMessage` is generic and safe to show; `detail` is for logs and
 * the dev diagnostics page. Neither may contain credentials, tokens or private keys.
 */
export class SheetsError extends AppError {
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

const UNAVAILABLE = "Product data is temporarily unavailable.";

/** Required environment is missing/invalid. Carries variable NAMES only, never values. */
export class SheetsConfigError extends SheetsError {
  constructor(
    public readonly missing: string[],
    public readonly invalid: string[],
  ) {
    super(
      "INTERNAL",
      "The product data source is not configured.",
      `Google Sheets configuration problem. Missing: [${missing.join(", ")}] Invalid: [${invalid.join(", ")}]`,
    );
  }
}

export class SheetsAuthError extends SheetsError {
  constructor(detail: string, options?: { cause?: unknown }) {
    super("UPSTREAM", UNAVAILABLE, `Google authentication failed: ${detail}`, options);
  }
}

export class SheetsApiError extends SheetsError {
  constructor(
    detail: string,
    public readonly status: number | null,
    public readonly retryable: boolean,
    options?: { cause?: unknown },
  ) {
    super("UPSTREAM", UNAVAILABLE, detail, options);
  }
}

export class SheetsTimeoutError extends SheetsApiError {
  constructor(timeoutMs: number) {
    super(`Google Sheets request timed out after ${timeoutMs} ms`, null, true);
  }
}

/** Worksheet missing, headers missing/duplicated, or worksheet too large: the sheet cannot be mapped. */
export class SheetsStructureError extends SheetsError {
  constructor(
    public readonly worksheet: string,
    detail: string,
    public readonly missingColumns: string[] = [],
  ) {
    super("INTERNAL", UNAVAILABLE, `Worksheet "${worksheet}": ${detail}`);
  }
}

export class SheetsNotFoundError extends SheetsError {
  constructor(what: string) {
    super("NOT_FOUND", "That record does not exist.", `${what} was not found`);
  }
}

/** The row changed since it was read (optimistic concurrency) or the identifier is ambiguous. */
export class SheetsConflictError extends SheetsError {
  constructor(detail: string) {
    super("CONFLICT", "This record was changed by someone else. Reload and try again.", detail);
  }
}
