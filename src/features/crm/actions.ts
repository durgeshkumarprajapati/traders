"use server";

import { revalidatePath } from "next/cache";
import { withAdminAction, type AdminActionResult } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import {
  createFollowupSchema,
  customerInteractionSchema,
  customerNoteSchema,
  mergeCustomersSchema,
  updateCustomerNoteSchema,
  updateCustomerSchema,
  updateFollowupSchema,
} from "./schemas";
import { mergeCustomersRpc } from "./server/crm";

export async function updateCustomerProfileAction(
  customerId: string,
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string }>> {
  const parsed = updateCustomerSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid customer details.",
    };
  }
  const v = parsed.data;
  return withAdminAction("updateCustomerProfile", async (admin, client) => {
    const { error } = await client
      .from("customers")
      .update({
        name: v.name,
        email: v.email ?? null,
        company_name: v.companyName ?? null,
        address: v.address ?? null,
        customer_type: v.customerType,
        relationship_tier: v.relationshipTier,
        is_contractor: v.isContractor,
        contractor_classification: v.contractorClassification ?? null,
        service_area: v.serviceArea ?? null,
        preferred_categories: v.preferredCategories ?? [],
        preferred_brands: v.preferredBrands ?? [],
        programme_status: v.programmeStatus,
        lifecycle_status: v.lifecycleStatus,
        whatsapp_opt_in: v.whatsappOptIn ?? false,
      })
      .eq("id", customerId);

    if (error) throw new AppError("INTERNAL", "Failed to update customer profile.");

    await client.from("audit_logs").insert({
      actor_id: admin.id,
      actor_type: "ADMIN",
      action: "CUSTOMER_UPDATED",
      entity_type: "customer",
      entity_id: customerId,
      details: { customer_type: v.customerType, relationship_tier: v.relationshipTier },
    });

    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${customerId}`);
    revalidatePath("/admin/contractors");
    return { id: customerId };
  });
}

export async function addCustomerNoteAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string }>> {
  const parsed = customerNoteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid note.",
    };
  }
  return withAdminAction("addCustomerNote", async (admin, client) => {
    const { data, error } = await client
      .from("customer_notes")
      .insert({
        customer_id: parsed.data.customerId,
        author_id: admin.id,
        body: parsed.data.body,
      })
      .select("id")
      .single();

    if (error || !data) throw new AppError("INTERNAL", "Failed to save note.");
    revalidatePath(`/admin/customers/${parsed.data.customerId}`);
    return { id: String(data.id) };
  });
}

export async function updateCustomerNoteAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string }>> {
  const parsed = updateCustomerNoteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid note.",
    };
  }
  return withAdminAction("updateCustomerNote", async (admin, client) => {
    const { error } = await client
      .from("customer_notes")
      .update({ body: parsed.data.body })
      .eq("id", parsed.data.noteId)
      .eq("author_id", admin.id);

    if (error) throw new AppError("INTERNAL", "Failed to update note.");
    revalidatePath(`/admin/customers/${parsed.data.customerId}`);
    return { id: parsed.data.noteId };
  });
}

export async function addCustomerInteractionAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string }>> {
  const parsed = customerInteractionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid interaction.",
    };
  }
  const v = parsed.data;
  return withAdminAction("addCustomerInteraction", async (admin, client) => {
    const occurredAt = v.occurredAt ?? new Date().toISOString();
    const { data, error } = await client
      .from("customer_interactions")
      .insert({
        customer_id: v.customerId,
        enquiry_id: v.enquiryId ?? null,
        interaction_type: v.interactionType,
        occurred_at: occurredAt,
        summary: v.summary,
        next_action: v.nextAction ?? null,
        author_id: admin.id,
      })
      .select("id")
      .single();

    if (error || !data) throw new AppError("INTERNAL", "Failed to record interaction.");

    await client
      .from("customers")
      .update({ last_interaction_at: occurredAt })
      .eq("id", v.customerId);

    revalidatePath(`/admin/customers/${v.customerId}`);
    revalidatePath("/admin/customers");
    return { id: String(data.id) };
  });
}

export async function createFollowupAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string }>> {
  const parsed = createFollowupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid follow-up.",
    };
  }
  const v = parsed.data;
  return withAdminAction("createFollowup", async (admin, client) => {
    const dueDate = new Date(v.dueAt);
    if (Number.isNaN(dueDate.getTime())) {
      throw new AppError("VALIDATION", "Please enter a valid due date and time.");
    }
    const { data, error } = await client
      .from("customer_followups")
      .insert({
        customer_id: v.customerId,
        enquiry_id: v.enquiryId ?? null,
        quotation_id: v.quotationId ?? null,
        title: v.title,
        description: v.description ?? null,
        due_at: dueDate.toISOString(),
        priority: v.priority,
        status: "PENDING",
        assigned_to: admin.id,
        created_by: admin.id,
      })
      .select("id")
      .single();

    if (error || !data) throw new AppError("INTERNAL", "Failed to create follow-up.");
    revalidatePath("/admin/follow-ups");
    revalidatePath("/admin/dashboard");
    revalidatePath(`/admin/customers/${v.customerId}`);
    return { id: String(data.id) };
  });
}

export async function updateFollowupAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string }>> {
  const parsed = updateFollowupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid follow-up update.",
    };
  }
  const v = parsed.data;
  return withAdminAction("updateFollowup", async (_admin, client) => {
    const patch: Record<string, unknown> = {};
    if (v.status) {
      patch.status = v.status;
      if (v.status === "COMPLETED") patch.completed_at = new Date().toISOString();
      if (v.status === "CANCELLED") patch.cancelled_at = new Date().toISOString();
      if (v.status === "PENDING") {
        patch.completed_at = null;
        patch.cancelled_at = null;
      }
    }
    if (v.dueAt) {
      const d = new Date(v.dueAt);
      if (Number.isNaN(d.getTime())) throw new AppError("VALIDATION", "Invalid due date.");
      patch.due_at = d.toISOString();
    }
    if (v.priority) patch.priority = v.priority;

    const { error } = await client.from("customer_followups").update(patch).eq("id", v.followupId);
    if (error) throw new AppError("INTERNAL", "Failed to update follow-up.");

    revalidatePath("/admin/follow-ups");
    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/customers");
    return { id: v.followupId };
  });
}

export async function mergeCustomersAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ merged: boolean }>> {
  const parsed = mergeCustomersSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", message: "Invalid customer IDs for merge." };
  }
  return withAdminAction("mergeCustomers", async (_admin, client) => {
    const res = await mergeCustomersRpc(parsed.data.sourceId, parsed.data.targetId, client);
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${parsed.data.targetId}`);
    return res;
  });
}
