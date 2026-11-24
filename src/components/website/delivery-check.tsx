"use client";

import { useState, useTransition } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Notification } from "@/components/ui/notification";
import {
  checkDeliveryAction,
  submitFreightEnquiryAction,
  type DeliveryCheckResult,
} from "@/features/enquiries/request-actions";
import { FREIGHT_DISCLAIMER, PIN_PATTERN, normalisePin } from "@/features/delivery/coverage";
import { ContactFields, RequestShell, useRequestForm } from "./request-enquiry-form";

export function DeliveryCheck() {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string>();
  const [result, setResult] = useState<DeliveryCheckResult | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [checking, startCheck] = useTransition();

  const [contact, setContact] = useState({ name: "", mobile: "", email: "" });
  const [locality, setLocality] = useState("");
  const [materials, setMaterials] = useState("");
  const [quantityNote, setQuantityNote] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const form = useRequestForm(submitFreightEnquiryAction);

  function check(e: React.FormEvent) {
    e.preventDefault();
    if (!PIN_PATTERN.test(normalisePin(pin))) {
      setPinError("Enter a valid six-digit PIN code.");
      return;
    }
    setPinError(undefined);
    setCheckFailed(false);
    startCheck(async () => {
      try {
        setResult(await checkDeliveryAction(pin));
      } catch {
        setResult(null);
        setCheckFailed(true);
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    form.send({ ...contact, pincode: pin, locality, materials, quantityNote, message }, honeypot);
  }

  return (
    <div className="space-y-gutter-lg">
      <form onSubmit={check} noValidate className="space-y-3" aria-label="Check delivery area">
        <Field
          label="Delivery PIN code"
          required
          error={pinError}
          helper="Six digits, for example 110001."
        >
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={7}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setResult(null);
              }}
            />
          )}
        </Field>
        <Button type="submit" disabled={checking}>
          <MapPin aria-hidden className="mr-2 size-4" />
          {checking ? "Checking…" : "Check delivery area"}
        </Button>
      </form>

      {checkFailed && (
        <Notification tone="warning">
          We could not check the delivery area right now. You can still send a freight enquiry
          below.
        </Notification>
      )}
      {result && result.status !== "INVALID" && (
        <div
          role="status"
          className="space-y-2 rounded border border-border bg-surface-muted p-gutter-md"
        >
          <p className="text-body-md">{result.message}</p>
          {result.localities && (
            <p className="text-body-sm text-on-surface-variant">
              Areas we list: {result.localities}
            </p>
          )}
          {result.notes && <p className="text-body-sm text-on-surface-variant">{result.notes}</p>}
          {result.terms && <p className="text-body-sm text-on-surface-variant">{result.terms}</p>}
        </div>
      )}

      <section aria-labelledby="freight-heading" className="space-y-3">
        <h2 id="freight-heading" className="text-title-lg font-bold text-primary">
          Ask about freight to your site
        </h2>
        <p className="text-body-md text-on-surface-variant">{FREIGHT_DISCLAIMER}</p>
        <RequestShell
          form={form}
          title="Freight enquiry"
          onSubmit={submit}
          submitLabel="Send freight enquiry"
        >
          <ContactFields
            values={contact}
            set={(k, v) => setContact((c) => ({ ...c, [k]: v }))}
            errors={form.errors}
            honeypot={honeypot}
            setHoneypot={setHoneypot}
          />
          <Field label="Delivery PIN code" required error={form.errors.pincode}>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                maxLength={7}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            )}
          </Field>
          <Field label="Locality or site address" required error={form.errors.locality}>
            {(p) => (
              <Input
                {...p}
                maxLength={200}
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
              />
            )}
          </Field>
          <Field label="Materials needed" required error={form.errors.materials}>
            {(p) => (
              <Input
                {...p}
                maxLength={400}
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
              />
            )}
          </Field>
          <Field label="Approximate quantity (optional)" error={form.errors.quantityNote}>
            {(p) => (
              <Input
                {...p}
                maxLength={200}
                value={quantityNote}
                onChange={(e) => setQuantityNote(e.target.value)}
              />
            )}
          </Field>
          <Field label="Anything else (optional)" error={form.errors.message}>
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            )}
          </Field>
        </RequestShell>
      </section>
    </div>
  );
}
