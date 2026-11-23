import { z } from "zod";
import { HONEYPOT_FIELD } from "./submission-schemas";

export const CALLBACK_TIME_WINDOWS = ["MORNING", "AFTERNOON", "EVENING", "ANYTIME"] as const;

export type CallbackTimeWindow = (typeof CALLBACK_TIME_WINDOWS)[number];

export const CALLBACK_TIME_WINDOW_LABELS: Record<CallbackTimeWindow, string> = {
  MORNING: "Morning (9:00 AM – 12:00 PM)",
  AFTERNOON: "Afternoon (12:00 PM – 3:00 PM)",
  EVENING: "Evening (3:00 PM – 6:00 PM)",
  ANYTIME: "Anytime during business hours",
};

export const callbackSubmissionSchema = z.object({
  idempotencyKey: z.string().uuid(),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  mobile: z
    .string()
    .trim()
    .regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit Indian mobile number"),
  preferredDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
    .optional()
    .or(z.literal("")),
  preferredTimeWindow: z.enum(CALLBACK_TIME_WINDOWS).default("ANYTIME"),
  reason: z
    .string()
    .trim()
    .max(200, "Reason must not exceed 200 characters")
    .optional()
    .or(z.literal("")),
  [HONEYPOT_FIELD]: z.string().optional(),
});

export type CallbackSubmissionInput = z.infer<typeof callbackSubmissionSchema>;
