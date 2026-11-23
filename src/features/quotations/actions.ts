"use server";

import { revalidatePath } from "next/cache";
import { withAdminAction, type AdminActionResult } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import {
  createQuotationDraft,
  issueQuotation,
  revokeQuotationLink,
  rotateQuotationLink,
} from "./server/quotations";

/**
 * Admin-only quotation Server Actions. Each one runs inside `withAdminAction` (server-side session + admin check) and the
 * database functions re-check `is_admin()`, so a forged call from a customer or anonymous browser is refused twice.
 * Customer access to quotations is NOT an action: it is the token routes `/quotation/[token]` and its PDF.
 */
export async function createQuotationDraftAction(
  input: unknown,
): Promise<AdminActionResult<{ quotationId: string; reference: string; version: number }>> {
  return withAdminAction("createQuotationDraft", async () => {
    const res = await createQuotationDraft(input);
    if (!res.ok) throw new AppError("VALIDATION", res.message);
    const enquiryId = (input as { enquiryId?: string }).enquiryId;
    if (enquiryId) revalidatePath(`/admin/enquiries/${enquiryId}`);
    return { quotationId: res.quotationId, reference: res.reference, version: res.version };
  });
}

export async function issueQuotationAction(
  quotationId: string,
  enquiryId: string,
): Promise<
  AdminActionResult<{
    rawToken: string;
    trackingUrl: string;
    reference: string;
    enquiryStatusChanged: boolean;
  }>
> {
  return withAdminAction("issueQuotation", async () => {
    const res = await issueQuotation(quotationId);
    if (!res.ok) throw new AppError("VALIDATION", res.message);
    revalidatePath(`/admin/enquiries/${enquiryId}`);
    revalidatePath("/admin/enquiries");
    return {
      rawToken: res.rawToken,
      trackingUrl: res.trackingUrl,
      reference: res.reference,
      enquiryStatusChanged: res.enquiryStatusChanged,
    };
  });
}

export async function rotateQuotationLinkAction(
  quotationId: string,
  enquiryId: string,
): Promise<AdminActionResult<{ trackingUrl: string }>> {
  return withAdminAction("rotateQuotationLink", async () => {
    const res = await rotateQuotationLink(quotationId);
    if (!res.ok) throw new AppError("VALIDATION", res.message);
    revalidatePath(`/admin/enquiries/${enquiryId}`);
    return { trackingUrl: res.trackingUrl };
  });
}

export async function revokeQuotationLinkAction(
  quotationId: string,
  enquiryId: string,
): Promise<AdminActionResult<{ revoked: true }>> {
  return withAdminAction("revokeQuotationLink", async () => {
    const res = await revokeQuotationLink(quotationId);
    if (!res.ok) throw new AppError("VALIDATION", res.message);
    revalidatePath(`/admin/enquiries/${enquiryId}`);
    return { revoked: true };
  });
}
