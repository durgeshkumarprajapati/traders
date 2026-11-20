import { Mail, MessageCircle, Phone } from "lucide-react";
import { Button, ButtonAnchor } from "@/components/ui/button";
import type { ComponentProps, ReactNode } from "react";
import { buildMailtoUrl } from "@/lib/mailto";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type Common = Pick<ComponentProps<typeof ButtonAnchor>, "variant" | "size" | "className">;

/** `tel:` link. Renders nothing when no phone number is configured (never a made-up number). */
export function CallButton({
  phone,
  children = "Call",
  variant = "outline",
  ...rest
}: Common & { phone: string | null; children?: ReactNode }) {
  const digits = phone?.replace(/[^\d+]/g, "");
  if (!digits) return null;
  return (
    <ButtonAnchor href={`tel:${digits}`} variant={variant} {...rest}>
      <Phone aria-hidden className="size-4" />
      {children}
    </ButtonAnchor>
  );
}

/**
 * WhatsApp click-to-chat. The link only opens a prepared message — the customer must press Send.
 * When no valid number is configured it renders a visibly disabled button instead of a broken link.
 */
export function WhatsAppButton({
  number,
  message,
  children = "WhatsApp",
  variant = "secondary",
  size,
  className,
  hideIfUnavailable = false,
}: Common & {
  number: string | null;
  message: string;
  children?: ReactNode;
  /** Customer-facing pages hide the button when no valid number is configured (no dead placeholder). */
  hideIfUnavailable?: boolean;
}) {
  const url = buildWhatsAppUrl(number, message);
  if (!url && hideIfUnavailable) return null;
  if (!url) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <MessageCircle aria-hidden className="size-4" />
        {children} <span className="sr-only">(WhatsApp number not configured yet)</span>
      </Button>
    );
  }
  return (
    <ButtonAnchor
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      variant={variant}
      size={size}
      className={className}
    >
      <MessageCircle aria-hidden className="size-4" />
      {children} <span className="sr-only">(opens WhatsApp in a new tab)</span>
    </ButtonAnchor>
  );
}

/**
 * Email click-to-compose (`mailto:`). Only opens the customer's email app with a prepared message — the customer
 * must press Send, and no enquiry record is created. Without a valid configured address it renders a visibly
 * disabled button, or nothing when `hideIfUnavailable` is set (customer pages).
 */
export function EmailButton({
  email,
  subject,
  message,
  children = "Email enquiry",
  variant = "outline",
  size,
  className,
  hideIfUnavailable = false,
}: Common & {
  email: string | null | undefined;
  subject: string;
  message: string;
  children?: ReactNode;
  hideIfUnavailable?: boolean;
}) {
  const url = buildMailtoUrl(email, subject, message);
  if (!url && hideIfUnavailable) return null;
  if (!url) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <Mail aria-hidden className="size-4" />
        {children} <span className="sr-only">(email address not configured yet)</span>
      </Button>
    );
  }
  return (
    <ButtonAnchor href={url} variant={variant} size={size} className={className}>
      <Mail aria-hidden className="size-4" />
      {children} <span className="sr-only">(opens your email app)</span>
    </ButtonAnchor>
  );
}
