"use server";

import { revalidatePath } from "next/cache";
import { withAdminAction, type AdminActionResult } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import {
  addOrderNoteSchema,
  createOrderFromQuotationSchema,
  transitionOrderStatusSchema,
  updateDeliverySchema,
} from "./schemas";
import { createOrderFromQuotationServer, isValidOrderTransition } from "./server/orders";
import type { OrderStatus } from "./types";

export async function createOrderFromQuotationAction(rawInput: unknown): Promise<
  AdminActionResult<{
    orderId: string;
    reference: string;
    trackingPath: string;
  }>
> {
  const parsed = createOrderFromQuotationSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid order input.",
    };
  }
  return withAdminAction("createOrderFromQuotation", async (_admin, client) => {
    const res = await createOrderFromQuotationServer(
      parsed.data.quotationId,
      {
        expectedDeliveryDate: parsed.data.expectedDeliveryDate,
        instructions: parsed.data.instructions,
      },
      client,
    );
    revalidatePath("/admin/orders");
    revalidatePath("/admin/enquiries");
    return {
      orderId: res.orderId,
      reference: res.reference,
      trackingPath: res.trackingPath,
    };
  });
}

export async function transitionOrderStatusAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ orderId: string; status: OrderStatus }>> {
  const parsed = transitionOrderStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid status transition.",
    };
  }
  const { orderId, newStatus, description } = parsed.data;
  return withAdminAction("transitionOrderStatus", async (admin, client) => {
    const { data: current, error: fetchErr } = await client
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();

    if (fetchErr || !current) throw new AppError("VALIDATION", "Order not found.");
    const prevStatus = String(current.status) as OrderStatus;
    if (!isValidOrderTransition(prevStatus, newStatus)) {
      throw new AppError(
        "VALIDATION",
        `Cannot transition order from ${prevStatus} to ${newStatus}.`,
      );
    }

    const { error: updErr } = await client
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    if (updErr) throw new AppError("INTERNAL", "Failed to update order status.");

    await client.from("order_status_history").insert({
      order_id: orderId,
      previous_status: prevStatus,
      new_status: newStatus,
      changed_by: admin.id,
      description: description || `Status updated to ${newStatus}`,
    });

    if (newStatus === "DISPATCHED") {
      await client
        .from("delivery_records")
        .update({ dispatched_at: new Date().toISOString() })
        .eq("order_id", orderId);
    } else if (newStatus === "DELIVERED") {
      await client
        .from("delivery_records")
        .update({ actual_delivery_date: new Date().toISOString() })
        .eq("order_id", orderId);
    }

    await client.from("audit_logs").insert({
      actor_id: admin.id,
      actor_type: "ADMIN",
      action: "ORDER_STATUS_UPDATED",
      entity_type: "order",
      entity_id: orderId,
      details: { previous_status: prevStatus, new_status: newStatus },
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    return { orderId, status: newStatus };
  });
}

export async function updateDeliveryRecordAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ orderId: string }>> {
  const parsed = updateDeliverySchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid delivery details.",
    };
  }
  const v = parsed.data;
  return withAdminAction("updateDeliveryRecord", async (admin, client) => {
    const { error } = await client.from("delivery_records").upsert(
      {
        order_id: v.orderId,
        delivery_address: v.deliveryAddress ?? null,
        contact_person: v.contactPerson ?? null,
        contact_number: v.contactNumber ?? null,
        vehicle_number: v.vehicleNumber ?? null,
        driver_name: v.driverName ?? null,
        dispatched_at: v.dispatchedAt || null,
        expected_delivery_date: v.expectedDeliveryDate || null,
        actual_delivery_date: v.actualDeliveryDate || null,
        delivery_notes: v.deliveryNotes ?? null,
      },
      { onConflict: "order_id" },
    );

    if (error) throw new AppError("INTERNAL", "Failed to save delivery details.");

    await client.from("audit_logs").insert({
      actor_id: admin.id,
      actor_type: "ADMIN",
      action: "DELIVERY_UPDATED",
      entity_type: "order",
      entity_id: v.orderId,
      details: { expected_delivery_date: v.expectedDeliveryDate ?? null },
    });

    revalidatePath(`/admin/orders/${v.orderId}`);
    return { orderId: v.orderId };
  });
}

export async function addOrderNoteAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string }>> {
  const parsed = addOrderNoteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid note.",
    };
  }
  return withAdminAction("addOrderNote", async (admin, client) => {
    const { data, error } = await client
      .from("order_notes")
      .insert({
        order_id: parsed.data.orderId,
        author_id: admin.id,
        body: parsed.data.body,
      })
      .select("id")
      .single();
    if (error || !data) throw new AppError("INTERNAL", "Failed to add note.");
    revalidatePath(`/admin/orders/${parsed.data.orderId}`);
    return { id: String(data.id) };
  });
}
