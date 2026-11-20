import type { ComponentProps } from "react";
import { CircleAlert } from "lucide-react";

/**
 * Form-level error summary. Render it when a submit fails and move focus to it (tabIndex -1)
 * so screen-reader users hear what went wrong; each message is plain text, never colour-only.
 */
export function FormErrorSummary({
  messages,
  ref,
}: {
  messages: string[];
  ref?: ComponentProps<"div">["ref"];
}) {
  if (messages.length === 0) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="rounded border border-l-4 border-border border-l-error bg-surface p-gutter-md outline-none focus-visible:outline-2 focus-visible:outline-primary"
    >
      <p className="flex items-center gap-gutter-sm text-title-md">
        <CircleAlert aria-hidden className="size-5 text-error" />
        Please fix the following before submitting:
      </p>
      <ul className="mt-gutter-sm list-disc space-y-1 pl-6 text-body-md">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
