"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { Notification } from "@/components/ui/notification";
import { subscribeRateAlertAction } from "@/features/rate-alerts/actions";
import { RATE_ALERT_CONSENT_TEXT } from "@/features/rate-alerts/types";
import { HONEYPOT_FIELD } from "@/features/enquiries/submission-schemas";

export type RateAlertProduct = { id: string; name: string };

export function RateAlertForm({ products }: { products: RateAlertProduct[] }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [alertType, setAlertType] = useState<"ANY_CHANGE" | "DROPS_BELOW">("ANY_CHANGE");
  const [targetPrice, setTargetPrice] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const inFlight = useRef(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setErrors({});
    setMessage(null);
    start(async () => {
      try {
        const r = await subscribeRateAlertAction({
          productId,
          email,
          alertType,
          targetPrice,
          consent,
          [HONEYPOT_FIELD]: honeypot,
        });
        if (r.ok) setMessage({ tone: "success", text: r.message });
        else {
          if (r.code === "VALIDATION") setErrors(r.fieldErrors);
          setMessage({ tone: "error", text: r.message });
        }
      } catch {
        setMessage({ tone: "error", text: "Something went wrong. Please try again." });
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-busy={pending}
      aria-label="Rate alert"
      className="space-y-4"
    >
      {message && <Notification tone={message.tone}>{message.text}</Notification>}
      <div className="hidden" aria-hidden="true">
        <input
          tabIndex={-1}
          autoComplete="off"
          name={HONEYPOT_FIELD}
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
      <Field label="Product" error={errors.productId}>
        {(p) => (
          <Select {...p} value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Email" required error={errors.email}>
        {(p) => (
          <Input
            {...p}
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Field label="Alert me when" error={errors.alertType}>
        {(p) => (
          <Select
            {...p}
            value={alertType}
            onChange={(e) => setAlertType(e.target.value as "ANY_CHANGE" | "DROPS_BELOW")}
          >
            <option value="ANY_CHANGE">The listed rate changes</option>
            <option value="DROPS_BELOW">The listed rate drops to or below a rate I choose</option>
          </Select>
        )}
      </Field>
      {alertType === "DROPS_BELOW" && (
        <Field label="Target rate (₹)" required error={errors.targetPrice}>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              maxLength={10}
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
            />
          )}
        </Field>
      )}
      <div>
        <label className="flex items-start gap-2 text-body-md">
          <input
            type="checkbox"
            className="mt-1 size-4"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>{RATE_ALERT_CONSENT_TEXT}</span>
        </label>
        {errors.consent && (
          <p role="alert" className="mt-1 text-body-sm text-error">
            {errors.consent}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send confirmation email"}
      </Button>
    </form>
  );
}
