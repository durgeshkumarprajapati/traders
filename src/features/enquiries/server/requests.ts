import "server-only";
import { logger } from "@/lib/logger";
import { checkCoverage, type CoverageStatus } from "@/features/delivery/coverage";
import { freightSubmissionSchema } from "@/features/delivery/schemas";
import {
  expertSubmissionSchema,
  EXPERT_PROJECT_LABELS,
  EXPERT_TOPIC_LABELS,
} from "@/features/expert/schemas";
import { ENQUIRY_MESSAGES, type EnquiryActionResult } from "../result";
import { toSubmissionFieldErrors } from "../submission-schemas";
import {
  isHoneypotFilled,
  limited,
  persistAndNotify,
  type SubmitContext,
  type SubmitDeps,
} from "./submit";
import { generateTrackingToken, hashTrackingToken } from "./tracking";

/**
 * Freight and expert questions are GENERAL enquiries (they appear in the same admin inbox, tracking page and notification
 * flow) plus a structured `enquiry_metadata` row written in the SAME database transaction. Nothing here quotes a price,
 * promises delivery, or answers automatically.
 */
const validation = (error: Parameters<typeof toSubmissionFieldErrors>[0]): EnquiryActionResult => ({
  ok: false,
  code: "VALIDATION",
  message: ENQUIRY_MESSAGES.validation,
  fieldErrors: toSubmissionFieldErrors(error),
});

export async function submitFreightEnquiry(
  input: unknown,
  ctx: SubmitContext,
  deps: SubmitDeps,
): Promise<EnquiryActionResult> {
  if (isHoneypotFilled(input)) {
    logger.info("honeypot_triggered", { form: "freight" });
    return { ok: true, reference: null };
  }
  const parsed = freightSubmissionSchema.safeParse(input);
  if (!parsed.success) return validation(parsed.error);
  const v = parsed.data;

  const blocked = await limited(deps.rpc, deps.rateLimitSecret, ctx.ip, v.mobile, deps);
  if (blocked) return blocked;

  // Coverage is re-evaluated HERE from the authoritative settings; whatever the browser displayed is never trusted.
  let coverage: CoverageStatus = "NOT_CONFIGURED";
  try {
    const load = await deps.loadCatalogue();
    if (load.ok && load.source === "LIVE")
      coverage = checkCoverage(v.pincode, load.settings.delivery);
  } catch (error) {
    logger.warn("freight_coverage_lookup_failed", { error });
  }

  const trackingToken = generateTrackingToken(v.idempotencyKey, deps.rateLimitSecret);
  const message = [
    `Freight / delivery enquiry for PIN ${v.pincode}.`,
    `Materials: ${v.materials}.`,
    v.quantityNote && `Quantity: ${v.quantityNote}.`,
    v.message,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1000);

  return persistAndNotify(
    "GENERAL",
    {
      idempotency_key: v.idempotencyKey,
      type: "GENERAL",
      name: v.name,
      mobile: v.mobile,
      email: v.email,
      delivery_location: `${v.locality}, PIN ${v.pincode}`.slice(0, 300),
      message,
      tracking_token_hash: hashTrackingToken(trackingToken),
      metadata: {
        kind: "DELIVERY",
        data: {
          pincode: v.pincode,
          locality: v.locality,
          materials: v.materials,
          quantity_note: v.quantityNote || null,
          coverage_status_at_submission: coverage,
        },
      },
      items: [],
    },
    0,
    deps,
    trackingToken,
  );
}

export async function submitExpertEnquiry(
  input: unknown,
  ctx: SubmitContext,
  deps: SubmitDeps,
): Promise<EnquiryActionResult> {
  if (isHoneypotFilled(input)) {
    logger.info("honeypot_triggered", { form: "expert" });
    return { ok: true, reference: null };
  }
  const parsed = expertSubmissionSchema.safeParse(input);
  if (!parsed.success) return validation(parsed.error);
  const v = parsed.data;

  const blocked = await limited(deps.rpc, deps.rateLimitSecret, ctx.ip, v.mobile, deps);
  if (blocked) return blocked;

  const trackingToken = generateTrackingToken(v.idempotencyKey, deps.rateLimitSecret);
  const message = [
    `Materials expert question (${EXPERT_TOPIC_LABELS[v.topic]}; ${EXPERT_PROJECT_LABELS[v.projectType]}).`,
    v.question,
    v.usage && `Intended use: ${v.usage}`,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1000);

  return persistAndNotify(
    "GENERAL",
    {
      idempotency_key: v.idempotencyKey,
      type: "GENERAL",
      name: v.name,
      mobile: v.mobile,
      email: v.email,
      message,
      tracking_token_hash: hashTrackingToken(trackingToken),
      metadata: {
        kind: "EXPERT",
        data: {
          topic: v.topic,
          project_type: v.projectType,
          question: v.question,
          usage: v.usage || null,
          attachments: "NOT_SUPPORTED",
        },
      },
      items: [],
    },
    0,
    deps,
    trackingToken,
  );
}
