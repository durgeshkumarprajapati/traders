import { z } from "zod";
import { ORDER_STATUSES } from "./types";

export const createOrderFromQuotationSchema = z.object({
  quotationId: z.string().uuid(),
  expectedDeliveryDate: z.string().optional(),
  instructions: z.string().trim().max(1000).optional(),
});

export const transitionOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  newStatus: z.enum(ORDER_STATUSES),
  description: z.string().trim().max(500).optional(),
});

export const updateDeliverySchema = z.object({
  orderId: z.string().uuid(),
  deliveryAddress: z.string().trim().max(300).nullable().optional(),
  contactPerson: z.string().trim().max(100).nullable().optional(),
  contactNumber: z.string().trim().max(20).nullable().optional(),
  vehicleNumber: z.string().trim().max(40).nullable().optional(),
  driverName: z.string().trim().max(100).nullable().optional(),
  dispatchedAt: z.string().nullable().optional(),
  expectedDeliveryDate: z.string().nullable().optional(),
  actualDeliveryDate: z.string().nullable().optional(),
  deliveryNotes: z.string().trim().max(1000).nullable().optional(),
});

export const addOrderNoteSchema = z.object({
  orderId: z.string().uuid(),
  body: z.string().trim().min(1, "Note cannot be empty").max(2000),
});
