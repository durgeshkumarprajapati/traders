"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashTrackingToken } from "@/features/enquiries/server/tracking";
import { logger } from "@/lib/logger";
import { loadSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseRpc } from "@/lib/supabase/rest";
import { guardTokenAccess } from "./server/access";

const responseSchema = z.object({
  token: z.string().min(32).max(128),
  responseType: z.enum(["ACCEPTED", "CHANGE_REQUESTED", "REJECTED"]),
  comment: z.string().trim().max(2000).optional(),
});

export async function respondToQuotationAction(
  rawInput: unknown,
): Promise<{ ok: true; status: string } | { ok: false; message: string }> {
  const parsed = responseSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid quotation response.",
    };
  }

  const gate = await guardTokenAccess();
  if (!gate.allowed) {
    return {
      ok: false,
      message: "Too many attempts. Please wait a few minutes and try again.",
    };
  }

  const { token, responseType, comment } = parsed.data;
  if (responseType === "CHANGE_REQUESTED" && (!comment || comment.trim().length < 3)) {
    return { ok: false, message: "Please describe the changes you need." };
  }

  try {
    const rpc = createSupabaseRpc(loadSupabaseConfig());
    const res = await rpc<{
      ok: boolean;
      reason?: string;
      status?: string;
      reference?: string;
    }>("respond_to_quotation", {
      p_token_hash: hashTrackingToken(token),
      p_response_type: responseType,
      p_comment: comment ?? null,
    });

    if (!res?.ok) {
      if (res?.reason === "EXPIRED") {
        return { ok: false, message: "This quotation has expired and can no longer be accepted." };
      }
      if (res?.reason === "SUPERSEDED") {
        return {
          ok: false,
          message: "A newer version of this quotation has been issued. Please review the latest version.",
        };
      }
      if (res?.reason === "ALREADY_RESPONDED") {
        return { ok: false, message: "A response has already been recorded for this quotation." };
      }
      return { ok: false, message: "Quotation link is invalid or unavailable." };
    }

    revalidatePath(`/quotation/${token}`);
    revalidatePath("/admin/enquiries");
    return { ok: true, status: res.status ?? responseType };
  } catch (error) {
    logger.error("respond_to_quotation_failed", { error });
    return { ok: false, message: "Unable to record your response right now. Please try again." };
  }
}
