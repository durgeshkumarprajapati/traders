"use client";

import { useRef, useState, useTransition } from "react";
import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { Notification } from "@/components/ui/notification";
import { submitCallbackEnquiryAction } from "@/features/enquiries/callback-actions";
import { ENQUIRY_MESSAGES } from "@/features/enquiries/result";
import {
  CALLBACK_MAX_DAYS_AHEAD,
  CALLBACK_TIME_WINDOWS,
  CALLBACK_TIME_WINDOW_LABELS,
  istDatePlusDays,
  istToday,
  type CallbackTimeWindow,
} from "@/features/enquiries/callback-schemas";
import { HONEYPOT_FIELD } from "@/features/enquiries/submission-schemas";
import { parsePhone } from "@/lib/phone";
import { CallButton, WhatsAppButton } from "./contact-actions";
import { EnquiryReceived } from "./enquiry-received";

export type CallbackContact = { phone?: string | null; whatsappNumber?: string | null };

interface CallbackModalProps {
  open: boolean;
  onClose: () => void;
  defaultReason?: string;
  contact?: CallbackContact;
}

const MOBILE = /^[6-9][0-9]{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CallbackModal({ open, onClose, defaultReason = "", contact }: CallbackModalProps) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTimeWindow, setPreferredTimeWindow] = useState<CallbackTimeWindow>("ANYTIME");
  const [reason, setReason] = useState(defaultReason);
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    reference: string | null;
    trackingUrl?: string | null;
    date: string;
    window: CallbackTimeWindow;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  // One key per form session: a retry after a lost response is recognised as the SAME request, never a duplicate.
  const idempotencyKey = useRef<string | null>(null);
  // Synchronous in-flight guard (React's isPending flips a moment AFTER a result renders, which could swallow a quick retry).
  const inFlight = useRef(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return; // no accidental double submission
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setServerError("You are offline. Callback requests can only be sent while you are online.");
      return;
    }
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Please enter your name (at least 2 characters).";
    if (!MOBILE.test(mobile.trim()))
      next.mobile = "Please enter a valid 10-digit Indian mobile number.";
    if (email.trim() && !EMAIL.test(email.trim())) next.email = "Enter a valid email address.";
    if (
      preferredDate &&
      (preferredDate < istToday() || preferredDate > istDatePlusDays(CALLBACK_MAX_DAYS_AHEAD))
    )
      next.preferredDate = `Choose a date from today up to ${CALLBACK_MAX_DAYS_AHEAD} days ahead.`;
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setServerError(null);
    idempotencyKey.current ??= crypto.randomUUID();
    inFlight.current = true;

    startTransition(async () => {
      let res: Awaited<ReturnType<typeof submitCallbackEnquiryAction>>;
      try {
        res = await submitCallbackEnquiryAction({
          idempotencyKey: idempotencyKey.current,
          name: name.trim(),
          mobile: mobile.trim(),
          email: email.trim(),
          preferredDate: preferredDate || undefined,
          preferredTimeWindow,
          reason: reason.trim() || undefined,
          message: message.trim() || undefined,
          [HONEYPOT_FIELD]: honeypot,
        });
      } catch {
        res = { ok: false, code: "UNAVAILABLE", message: ENQUIRY_MESSAGES.unavailable };
      } finally {
        inFlight.current = false; // cleared BEFORE the result renders, so an immediate retry is never swallowed
      }
      if (res.ok) {
        setSuccess({
          reference: res.reference,
          trackingUrl: res.trackingUrl,
          date: preferredDate,
          window: preferredTimeWindow,
        });
        idempotencyKey.current = null; // a new request needs a new key
      } else {
        if (res.code === "VALIDATION") setErrors(res.fieldErrors);
        setServerError(res.message); // typed values are kept so the customer can simply retry
      }
    });
  }

  function reset() {
    setName("");
    setMobile("");
    setEmail("");
    setPreferredDate("");
    setPreferredTimeWindow("ANYTIME");
    setReason(defaultReason);
    setMessage("");
    setErrors({});
    setServerError(null);
    setSuccess(null);
    idempotencyKey.current = null;
  }

  function close() {
    if (success) reset();
    onClose();
  }

  const phoneDigits = parsePhone(contact?.phone)?.e164;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Request a callback"
      description="Leave your contact details and our team will call you back. Your preferred time is a request, not a booking."
    >
      {success ? (
        <div className="space-y-4">
          <EnquiryReceived reference={success.reference} trackingUrl={success.trackingUrl} />
          <div className="rounded border border-border bg-surface-muted p-gutter-md text-body-md">
            <p className="font-semibold">Your requested callback time</p>
            <p>
              {success.date
                ? new Date(`${success.date}T00:00:00`).toLocaleDateString("en-IN", {
                    dateStyle: "long",
                  })
                : "Earliest convenience"}
              {" · "}
              {CALLBACK_TIME_WINDOW_LABELS[success.window]}
            </p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              This is the time you asked for. It is not a confirmed appointment — our team will
              contact you.
            </p>
          </div>
          {(phoneDigits || contact?.whatsappNumber) && (
            <div className="flex flex-wrap gap-2">
              <CallButton phone={contact?.phone ?? null} variant="outline" size="sm">
                Call us now
              </CallButton>
              <WhatsAppButton
                hideIfUnavailable
                number={contact?.whatsappNumber ?? null}
                message={`Hello, I requested a callback${success.reference ? ` (reference ${success.reference})` : ""}.`}
                variant="outline"
                size="sm"
              >
                WhatsApp us
              </WhatsAppButton>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate aria-busy={isPending} className="space-y-4">
          {serverError && (
            <Notification tone="error" title="We could not save your request">
              {serverError} Your details are still here — you can try again.
            </Notification>
          )}
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
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
              />
            )}
          </Field>
          <Field
            label="Mobile number"
            required
            error={errors.mobile}
            helper="10-digit mobile number for a call or WhatsApp."
          >
            {(p) => (
              <Input
                {...p}
                name="mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                maxLength={10}
              />
            )}
          </Field>
          <Field label="Email (optional)" error={errors.email}>
            {(p) => (
              <Input
                {...p}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
              />
            )}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Preferred date (optional)" error={errors.preferredDate}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  min={istToday()}
                  max={istDatePlusDays(CALLBACK_MAX_DAYS_AHEAD)}
                />
              )}
            </Field>
            <Field label="Preferred time">
              {(p) => (
                <Select
                  {...p}
                  value={preferredTimeWindow}
                  onChange={(e) => setPreferredTimeWindow(e.target.value as CallbackTimeWindow)}
                >
                  {CALLBACK_TIME_WINDOWS.map((w) => (
                    <option key={w} value={w}>
                      {CALLBACK_TIME_WINDOW_LABELS[w]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field
            label="Reason (optional)"
            error={errors.reason}
            helper="Which materials or what help do you need?"
          >
            {(p) => (
              <Input
                {...p}
                name="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
              />
            )}
          </Field>
          <Field label="Message (optional)" error={errors.message}>
            {(p) => (
              <Textarea
                {...p}
                name="message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
              />
            )}
          </Field>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={close} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Sending…" : "Request callback"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export function RequestCallbackButton({
  className,
  variant = "outline",
  size = "md",
  children = "Request a Callback",
  defaultReason,
  contact,
}: {
  className?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  defaultReason?: string;
  contact?: CallbackContact;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        <PhoneCall aria-hidden="true" className="size-4 shrink-0" />
        <span>{children}</span>
      </Button>
      <CallbackModal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        defaultReason={defaultReason}
        contact={contact}
      />
    </>
  );
}
