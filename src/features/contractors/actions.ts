"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withAdminAction, type AdminActionResult } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";

const createListSchema = z.object({
  customerId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  notes: z.string().trim().max(1000).optional(),
});

const createOfferSchema = z.object({
  customerId: z.string().uuid(),
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(1000).optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "CUSTOM_TERM"]).optional(),
  discountValue: z.number().nonnegative().optional(),
  isActive: z.boolean().default(true),
});

export async function createContractorMaterialListAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string }>> {
  const parsed = createListSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", message: "Invalid list name." };
  }
  return withAdminAction("createContractorMaterialList", async (admin, client) => {
    const { data, error } = await client
      .from("contractor_material_lists")
      .insert({
        customer_id: parsed.data.customerId,
        name: parsed.data.name,
        notes: parsed.data.notes ?? null,
        created_by: admin.id,
      })
      .select("id")
      .single();
    if (error || !data) throw new AppError("INTERNAL", "Failed to create material list.");
    revalidatePath(`/admin/contractors/${parsed.data.customerId}`);
    return { id: String(data.id) };
  });
}

export async function createCustomerOfferAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string }>> {
  const parsed = createOfferSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid commercial offer.",
    };
  }
  const v = parsed.data;
  return withAdminAction("createCustomerOffer", async (admin, client) => {
    const { data, error } = await client
      .from("customer_offers")
      .insert({
        customer_id: v.customerId,
        title: v.title,
        description: v.description ?? null,
        valid_from: v.validFrom || null,
        valid_until: v.validUntil || null,
        discount_type: v.discountType ?? null,
        discount_value: v.discountValue ?? null,
        is_active: v.isActive,
        approved_by: admin.id,
      })
      .select("id")
      .single();
    if (error || !data) throw new AppError("INTERNAL", "Failed to save offer.");

    await client.from("audit_logs").insert({
      actor_id: admin.id,
      actor_type: "ADMIN",
      action: "CONTRACTOR_OFFER_CREATED",
      entity_type: "customer_offer",
      entity_id: String(data.id),
      details: { customer_id: v.customerId, title: v.title },
    });

    revalidatePath(`/admin/contractors/${v.customerId}`);
    return { id: String(data.id) };
  });
}
