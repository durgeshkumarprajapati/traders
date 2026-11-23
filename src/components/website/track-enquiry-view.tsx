"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form-controls";
import { Notification } from "@/components/ui/notification";
import { EnquiryStatusBadge, type EnquiryStatus } from "@/components/ui/status-badge";
import { trackEnquiryAction } from "@/features/enquiries/tracking-actions";
import {
  parseTrackingParams,
  trackingPath,
  type TrackedEnquiry,
} from "@/features/enquiries/tracking-types";
import { WhatsAppButton } from "./contact-actions";

interface TrackEnquiryViewProps {
  initialReference?: string;
  initialToken?: string;
  whatsappNumber?: string;
  businessPhone?: string;
}

const ORDERED_STEPS: { key: EnquiryStatus; label: string; description: string }[] = [
  { key: "NEW", label: "Received", description: "Enquiry logged in our system" },
  { key: "CONTACTED", label: "Under Review", description: "Representative reviewing requirements" },
  { key: "QUOTATION_SENT", label: "Quotation Sent", description: "Formal quotation shared" },
  { key: "CONFIRMED", label: "Confirmed", description: "Order details confirmed" },
  { key: "COMPLETED", label: "Completed", description: "Fulfilled and delivered" },
];

function stepIndex(status: string): number {
  switch (status) {
    case "NEW":
      return 0;
    case "CONTACTED":
      return 1;
    case "QUOTATION_SENT":
      return 2;
    case "CONFIRMED":
      return 3;
    case "COMPLETED":
      return 4;
    default:
      return -1;
  }
}

