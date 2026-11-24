"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { Notification } from "@/components/ui/notification";
import { ENQUIRY_MESSAGES, type EnquiryActionResult } from "@/features/enquiries/result";
import { HONEYPOT_FIELD } from "@/features/enquiries/submission-schemas";
import { EnquiryReceived } from "./enquiry-received";

/**
 * Shared plumbing for the freight and expert forms: one idempotency key per attempt, synchronous double-submit guard,
 * offline notice, server field errors, typed values kept on failure. Contact fields are rendered by the caller's children.
 */
export function useRequestForm(
  submit: (payload: Record<string, unknown>) => Promise<EnquiryActionResult>,
) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Extract<EnquiryActionResult, { ok: true }> | null>(null);
  const [isPending, startTransition] = useTransition();
  const key = useRef<string | null>(null);
  const inFlight = useRef(false);

  function send(fields: Record<string, unknown>, honeypot: string) {
    if (inFlight.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setServerError(ENQUIRY_MESSAGES.offline);
      return;
    }
    setErrors({});
    setServerError(null);
    key.current ??= crypto.randomUUID();
    inFlight.current = true;
    startTransition(async () => {
      let res: EnquiryActionResult;
      try {
        res = await submit({ ...fields, idempotencyKey: key.current, [HONEYPOT_FIELD]: honeypot });
      } catch {
        res = { ok: false, code: "UNAVAILABLE", message: ENQUIRY_MESSAGES.unavailable };
      } finally {
        inFlight.current = false;
      }
      if (res.ok) {
        setSuccess(res);
        key.current = null;
      } else {
        if (res.code === "VALIDATION") setErrors(res.fieldErrors);
        setServerError(res.message);
      }
    });
  }
  return { errors, serverError, success, isPending, send };
}

export function ContactFields({
  values,
  set,
  errors,
  honeypot,
  setHoneypot,
}: {
  values: { name: string; mobile: string; email: string };
  set: (k: "name" | "mobile" | "email", v: string) => void;
  errors: Record<string, string>;
  honeypot: string;
  setHoneypot: (v: string) => void;
}) {
  return (
    <>
      <div className="hidden" aria-hidden="true">
        <input
          tabIndex={-1}
          autoComplete="off"
          name={HONEYPOT_FIELD}
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      <Field label="Your name" required error={errors.name}>
        {(p) => (
          <Input
            {...p}
            value={values.name}
            maxLength={100}
            autoComplete="name"
            onChange={(e) => set("name", e.target.value)}
          />
        )}
      </Field>
      <Field label="Mobile number" required error={errors.mobile}>
        {(p) => (
          <Input
            {...p}
            type="tel"
            inputMode="tel"
            value={values.mobile}
            maxLength={16}
            autoComplete="tel"
            onChange={(e) => set("mobile", e.target.value)}
          />
        )}
      </Field>
      <Field label="Email (optional)" error={errors.email}>
        {(p) => (
          <Input
            {...p}
            type="email"
            value={values.email}
            maxLength={254}
            autoComplete="email"
            onChange={(e) => set("email", e.target.value)}
          />
        )}
      </Field>
    </>
  );
}

export function RequestShell({
  form,
  title,
  onSubmit,
  children,
  submitLabel,
}: {
  form: ReturnType<typeof useRequestForm>;
  title: string;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  submitLabel: string;
}) {
  if (form.success)
    return (
      <EnquiryReceived reference={form.success.reference} trackingUrl={form.success.trackingUrl} />
    );
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-busy={form.isPending}
      aria-label={title}
      className="space-y-4"
    >
      {form.serverError && (
        <Notification tone="error" title="We could not send your request">
          {form.serverError} Your details are still here — you can try again.
        </Notification>
      )}
      {children}
      <Button type="submit" size="lg" disabled={form.isPending} className="w-full sm:w-auto">
        {form.isPending ? "Sending…" : submitLabel}
      </Button>
    </form>
  );
}
