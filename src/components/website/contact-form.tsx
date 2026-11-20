"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { FormErrorSummary } from "@/components/common/form-error-summary";
import { HoneypotField } from "@/components/common/honeypot-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { submitContactEnquiryAction } from "@/features/enquiries/actions";
import {
  contactEnquirySchema,
  toFieldErrors,
  type FieldErrors,
} from "@/features/enquiries/schemas";
import { EnquiryReceived } from "./enquiry-received";
import { useEnquirySubmit } from "./use-enquiry-submit";

/** General contact enquiry form: validates in the browser for convenience, then the SERVER re-validates and saves it. */
export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const received = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    reference: string | null;
    mode?: "PERSISTED" | "EMAIL_FALLBACK";
    message?: string;
  } | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const { submit, pending } = useEnquirySubmit(submitContactEnquiryAction);

  // Move focus to the error summary (or the confirmation) so the outcome is announced.
  useEffect(() => {
    if (focusTick === 0) return;
    (summary.current ?? received.current)?.focus();
  }, [focusTick]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "");
    const values = {
      name: get("name"),
      mobile: get("mobile"),
      email: get("email"),
      message: get("message"),
    };
    const parsed = contactEnquirySchema.safeParse(values);
    setSubmissionResult(null);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      setFormMessage(null);
      setFocusTick((t) => t + 1);
      return;
    }
    setErrors({});
    setFormMessage(null);
    submit({ ...values, website: get("website") }, (r) => {
      if (r.ok) {
        setSubmissionResult({ reference: r.reference, mode: r.mode, message: r.message });
        formRef.current?.reset();
      } else {
        setErrors(r.code === "VALIDATION" ? r.fieldErrors : {});
        setFormMessage(r.message);
      }
      setFocusTick((t) => t + 1);
    });
  }

  const messages = [
    ...Object.values(errors),
    ...(formMessage && Object.keys(errors).length === 0 ? [formMessage] : []),
  ];

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="space-y-gutter-md"
      aria-label="General enquiry"
      aria-busy={pending}
    >
      {submissionResult && (
        <EnquiryReceived
          ref={received}
          reference={submissionResult.reference}
          mode={submissionResult.mode}
          message={submissionResult.message}
        />
      )}
      <FormErrorSummary ref={summary} messages={messages} />
      <HoneypotField />
      <Field label="Your name" required error={errors.name}>
        {(p) => <Input name="name" autoComplete="name" maxLength={100} {...p} />}
      </Field>
      <Field
        label="Mobile number"
        required
        error={errors.mobile}
        helper="10-digit mobile number; we may reply on WhatsApp or by phone."
      >
        {(p) => <Input name="mobile" type="tel" inputMode="tel" autoComplete="tel" {...p} />}
      </Field>
      <Field label="Email (optional)" error={errors.email}>
        {(p) => <Input name="email" type="email" autoComplete="email" maxLength={254} {...p} />}
      </Field>
      <Field label="Message" required error={errors.message}>
        {(p) => (
          <Textarea
            name="message"
            rows={5}
            maxLength={1000}
            placeholder="Describe the materials you need and where they should be delivered."
            {...p}
          />
        )}
      </Field>
      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Sending…" : "Send enquiry"}
      </Button>
    </form>
  );
}
