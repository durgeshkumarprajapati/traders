import { z } from "zod";
import { optionalEmail } from "./schemas";
import { HONEYPOT_FIELD } from "./submission-schemas";

export const CALLBACK_TIME_WINDOWS = ["MORNING", "AFTERNOON", "EVENING", "ANYTIME"] as const;

export type CallbackTimeWindow = (typeof CALLBACK_TIME_WINDOWS)[number];

/** Neutral labels: no clock times are promised here (business hours come from Business Settings). */
export const CALLBACK_TIME_WINDOW_LABELS: Record<CallbackTimeWindow, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
  ANYTIME: "Any time",
};

/** How far ahead a callback date may be requested. */
export const CALLBACK_MAX_DAYS_AHEAD = 30;

const IST_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

/** Today's calendar date in India (YYYY-MM-DD). The business operates in IST, so "today" must not follow the server's or browser's zone. */
export function istToday(now: Date = new Date()): string {
  return IST_DATE.format(now);
}

export function istDatePlusDays(days: number, now: Date = new Date()): string {
  return IST_DATE.format(new Date(now.getTime() + days * 86_400_000));
}

/** True for a real calendar date (rejects 2026-02-30 etc.). */
function isRealDate(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const callbackSubmissionSchema = z.object({
  idempotencyKey: z.string().uuid(),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit Indian mobile number"),
  email: optionalEmail.optional().default(""),
  preferredDate: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .superRefine((v, ctx) => {
      if (!v) return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !isRealDate(v)) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date." });
        return;
      }
      if (v < istToday())
        ctx.addIssue({ code: "custom", message: "The preferred date cannot be in the past." });
      else if (v > istDatePlusDays(CALLBACK_MAX_DAYS_AHEAD))
        ctx.addIssue({
          code: "custom",
          message: `Choose a date within the next ${CALLBACK_MAX_DAYS_AHEAD} days.`,
        });
    }),
  preferredTimeWindow: z.enum(CALLBACK_TIME_WINDOWS).default("ANYTIME"),
  reason: z
    .string()
    .trim()
    .max(200, "Reason must not exceed 200 characters")
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .max(500, "Message must not exceed 500 characters")
    .optional()
    .or(z.literal("")),
  [HONEYPOT_FIELD]: z.string().optional(),
});

export type CallbackSubmissionInput = z.infer<typeof callbackSubmissionSchema>;
