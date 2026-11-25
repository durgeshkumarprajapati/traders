"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashTrackingToken } from "@/features/enquiries/server/tracking";
import { guardTokenAccess } from "@/features/quotations/server/access";
import { logger } from "@/lib/logger";
import { loadSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseRpc } from "@/lib/supabase/rest";

const confirmSchema = z.object({
  token: z.string().min(32).max(128),
  note: z.string().trim().max(500).optional(),
});

const issueSchema = z.object({
  token: z.string().min(32).max(128),
  issueType: z.enum([
    "DELAY",
    "MISSING_MATERIAL",
    "DAMAGED_MATERIAL",
    "INCORRECT_MATERIAL",
    "OTHER",
  ]),
  description: z.string().trim().min(5, "Please describe the issue").max(2000),
});

export async function confirmOrderDeliveryAction(
  rawInput: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = confirmSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const gate = await guardTokenAccess();
  if (!gate.allowed) return { ok: false, message: "Too many attempts. Please wait a few minutes." };

  try {
    const rpc = createSupabaseRpc(loadSupabaseConfig());
    const res = await rpc<{ ok: boolean; reason?: string }>("confirm_order_delivery", {
      p_token_hash: hashTrackingToken(parsed.data.token),
      p_note: parsed.data.note ?? null,
    });
    if (!res?.ok) {
      return {
        ok: false,
        message:
          res?.reason === "NOT_DISPATCHED"
            ? "Delivery can only be confirmed after the order has been dispatched."
            : "Order link is invalid or unavailable.",
      };
    }
    revalidatePath(`/order/${parsed.data.token}`);
    return { ok: true };
  } catch (error) {
    logger.error("confirm_order_delivery_failed", { error });
    return { ok: false, message: "Could not record delivery confirmation." };
  }
}

export async function reportDeliveryIssueAction(
  rawInput: unknown,
): Promise<{ ok: true; issueId: string } | { ok: false; message: string }> {
  const parsed = issueSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please describe the issue." };
  }

  const gate = await guardTokenAccess();
  if (!gate.allowed) return { ok: false, message: "Too many attempts. Please wait a few minutes." };

  try {
    const rpc = createSupabaseRpc(loadSupabaseConfig());
    const res = await rpc<{ ok: boolean; issue_id?: string }>("report_order_delivery_issue", {
      p_token_hash: hashTrackingToken(parsed.data.token),
      p_issue_type: parsed.data.issueType,
      p_description: parsed.data.description,
    });
    if (!res?.ok || !res.issue_id) {
      return { ok: false, message: "Order link is invalid or unavailable." };
    }
    revalidatePath(`/order/${parsed.data.token}`);
    revalidatePath("/admin/orders");
    return { ok: true, issueId: res.issue_id };
  } catch (error) {
    logger.error("report_delivery_issue_failed", { error });
    return { ok: false, message: "Could not submit your delivery issue." };
  }
}
