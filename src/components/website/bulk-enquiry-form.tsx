"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ClipboardList, Plus, Search, Trash2 } from "lucide-react";
import { FormErrorSummary } from "@/components/common/form-error-summary";
import { HoneypotField } from "@/components/common/honeypot-field";
import { QuantityInput } from "@/components/common/quantity-input";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { StockBadge } from "@/components/ui/status-badge";
import {
  MAX_ENQUIRY_ITEMS,
  enquiryList,
  useEnquiryItems,
} from "@/features/enquiries/enquiry-list-store";
import type { EnquiryCatalogueItem } from "@/features/enquiries/types";
import { bulkEnquirySchema, toFieldErrors, type FieldErrors } from "@/features/enquiries/schemas";
import { BULK_ENQUIRY_SUBJECT } from "@/lib/mailto";
import { bulkEnquiryMessage } from "@/lib/whatsapp";
import { EmailButton, WhatsAppButton } from "./contact-actions";
import { submitBulkEnquiryAction } from "@/features/enquiries/actions";
import { EnquiryReceived } from "./enquiry-received";
import { takeEnquiryPrefill } from "@/features/material-lists/handoff";
import { useEnquirySubmit } from "./use-enquiry-submit";

/**
 * Bulk quotation enquiry (a quotation list, NOT a shopping cart).
 * The browser keeps only product ids and quantities and sends ONLY those: names, brands, units, prices and
 * availability shown here are display-only — the server re-reads them from the catalogue and stores snapshots.
 * No checkout, no payment.
 */
export type { EnquiryCatalogueItem };

