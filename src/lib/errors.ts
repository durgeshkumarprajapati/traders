/** Application error with a safe, user-facing message separate from internal detail. */
export class AppError extends Error {
  constructor(
    public readonly code:
      | "VALIDATION"
      | "NOT_FOUND"
      | "CONFLICT"
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "UPSTREAM"
      | "INTERNAL",
    public readonly publicMessage: string,
    options?: { cause?: unknown },
  ) {
    super(publicMessage, options);
    this.name = "AppError";
  }
}

const STATUS = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UPSTREAM: 502,
  INTERNAL: 500,
} as const;

/** Convert any thrown value into a safe JSON response; never leaks internals. */
export function toErrorResponse(err: unknown): Response {
  const e =
    err instanceof AppError
      ? err
      : new AppError("INTERNAL", "Something went wrong.", { cause: err });
  return Response.json(
    { error: { code: e.code, message: e.publicMessage } },
    { status: STATUS[e.code] },
  );
}
