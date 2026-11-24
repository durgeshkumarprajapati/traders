import type { ComponentProps, ReactNode } from "react";
import { Phone } from "lucide-react";
import { cn } from "@/lib/cn";
import { parsePhone } from "@/lib/phone";

/**
 * The ONE way the public site turns the configured business phone number into a call link. A plain `<a href="tel:+91…">`: the
 * customer's device (phone app, OS dialer, or an installed calling app on desktop) opens with the number ready and the customer
 * must confirm the call; nothing is ever dialled automatically. Renders nothing when the number is missing or not a valid phone
 * number, so a bad setting can never become a working-looking link to the wrong place.
 */
export function BusinessCallLink({
  phone,
  businessName,
  children,
  showIcon = false,
  className,
  ...rest
}: {
  phone: string | null | undefined;
  businessName: string;
  /** Visible content; defaults to the formatted number. */
  children?: ReactNode;
  showIcon?: boolean;
} & Omit<ComponentProps<"a">, "href" | "children" | "aria-label">) {
  const parsed = parsePhone(phone);
  if (!parsed) return null;
  return (
    <a
      {...rest}
      href={parsed.href}
      // Custom visible text keeps its own accessible name (label-in-name); the default number gets a descriptive one.
      aria-label={children === undefined ? `Call ${businessName} at ${parsed.display}` : undefined}
      className={cn(
        // 44px minimum touch target, visible keyboard focus
        "inline-flex min-h-11 items-center gap-1.5 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    >
      {showIcon && <Phone aria-hidden className="size-4 shrink-0" />}
      {children ?? <span className="tabular-nums">{parsed.display}</span>}
    </a>
  );
}
