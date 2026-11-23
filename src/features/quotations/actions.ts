"use server";

import { revalidatePath } from "next/cache";
import { withAdminAction, type AdminActionResult } from "@/lib/auth/admin";
import { buildNotificationDeps } from "@/features/enquiries/server/deps";
import {
  createQuotationDraft,
  getTrackedQuotation,
  issueQuotation,
  type CreateQuotationInput,
} from "./server/quotations";
import type { CustomerTrackedQuotation } from "./types";

export async function createQuotationDraftAction(
  input: CreateQuotationInput,
): Promise<AdminActionResult<{ quotationId: string; reference: string }>> {
  return withAdminAction("createQuotationDraft", async (admin) => {
    const res = await createQuotationDraft(input, admin.id);
    if (!res.ok) {
      throw new Error(res.message);
    }
    revalidatePath(`/admin/enquiries/${input.enquiryId}`);
    return { quotationId: res.quotationId, reference: res.reference };
  });
}

export async function issueQuotationAction(
  quotationId: string,
  enquiryId: string,
): Promise<AdminActionResult<{ rawToken: string; trackingUrl: string; reference: string }>> {
  return withAdminAction("issueQuotation", async (admin) => {
    const res = await issueQuotation(quotationId, admin.id);
    if (!res.ok) {
      throw new Error(res.message);
    }
    revalidatePath(`/admin/enquiries/${enquiryId}`);
    revalidatePath("/admin/enquiries");
    return {
      rawToken: res.rawToken,
      trackingUrl: res.trackingUrl,
      reference: res.reference,
    };
  });
}

export async function getTrackedQuotationAction(
  token: string,
): Promise<{ ok: true; data: CustomerTrackedQuotation } | { ok: false; message: string }> {
  try {
    const nd = buildNotificationDeps();
    const data = await getTrackedQuotation(token, nd.rpc);
    if (!data) {
      return {
        ok: false,
        message:
          "Quotation not found, or the tracking link is invalid or expired. Please contact Sagar Traders directly.",
      };
    }
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      message: "We could not load your quotation right now. Please try again shortly.",
    };
  }
}
