import type { ComponentProps, ReactNode } from "react";
import { Notification } from "@/components/ui/notification";

/**
 * Confirmation shown after the server has SAVED an enquiry. It states only what is true: the enquiry is stored
 * and has a reference number. It never claims an email or WhatsApp message was sent, and promises no response time.
 */
export function EnquiryReceived({
  reference,
  mode,
  message,
  children,
  ref,
}: {
  reference: string | null;
  mode?: "PERSISTED" | "EMAIL_FALLBACK";
  message?: string;
  children?: ReactNode;
  ref?: ComponentProps<"div">["ref"];
}) {
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
          <>
            We have saved your enquiry. Your reference number is <strong>{reference}</strong>;
            please keep it for any follow-up.
          </>
        ) : (
          <>Thank you. Your enquiry has been received.</>
        )}
        {children && <div className="mt-gutter-sm">{children}</div>}
      </Notification>
    </div>
  );
}