export function BulkEnquiryForm({
  catalogue,
  whatsappNumber,
  businessEmail = null,
}: {
  catalogue: EnquiryCatalogueItem[];
  whatsappNumber: string | null;
  /** Business email from settings; enables the "Send list by email" button (mailto). */
  businessEmail?: string | null;
}) {
  const items = useEnquiryItems();
  const byId = useMemo(() => new Map(catalogue.map((c) => [c.id, c])), [catalogue]);
  const [query, setQuery] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    reference: string | null;
    mode?: "PERSISTED" | "EMAIL_FALLBACK";
    message?: string;
    trackingUrl?: string | null;
  } | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // A project / saved list / calculator can hand over a message (project name, notes, custom requirements). It is shown in the
  // message box for the customer to read and edit; nothing is sent until they submit the form.
  useEffect(() => {
    const prefill = takeEnquiryPrefill();
    if (!prefill) return;
    const el = formRef.current?.elements.namedItem("message");
    if (el instanceof HTMLTextAreaElement && !el.value) el.value = prefill;
  }, []);
  const summary = useRef<HTMLDivElement>(null);
  const received = useRef<HTMLDivElement>(null);
  const { submit, pending } = useEnquirySubmit(submitBulkEnquiryAction);

  // Move focus to the error summary (or the confirmation) so the outcome is announced.
  useEffect(() => {
    if (focusTick === 0) return;
    (summary.current ?? received.current)?.focus();
  }, [focusTick]);

  const inList = new Set(items.map((i) => i.productId));
  const q = query.trim().toLowerCase();
  const matches = q
    ? catalogue
        .filter(
          (c) =>
            !inList.has(c.id) &&
            `${c.name} ${c.brandName ?? ""} ${c.sku ?? ""}`.toLowerCase().includes(q),
        )
        .slice(0, 5)
    : [];
  const unavailable = items.filter((i) => !byId.has(i.productId));

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "");
    const values = {
      name: get("name"),
      mobile: get("mobile"),
      email: get("email"),
      deliveryLocation: get("deliveryLocation"),
      message: get("message"),
      // Only ids and quantities leave the browser.
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    };
    const parsed = bulkEnquirySchema.safeParse(values);
    const next: FieldErrors = parsed.success ? {} : toFieldErrors(parsed.error);
    if (unavailable.length > 0)
      next.items = "Remove products that are no longer available from your list.";
    setSubmissionResult(null);
    setFormMessage(null);
    if (Object.keys(next).length > 0) {
      setErrors(next);
      setFocusTick((t) => t + 1);
      return;
    }
    setErrors({});
    submit({ ...values, website: get("website") }, (r) => {
      if (r.ok) {
        setSubmissionResult({
          reference: r.reference,
          mode: r.mode,
          message: r.message,
          trackingUrl: r.trackingUrl,
        });
        enquiryList.clear();
        formRef.current?.reset();
      } else if (r.code === "VALIDATION") {
        setErrors(r.fieldErrors);
        setFormMessage(r.message);
      } else if (r.code === "INVALID_PRODUCTS") {
        const names = r.productIds.map(
          (id) => byId.get(id)?.name ?? "a product that is no longer listed",
        );
        setErrors({ items: `${r.message} (${names.join(", ")})` });
      } else {
        setErrors({});
        setFormMessage(r.message);
      }
      setFocusTick((t) => t + 1);
    });
  }

  const waItems = items.flatMap((i) => {
    const c = byId.get(i.productId);
    return c ? [{ name: c.name, quantity: i.quantity, unitLabel: c.unitLabel }] : [];
  });

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      aria-busy={pending}
      noValidate
      className="grid grid-cols-1 gap-gutter-xl lg:grid-cols-3"
      aria-label="Bulk quotation enquiry"
    >
      <div className="space-y-gutter-lg lg:col-span-2">
        {submissionResult && (
          <EnquiryReceived
            ref={received}
            reference={submissionResult.reference}
            mode={submissionResult.mode}
            message={submissionResult.message}
            trackingUrl={submissionResult.trackingUrl}
          >
            {submissionResult.reference && (
              <WhatsAppButton
                hideIfUnavailable
                number={whatsappNumber}
                message={`Hello, I am following up on my enquiry ${submissionResult.reference}.`}
                variant="outline"
                size="sm"
              >
                Follow up on WhatsApp
              </WhatsAppButton>
            )}
          </EnquiryReceived>
        )}
        <FormErrorSummary
          ref={summary}
          messages={[
            ...Object.values(errors),
            ...(formMessage && Object.keys(errors).length === 0 ? [formMessage] : []),
          ]}
        />
        <HoneypotField />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-gutter-sm">
              <ClipboardList aria-hidden className="size-5 text-primary" /> Enquiry list (
              {items.length})
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-gutter-md">
            <div className="relative">
              <Field
                label="Add a product"
                helper={`Search by name, brand or SKU. Up to ${MAX_ENQUIRY_ITEMS} products.`}
              >
                {(p) => (
                  <Input
                    icon={<Search />}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                    {...p}
                  />
                )}
              </Field>
              {q && (
                <ul
                  aria-label="Matching products"
                  className="mt-gutter-sm divide-y divide-border rounded border border-border"
                >
                  {matches.length === 0 && (
                    <li className="p-gutter-md text-body-md text-on-surface-variant">
                      No matching products (or already in your list).
                    </li>
                  )}
                  {matches.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-gutter-md p-gutter-sm"
                    >
                      <span className="text-body-md">
                        {c.name}{" "}
                        <span className="text-on-surface-variant">
                          {c.brandName && `· ${c.brandName}`}
                        </span>
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          enquiryList.add(c.id, 1);
                          setQuery("");
                        }}
                      >
                        <Plus aria-hidden className="size-4" /> Add{" "}
                        <span className="sr-only">{c.name}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length === 0 ? (
              <EmptyState
                icon={<ClipboardList />}
                title="Your enquiry list is empty"
                description="Search above, or browse the catalogue and choose “Add to enquiry list”."
                action={
                  <ButtonLink href="/products" variant="outline">
                    Browse products
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {items.map((i) => {
                  const c = byId.get(i.productId);
                  return (
                    <li
                      key={i.productId}
                      className="relative flex flex-col gap-gutter-sm py-gutter-md sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-gutter-md"
                    >
                      <div className="min-w-0 pr-12 sm:flex-1 sm:basis-56 sm:pr-0">
                        {c ? (
                          <>
                            <Link
                              href={`/products/${c.slug}`}
                              className="text-title-md hover:text-primary hover:underline"
                            >
                              {c.name}
                            </Link>
                            <p className="text-body-sm text-on-surface-variant">
                              {[
                                c.brandName,
                                c.sku && `SKU ${c.sku}`,
                                c.rate ? `Indicative rate ${c.rate}` : "Rate on request",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <div className="mt-1">
                              <StockBadge status={c.stockStatus} />
                            </div>
                          </>
                        ) : (
                          <p className="text-body-md text-error">
                            This product is no longer available. Please remove it.
                          </p>
                        )}
                      </div>
                      {c && (
                        <div className="flex items-center gap-gutter-sm">
                          <QuantityInput
                            value={i.quantity}
                            onChange={(n) => enquiryList.setQuantity(i.productId, n)}
                            label={`Quantity of ${c.name}`}
                          />
                          <span className="min-w-12 text-body-md text-on-surface-variant">
                            {c.unitLabel}
                          </span>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-gutter-sm right-0 sm:static"
                        aria-label={`Remove ${c?.name ?? "unavailable product"}`}
                        onClick={() => enquiryList.remove(i.productId)}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            {errors.items && items.length === 0 && (
              <p className="text-body-sm text-error">{errors.items}</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-gutter-md lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
          </CardHeader>
          <CardBody className="space-y-gutter-md">
            <Field label="Full name" required error={errors.name}>
              {(p) => <Input name="name" autoComplete="name" maxLength={100} {...p} />}
            </Field>
            <Field
              label="Mobile number"
              required
              error={errors.mobile}
              helper="10-digit mobile number (WhatsApp preferred)."
            >
              {(p) => <Input name="mobile" type="tel" inputMode="tel" autoComplete="tel" {...p} />}
            </Field>
            <Field label="Email (optional)" error={errors.email}>
              {(p) => (
                <Input name="email" type="email" autoComplete="email" maxLength={254} {...p} />
              )}
            </Field>
            <Field
              label="Delivery location"
              required
              error={errors.deliveryLocation}
              helper="Town, site address or landmark."
            >
              {(p) => (
                <Input
                  name="deliveryLocation"
                  autoComplete="street-address"
                  maxLength={300}
                  {...p}
                />
              )}
            </Field>
            <Field label="Message (optional)" error={errors.message}>
              {(p) => (
                <Textarea
                  name="message"
                  rows={4}
                  maxLength={1000}
                  placeholder="Delivery timing, lots, or other requirements."
                  {...p}
                />
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? "Sending…" : "Submit enquiry"}
            </Button>
            <WhatsAppButton
              hideIfUnavailable
              number={whatsappNumber}
              message={bulkEnquiryMessage(waItems)}
              variant="outline"
              size="lg"
              className="w-full"
            >
              Send list on WhatsApp
            </WhatsAppButton>
            <EmailButton
              hideIfUnavailable
              email={businessEmail}
              subject={BULK_ENQUIRY_SUBJECT}
              message={bulkEnquiryMessage(waItems)}
              variant="outline"
              size="lg"
              className="w-full"
            >
              Send list by email
            </EmailButton>
            <p className="text-body-sm text-on-surface-variant">
              No payment is taken. Opening WhatsApp or your email app only prepares a message; you
              must press Send.
            </p>
          </CardBody>
        </Card>
      </div>
    </form>
  );
}
