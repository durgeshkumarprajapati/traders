"use client";

import { useState, useTransition } from "react";
import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { Notification } from "@/components/ui/notification";
import {
  CALLBACK_TIME_WINDOWS,
  CALLBACK_TIME_WINDOW_LABELS,
  type CallbackTimeWindow,
} from "@/features/enquiries/callback-schemas";
import { submitCallbackEnquiryAction } from "@/features/enquiries/callback-actions";
import { HONEYPOT_FIELD } from "@/features/enquiries/submission-schemas";
import { EnquiryReceived } from "./enquiry-received";

interface CallbackModalProps {
  open: boolean;
  onClose: () => void;
  defaultReason?: string;
}

export function CallbackModal({ open, onClose, defaultReason = "" }: CallbackModalProps) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTimeWindow, setPreferredTimeWindow] = useState<CallbackTimeWindow>("ANYTIME");
  const [reason, setReason] = useState(defaultReason);
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    reference: string | null;
    trackingUrl?: string | null;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (name.trim().length < 2) {
      newErrors.name = "Please enter your name (at least 2 characters).";
    }
    if (!/^[6-9][0-9]{9}$/.test(mobile.trim())) {
      newErrors.mobile = "Please enter a valid 10-digit Indian mobile number.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setServerError(null);

    startTransition(async () => {
      const idempotencyKey = crypto.randomUUID();
      const payload = {
        idempotencyKey,
        name: name.trim(),
        mobile: mobile.trim(),
        preferredDate: preferredDate || undefined,
        preferredTimeWindow,
        reason: reason.trim() || undefined,
        [HONEYPOT_FIELD]: honeypot,
      };

      const res = await submitCallbackEnquiryAction(payload);
      if (res.ok) {
        setSuccessResult({
          reference: res.reference,
          trackingUrl: res.trackingUrl,
        });
      } else {
        if (res.code === "VALIDATION" && res.fieldErrors) {
          setErrors(res.fieldErrors);
        }
        setServerError(res.message);
      }
    });
  }

  function handleResetAndClose() {
    setName("");
    setMobile("");
    setPreferredDate("");
    setPreferredTimeWindow("ANYTIME");
    setReason("");
    setErrors({});
    setServerError(null);
    setSuccessResult(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleResetAndClose}
      title="Request a Callback"
      description="Leave your contact details and our sales team will call you back during your preferred time window."
    >
      {successResult ? (
        <div className="p-4 space-y-4">
          <EnquiryReceived
            reference={successResult.reference}
            trackingUrl={successResult.trackingUrl}
          />
          <div className="pt-2 flex justify-end">
            <Button variant="primary" onClick={handleResetAndClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="p-4 space-y-4">
          {serverError && (
            <Notification tone="error" title="Submission error">
              {serverError}
            </Notification>
          )}

          {/* Honeypot field */}
          <div className="hidden" aria-hidden="true">
            <input
              tabIndex={-1}
              autoComplete="off"
              name={HONEYPOT_FIELD}
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <Field label="Your Name" required error={errors.name}>
            {(p) => (
              <Input
                {...p}
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full Name"
                maxLength={100}
                required
              />
            )}
          </Field>

          <Field
            label="Mobile Number"
            required
            error={errors.mobile}
            helper="10-digit mobile number for phone / WhatsApp discussion"
          >
            {(p) => (
              <Input
                {...p}
                name="mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="9123456780"
                maxLength={10}
                required
              />
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Preferred Date (Optional)">
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              )}
            </Field>

            <Field label="Preferred Time Window">
              {(p) => (
                <Select
                  {...p}
                  value={preferredTimeWindow}
                  onChange={(e) => setPreferredTimeWindow(e.target.value as CallbackTimeWindow)}
                >
                  {CALLBACK_TIME_WINDOWS.map((windowKey) => (
                    <option key={windowKey} value={windowKey}>
                      {CALLBACK_TIME_WINDOW_LABELS[windowKey]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field
            label="Reason / Material Requirement (Optional)"
            helper="Tell us which materials you need pricing or site delivery for."
          >
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Need 5 MT TMT steel and 100 bags cement delivery to site."
                maxLength={200}
              />
            )}
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetAndClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Submitting..." : "Request Callback"}
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
}: {
  className?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
  defaultReason?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setIsOpen(true)}
      >
        <PhoneCall aria-hidden="true" className="size-4 shrink-0" />
        <span>{children}</span>
      </Button>
      <CallbackModal open={isOpen} onClose={() => setIsOpen(false)} defaultReason={defaultReason} />
    </>
  );
}
