"use client";

import { useRef, useState, useTransition } from "react";
import { ENQUIRY_MESSAGES, type EnquiryActionResult } from "@/features/enquiries/result";

function newKey(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Submit an enquiry through a Server Action with an idempotency key.
 * The SAME key is reused until a submission succeeds, so retrying after a network failure or timeout can
 * never create a duplicate enquiry; after a success the next enquiry gets a fresh key.
 */
export function useEnquirySubmit(action: (input: unknown) => Promise<EnquiryActionResult>) {
  const key = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<EnquiryActionResult | null>(null);

  function submit(payload: Record<string, unknown>, onDone?: (r: EnquiryActionResult) => void) {
    key.current ??= newKey();
    const idempotencyKey = key.current;
    // Enquiries are online-only: never attempt (or appear to complete) a submission without a connection.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const offline: EnquiryActionResult = {
        ok: false,
        code: "UNAVAILABLE",
        message: ENQUIRY_MESSAGES.offline,
      };
      setResult(offline);
      onDone?.(offline);
      return;
    }
    startTransition(async () => {
      let r: EnquiryActionResult;
      try {
        r = await action({ ...payload, idempotencyKey });
      } catch {
        r = { ok: false, code: "UNAVAILABLE", message: ENQUIRY_MESSAGES.unavailable };
      }
      if (r.ok) key.current = null;
      setResult(r);
      onDone?.(r);
    });
  }

  return { submit, pending, result, clear: () => setResult(null) };
}
