import type { UnitCode } from "@/features/products/units";

export const ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Strict server-enforced state machine transitions for orders. */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "READY_FOR_DISPATCH", "CANCELLED"],
  PREPARING: ["READY_FOR_DISPATCH", "DISPATCHED", "CANCELLED"],
  READY_FOR_DISPATCH: ["DISPATCHED", "OUT_FOR_DELIVERY", "CANCELLED"],
  DISPATCHED: ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export interface OrderItem {
  id: string;
  orderId: string;
  position: number;
  productId: string | null;
  sku: string | null;
  productName: string;
  brandName: string | null;
  unitCode: UnitCode;
  unitLabel: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderStatusHistoryRow {
  id: string;
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  description: string | null;
  createdAt: string;
}

export interface DeliveryRecord {
  id: string;
  orderId: string;
  deliveryAddress: string | null;
  contactPerson: string | null;
  contactNumber: string | null;
  vehicleNumber: string | null;
  driverName: string | null;
  dispatchedAt: string | null;
  expectedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  deliveryNotes: string | null;
  proofOfDeliveryUrl: string | null;
  updatedAt: string;
}

export interface OrderRecord {
  id: string;
  reference: string;
  customerId: string | null;
  enquiryId: string | null;
  quotationId: string | null;
  quotationVersion: number | null;
  status: OrderStatus;
  customerName: string;
  mobile: string;
  email: string | null;
  deliveryAddress: string | null;
  customerInstructions: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  expectedDeliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTrackedOrder {
  reference: string;
  status: OrderStatus;
  customerName: string;
  deliveryAddress: string | null;
  contactPerson: string | null;
  contactNumber: string | null;
  customerInstructions: string | null;
  expectedDeliveryDate: string | null;
  dispatchedAt: string | null;
  actualDeliveryDate: string | null;
  customerConfirmedAt: string | null;
  hasReview: boolean;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  createdAt: string;
  items: Array<{
    position: number;
    productId: string | null;
    productName: string;
    brandName: string | null;
    unitCode: string;
    unitLabel: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  timeline: Array<{
    previousStatus: OrderStatus | null;
    newStatus: OrderStatus;
    description: string | null;
    createdAt: string;
  }>;
  issues: Array<{
    id: string;
    issueType: string;
    description: string;
    status: string;
    createdAt: string;
  }>;
}
