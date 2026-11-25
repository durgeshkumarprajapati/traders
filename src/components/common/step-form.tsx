"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export interface StepFormStep {
  id: string;
  title: string;
  whyWeAsk: string;
  content: ReactNode;
  validate?: () => string | null;
}

/**
 * Reusable accessible step-by-step guided form wrapper.
 * Preserves entered state across steps and displays a clear progress indicator.
 */
export function StepFormWizard({
  steps,
  submitLabel = "Submit",
  pending = false,
  onSubmit,
}: {
  steps: StepFormStep[];
  submitLabel?: string;
  pending?: boolean;
  onSubmit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const current = steps[index];
  const isLast = index === steps.length - 1;

  function goNext() {
    if (current?.validate) {
      const msg = current.validate();
      if (msg) {
        setStepError(msg);
        return;
      }
    }
    setStepError(null);
    setIndex((i) => Math.min(steps.length - 1, i + 1));
  }

  return (
    <Card className="p-gutter-lg space-y-gutter-md">
      <div className="space-y-1">
        <p className="text-label-md font-semibold text-primary">
          Step {index + 1} of {steps.length}: {current?.title}
        </p>
        <p className="text-body-sm text-on-surface-variant">{current?.whyWeAsk}</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round(((index + 1) / steps.length) * 100)}%` }}
          />
        </div>
      </div>

      {stepError && (
        <div role="alert" className="rounded border border-error bg-error/10 p-3 text-body-sm text-error">
          {stepError}
        </div>
      )}

      <div>{current?.content}</div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-gutter-md">
        <Button
          type="button"
          variant="outline"
          disabled={index === 0 || pending}
          onClick={() => {
            setStepError(null);
            setIndex((i) => Math.max(0, i - 1));
          }}
        >
          Back
        </Button>
        {isLast ? (
          <Button type="button" disabled={pending} onClick={onSubmit}>
            {pending ? "Submitting..." : submitLabel}
          </Button>
        ) : (
          <Button type="button" onClick={goNext}>
            Next Step
          </Button>
        )}
      </div>
    </Card>
  );
}
