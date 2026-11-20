"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

export const fieldClass =
  "block w-full rounded border border-border bg-surface px-3 text-body-md text-on-surface placeholder:text-on-surface-variant transition-colors hover:border-on-surface-variant focus-visible:border-primary focus-visible:outline-1 focus-visible:outline-offset-0 disabled:cursor-not-allowed disabled:bg-surface-muted aria-invalid:border-error";

type InputProps = ComponentProps<"input"> & {
  /** Leading icon (decorative). */
  icon?: ReactNode;
};

/** Text-like input. `type="password"` gets a show/hide toggle automatically. */
export function Input({ icon, type = "text", className, ...props }: InputProps) {
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="relative">
      {icon && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-on-surface-variant [&>svg]:size-4"
        >
          {icon}
        </span>
      )}
      <input
        type={isPassword && shown ? "text" : type}
        className={cn(fieldClass, "h-10", icon && "pl-10", isPassword && "pr-11", className)}
        {...props}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r text-on-surface-variant hover:text-on-surface"
        >
          {shown ? (
            <EyeOff aria-hidden className="size-4" />
          ) : (
            <Eye aria-hidden className="size-4" />
          )}
        </button>
      )}
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClass, "min-h-24 py-2", className)} {...props} />;
}

/** Native select, styled. (Searchable select is not designed — see docs/COMPONENT_USAGE.md.) */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(fieldClass, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

const choiceClass =
  "size-4 shrink-0 accent-primary border-border focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

export function Checkbox({
  label,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex items-center gap-gutter-sm text-body-md", className)}>
      <input type="checkbox" className={choiceClass} {...props} />
      {label}
    </label>
  );
}

export function Radio({
  label,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return (
    <label className={cn("inline-flex items-center gap-gutter-sm text-body-md", className)}>
      <input type="radio" className={choiceClass} {...props} />
      {label}
    </label>
  );
}

type FieldRenderProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
};

/**
 * Label + control + helper/error wiring. Use the render prop so ids and ARIA
 * attributes reach the control:
 *   <Field label="Name" error={e}>{(p) => <Input {...p} />}</Field>
 */
export function Field({
  label,
  helper,
  error,
  required,
  className,
  children,
}: {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: FieldRenderProps) => ReactNode;
}) {
  const id = useId();
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-gutter-xs", className)}>
      <label htmlFor={id} className="text-label-lg">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-error">
            *
          </span>
        )}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        ...(error ? { "aria-invalid": true as const } : {}),
        ...(required ? { "aria-required": true as const } : {}),
      })}
      {helper && !error && (
        <p id={helperId} className="text-body-sm text-on-surface-variant">
          {helper}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-body-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
