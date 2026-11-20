/**
 * Structured JSON logger with secret redaction.
 *
 * Redaction is applied recursively to every context value (objects, arrays,
 * Error instances incl. `cause`, Map/Set) and to string content (JWTs, Bearer
 * tokens, PEM private keys, URL credentials, `password=…` style pairs), so a
 * secret is not exposed merely because it is nested or appears inside a message.
 */
type Level = "debug" | "info" | "warn" | "error";

const REDACTED = "[redacted]";
const MAX_DEPTH = 6;
const MAX_ENTRIES = 100;

/** Normalised (lower-case, alphanumeric-only) key fragments that mark a value as secret. */
const SENSITIVE_PARTS = [
  "password",
  "passwd",
  "passphrase",
  "secret",
  "token",
  "apikey",
  "accesskey",
  "privatekey",
  "servicerole",
  "authorization",
  "cookie",
  "credential",
  "session",
  "bearer",
  "signature",
];
const SENSITIVE_EXACT = new Set(["key", "pass", "pwd", "auth"]);

export function isSensitiveKey(key: string): boolean {
  const n = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_EXACT.has(n) || SENSITIVE_PARTS.some((p) => n.includes(p));
}

const STRING_PATTERNS: Array<[RegExp, string]> = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, REDACTED],
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, REDACTED],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`],
  [/(\b[a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi, `$1${REDACTED}@`],
  [
    /\b(password|passwd|secret|token|api[_-]?key|access[_-]?key|authorization)=([^&\s]+)/gi,
    `$1=${REDACTED}`,
  ],
];

export function redactString(value: string): string {
  return STRING_PATTERNS.reduce((acc, [re, to]) => acc.replace(re, to), value);
}

function serializeError(err: Error, depth: number, seen: WeakSet<object>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: err.name,
    message: redactString(err.message),
  };
  if (err.stack) out.stack = redactString(err.stack);
  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause !== undefined) out.cause = redact(cause, depth + 1, seen);
  // Own enumerable extras (e.g. `code`, `digest`, library-specific fields).
  for (const [k, v] of Object.entries(err)) {
    if (k in out) continue;
    out[k] = isSensitiveKey(k) ? REDACTED : redact(v, depth + 1, seen);
  }
  return out;
}

/** Convert any value into a JSON-safe structure with secrets removed. Exported for tests and reuse. */
export function redact(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) return value;
  switch (typeof value) {
    case "string":
      return redactString(value);
    case "number":
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
    case "function":
    case "symbol":
      return `[${typeof value}]`;
  }
  const obj = value as object;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (seen.has(obj)) return "[circular]";
  seen.add(obj);
  try {
    if (obj instanceof Error) return serializeError(obj, depth, seen);
    if (obj instanceof Date)
      return Number.isNaN(obj.getTime()) ? "[invalid date]" : obj.toISOString();
    if (Array.isArray(obj)) return obj.slice(0, MAX_ENTRIES).map((v) => redact(v, depth + 1, seen));
    if (obj instanceof Set)
      return [...obj].slice(0, MAX_ENTRIES).map((v) => redact(v, depth + 1, seen));
    if (obj instanceof Map) {
      return Object.fromEntries(
        [...obj].slice(0, MAX_ENTRIES).map(([k, v]) => {
          const key = String(k);
          return [key, isSensitiveKey(key) ? REDACTED : redact(v, depth + 1, seen)];
        }),
      );
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj).slice(0, MAX_ENTRIES)) {
      out[k] = isSensitiveKey(k) ? REDACTED : redact(v, depth + 1, seen);
    }
    return out;
  } finally {
    seen.delete(obj); // allow the same object to appear in sibling branches
  }
}

function log(level: Level, message: string, ctx?: Record<string, unknown>) {
  let line: string;
  try {
    // Fixed fields come last so context can never overwrite level/message/time.
    line = JSON.stringify({
      ...(redact(ctx) as Record<string, unknown> | undefined),
      level,
      message: redactString(message),
      time: new Date().toISOString(),
    });
  } catch {
    line = JSON.stringify({
      level,
      message: "log serialisation failed",
      time: new Date().toISOString(),
    });
  }
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const logger = {
  debug: (m: string, c?: Record<string, unknown>) =>
    process.env.NODE_ENV !== "production" && log("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => log("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => log("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => log("error", m, c),
};