export function TrackEnquiryView({
  initialReference = "",
  initialToken = "",
  whatsappNumber,
  businessPhone,
}: TrackEnquiryViewProps) {
  const [reference, setReference] = useState(initialReference);
  const [token, setToken] = useState(initialToken);
  const [enquiry, setEnquiry] = useState<TrackedEnquiry | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function performLookup(refToUse: string, tokenToUse: string) {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await trackEnquiryAction(refToUse, tokenToUse);
      if (res.ok) {
        setEnquiry(res.data);
      } else {
        setEnquiry(null);
        setErrorMessage(res.message);
      }
    });
  }

  // The link carries its credentials in the URL FRAGMENT (never sent to the server). Old links used a query string:
  // those are accepted once and immediately rewritten to the fragment form so the token leaves the address bar's query.
  useEffect(() => {
    const found =
      parseTrackingParams(window.location.hash) ??
      parseTrackingParams(window.location.search) ??
      (initialReference.trim() && initialToken.trim()
        ? { ref: initialReference.trim(), token: initialToken.trim() }
        : null);
    if (!found) return;
    if (window.location.search) {
      window.history.replaceState(null, "", trackingPath(found.ref, found.token));
    }
    let cancelled = false;
    trackEnquiryAction(found.ref, found.token).then((res) => {
      if (cancelled) return;
      setReference(found.ref);
      setToken(found.token);
      if (res.ok) {
        setEnquiry(res.data);
      } else {
        setEnquiry(null);
        setErrorMessage(res.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initialReference, initialToken]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim() || !token.trim()) {
      setErrorMessage("Please enter both your Enquiry Reference and Tracking Token.");
      return;
    }
    performLookup(reference, token);
  }

  function handleCopyLink() {
    if (typeof window === "undefined" || !enquiry) return;
    const url = `${window.location.origin}${trackingPath(enquiry.reference, token)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  const currentStep = enquiry ? stepIndex(enquiry.status) : -1;
  const isCancelled = enquiry?.status === "CANCELLED";

  return (
    <div className="space-y-gutter-xl">
      {/* Search / Lookup Form */}
      <Card className="p-gutter-lg">
        <form onSubmit={handleSubmit} className="space-y-gutter-md">
          <h2 className="text-title-md font-semibold text-primary">Track Enquiry Status</h2>
          <p className="text-body-sm text-on-surface-variant">
            Enter your enquiry reference number and secure access token from your confirmation link.
            No password or registration needed.
          </p>

          <div className="grid grid-cols-1 gap-gutter-md sm:grid-cols-2">
            <div>
              <label
                htmlFor="track-ref"
                className="block text-body-sm font-medium text-on-surface mb-1"
              >
                Enquiry Reference
              </label>
              <Input
                id="track-ref"
                name="reference"
                placeholder="e.g. ENQ-2026-001001"
                value={reference}
                onChange={(e) => setReference(e.target.value.toUpperCase())}
                required
              />
            </div>
            <div>
              <label
                htmlFor="track-token"
                className="block text-body-sm font-medium text-on-surface mb-1"
              >
                Access Token
              </label>
              <Input
                id="track-token"
                name="token"
                type="text"
                placeholder="e.g. tr_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-gutter-sm pt-2">
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Checking status..." : "Track Enquiry"}
            </Button>
            {enquiry && (
              <Button type="button" variant="outline" onClick={handleCopyLink}>
                {copied ? "Link Copied!" : "Copy Tracking Link"}
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Error state */}
      {errorMessage && (
        <Notification tone="error" title="Unable to find enquiry">
          <p>{errorMessage}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-body-sm">
            {whatsappNumber && (
              <WhatsAppButton
                number={whatsappNumber}
                message={`Hello Sagar Traders, I am checking status for enquiry ${reference || "..."}.`}
                size="sm"
                variant="outline"
              >
                Help via WhatsApp
              </WhatsAppButton>
            )}
            {businessPhone && (
              <ButtonAnchor href={`tel:${businessPhone}`} size="sm" variant="outline">
                Call Us: {businessPhone}
              </ButtonAnchor>
            )}
          </div>
        </Notification>
      )}

      {/* Result Display */}
      {enquiry && (
        <div className="space-y-gutter-lg">
          {/* Header Summary */}
          <Card className="p-gutter-lg">
            <div className="flex flex-col gap-gutter-sm sm:flex-row sm:items-center sm:justify-between border-b border-border pb-gutter-md">
              <div>
                <span className="text-label-sm font-medium text-on-surface-variant uppercase tracking-wider">
                  Enquiry Reference
                </span>
                <h1 className="text-headline-sm font-bold text-primary">{enquiry.reference}</h1>
                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  Submitted on{" "}
                  {new Date(enquiry.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-1">
                <span className="text-label-sm font-medium text-on-surface-variant">
                  Current Status
                </span>
                <EnquiryStatusBadge status={enquiry.status as EnquiryStatus} />
              </div>
            </div>

            {/* Stepper Timeline */}
            <div className="pt-gutter-lg">
              <h3 className="text-body-md font-semibold text-on-surface mb-4">Progress Timeline</h3>
              {isCancelled ? (
                <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-error">
                  <p className="font-semibold">This enquiry has been cancelled.</p>
                  <p className="text-body-sm mt-1">
                    If this was unexpected, please reach out to our sales desk.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
                  {ORDERED_STEPS.map((step, idx) => {
                    const isDone = currentStep >= idx;
                    const isCurrent = currentStep === idx;
                    return (
                      <div
                        key={step.key}
                        className={`rounded-lg border p-3 transition-colors ${
                          isCurrent
                            ? "border-primary bg-primary/5 text-primary font-medium"
                            : isDone
                              ? "border-success/40 bg-success/5 text-on-surface"
                              : "border-border bg-surface-muted text-on-surface-variant opacity-75"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-label-sm font-bold ${
                              isDone
                                ? "bg-success text-on-primary"
                                : "bg-border text-on-surface-variant"
                            }`}
                          >
                            {isDone ? "✓" : idx + 1}
                          </span>
                          <span className="font-semibold text-body-sm">{step.label}</span>
                        </div>
                        <p className="mt-2 text-body-sm leading-snug">{step.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Status History Logs */}
            {enquiry.statusHistory.length > 0 && (
              <div className="mt-gutter-lg border-t border-border pt-gutter-md">
                <h4 className="text-body-sm font-semibold text-on-surface mb-3">
                  Timeline History
                </h4>
                <div className="space-y-2">
                  {enquiry.statusHistory.map((entry, i) => (
                    <div
                      key={entry.id || i}
                      className="flex items-start justify-between text-body-sm border-l-2 border-primary/40 pl-3 py-1"
                    >
                      <div>
                        <span className="font-semibold text-on-surface">
                          {entry.newStatus.replace(/_/g, " ")}
                        </span>
                        {entry.description && (
                          <span className="text-on-surface-variant block mt-0.5">
                            {entry.description}
                          </span>
                        )}
                      </div>
                      <time className="text-on-surface-variant whitespace-nowrap ml-2">
                        {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Quotation Alert Card if available */}
          {enquiry.latestQuotation && (
            <Card className="border-secondary/40 bg-secondary/5 p-gutter-lg">
              <div className="flex flex-col gap-gutter-md sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="rounded bg-secondary/20 px-2 py-0.5 text-label-sm font-bold text-on-surface uppercase">
                    Formal Quotation Ready
                  </span>
                  <h3 className="mt-1 text-title-md font-bold text-primary">
                    Ref: {enquiry.latestQuotation.reference} (v
                    {enquiry.latestQuotation.version})
                  </h3>
                  <p className="text-body-sm text-on-surface mt-1">
                    Quoted Total:{" "}
                    <strong>
                      ₹
                      {enquiry.latestQuotation.totalAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </strong>
                    {enquiry.latestQuotation.isExpired && (
                      <span className="text-error ml-2 font-semibold">· Expired</span>
                    )}
                    {enquiry.latestQuotation.validUntil && (
                      <span className="text-on-surface-variant ml-2">
                        · {enquiry.latestQuotation.isExpired ? "Was valid until" : "Valid until"}{" "}
                        {new Date(enquiry.latestQuotation.validUntil).toLocaleDateString("en-IN")}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={`/quotation/${token}`} variant="primary" size="sm">
                    View Formal Quotation
                  </ButtonLink>
                </div>
              </div>
            </Card>
          )}

          {/* Items Table if BULK */}
          {enquiry.items.length > 0 && (
            <Card className="p-gutter-lg">
              <h3 className="text-title-md font-semibold text-primary mb-3">
                Requested Materials ({enquiry.items.length})
              </h3>
              {enquiry.deliveryLocation && (
                <p className="text-body-sm text-on-surface-variant mb-4">
                  Delivery Site: <strong>{enquiry.deliveryLocation}</strong>
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-body-sm">
                  <thead className="border-b border-border bg-surface-muted text-on-surface-variant">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Material</th>
                      <th className="py-2 px-3">Brand</th>
                      <th className="py-2 px-3 text-right">Quantity</th>
                      <th className="py-2 px-3 text-right">Indicative Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {enquiry.items.map((item) => (
                      <tr key={item.position}>
                        <td className="py-2 px-3 text-on-surface-variant">{item.position}</td>
                        <td className="py-2 px-3 font-medium text-on-surface">
                          {item.productName}
                        </td>
                        <td className="py-2 px-3 text-on-surface-variant">
                          {item.brandName || "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-on-surface">
                          {item.quantity} {item.unitLabel}
                        </td>
                        <td className="py-2 px-3 text-right text-on-surface-variant">
                          {item.listedPrice
                            ? `₹${item.listedPrice.toLocaleString("en-IN")}`
                            : "On request"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Quick Help & Follow-up */}
          <div className="flex flex-wrap items-center justify-between gap-gutter-md rounded-lg border border-border bg-surface-muted p-gutter-md">
            <div>
              <p className="font-semibold text-primary text-body-sm">
                Need immediate assistance with this enquiry?
              </p>
              <p className="text-body-sm text-on-surface-variant">
                Our sales desk is available Monday to Saturday, 9:00 AM to 7:00 PM.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {whatsappNumber && (
                <WhatsAppButton
                  number={whatsappNumber}
                  message={`Hello, I am tracking my enquiry ${enquiry.reference} and have a question.`}
                  size="sm"
                  variant="primary"
                >
                  WhatsApp Us
                </WhatsAppButton>
              )}
              {businessPhone && (
                <ButtonAnchor href={`tel:${businessPhone}`} size="sm" variant="outline">
                  Call Desk
                </ButtonAnchor>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
