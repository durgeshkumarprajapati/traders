"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/form-controls";
import { cn } from "@/lib/cn";

const MAX = 1_000_000;

/**
 * Quantity stepper. Accepts decimals; `onChange` fires only for valid (> 0) numbers, and the text
 * is restored to the last valid value on blur. The unit is shown beside the field by the caller.
 */
export function QuantityInput({
  value,
  onChange,
  label,
  className,
  invalid,
  describedBy,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
  className?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [text, setText] = useState(String(value));
  const step = (delta: number) => {
    const next = Math.min(MAX, Math.max(1, Math.round((value + delta) * 1000) / 1000));
    setText(String(next));
    onChange(next);
  };
  return (
    <div
      className={cn("inline-flex items-center gap-gutter-xs", className)}
      role="group"
      aria-label={label}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10"
        aria-label={`Decrease ${label}`}
        onClick={() => step(-1)}
        disabled={value <= 1}
      >
        <Minus aria-hidden className="size-4" />
      </Button>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n) && n > 0 && n <= MAX) onChange(n);
        }}
        onBlur={() => setText(String(value))}
        className={cn(fieldClass, "h-10 w-24 px-2 text-center")}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10"
        aria-label={`Increase ${label}`}
        onClick={() => step(1)}
      >
        <Plus aria-hidden className="size-4" />
      </Button>
    </div>
  );
}
