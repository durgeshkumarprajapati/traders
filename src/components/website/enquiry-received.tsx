"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notification } from "@/components/ui/notification";

/**
 * Confirmation shown after the server has SAVED an enquiry. It states only what is true: the enquiry is stored
 * and has a reference number. It provides a secure direct tracking link without customer login.
 */
export function EnquiryReceived({
  reference,
  mode,
  message,
  trackingUrl,
  children,
  ref,
}: {
  reference: string | null;
  mode?: "PERSISTED" | "EMAIL_FALLBACK";
  message?: string;
  trackingUrl?: string | null;
  children?: ReactNode;
  ref?: ComponentProps<"div">["ref"];
}) {
  const [copied, setCopied] = useState(false);

  function copyTrackingLink() {
    if (!trackingUrl) return;
    const fullUrl =
      typeof window !== "undefined" ? `${window.location.origin}${trackingUrl}` : trackingUrl;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="outline-none focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Notification tone="success" title="Enquiry received">
        {mode === "EMAIL_FALLBACK" ? (
          <>
            <p>
              {message ||
                "Your enquiry has been sent successfully. Our team will contact you shortly."}
            </p>
            {reference && (
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Reference code: <strong>{reference}</strong>
              </p>
            )}
          </>
        ) : reference ? (
          <div className="space-y-3">
            <p>
              We have saved your enquiry. Your reference number is <strong>{reference}</strong>;
              please keep it for any follow-up.
            </p>
            {trackingUrl && (
              <div className="rounded-lg border border-success/30 bg-surface p-3 text-body-sm">
                <p className="font-semibold text-primary">Track Your Enquiry Live</p>
                <p className="mt-0.5 text-on-surface-variant">
                  No login required. Track status updates and view quotations directly anytime.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ButtonLink href={trackingUrl} size="sm" variant="primary">
                    View Live Status
                  </ButtonLink>
                  <Button type="button" size="sm" variant="outline" onClick={copyTrackingLink}>
                    {copied ? "Link Copied!" : "Copy Tracking Link"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>Thank you. Your enquiry has been received.</>
        )}
        {children && <div className="mt-gutter-sm">{children}</div>}
      </Notification>
    </div>
  );
}
