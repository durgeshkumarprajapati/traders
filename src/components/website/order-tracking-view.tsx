import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatRupees } from "@/features/quotations/calculations";
import type { CustomerTrackedOrder } from "@/features/orders/types";

export function OrderTrackingView({ order }: { order: CustomerTrackedOrder }) {
  return (
    <div className="space-y-gutter-lg">
      <Card className="p-gutter-lg">
        <div className="flex flex-wrap items-center justify-between gap-gutter-md">
          <div>
            <p className="text-label-md text-on-surface-variant">Order Reference</p>
            <h1 className="text-headline-lg text-primary tabular-nums">{order.reference}</h1>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Customer: {order.customerName}
              {order.deliveryAddress ? ` • Delivery: ${order.deliveryAddress}` : ""}
            </p>
          </div>
          <Badge tone={order.status === "DELIVERED" ? "success" : "info"}>
            {order.status.replace(/_/g, " ")}
          </Badge>
        </div>

        {(order.expectedDeliveryDate || order.dispatchedAt || order.actualDeliveryDate) && (
          <div className="mt-gutter-md grid grid-cols-1 gap-gutter-sm rounded bg-surface-muted p-gutter-md sm:grid-cols-3 text-body-sm">
            {order.expectedDeliveryDate && (
              <div>
                <p className="text-on-surface-variant">Expected Delivery</p>
                <p className="font-semibold text-on-surface">
                  {new Date(order.expectedDeliveryDate).toLocaleDateString("en-IN")}
                </p>
              </div>
            )}
            {order.dispatchedAt && (
              <div>
                <p className="text-on-surface-variant">Dispatched</p>
                <p className="font-semibold text-on-surface">
                  {new Date(order.dispatchedAt).toLocaleString("en-IN")}
                </p>
              </div>
            )}
            {order.actualDeliveryDate && (
              <div>
                <p className="text-on-surface-variant">Delivered</p>
                <p className="font-semibold text-success">
                  {new Date(order.actualDeliveryDate).toLocaleString("en-IN")}
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-gutter-lg">
        <h2 className="flex items-center gap-2 text-headline-sm text-primary">
          <Package aria-hidden className="size-5" />
          Status Timeline
        </h2>
        <ul className="mt-gutter-md space-y-3">
          {order.timeline.map((step, idx) => (
            <li key={idx} className="border-l-2 border-primary pl-4">
              <p className="text-title-md font-semibold text-on-surface">
                {step.newStatus.replace(/_/g, " ")}
              </p>
              {step.description && (
                <p className="text-body-sm text-on-surface-variant">{step.description}</p>
              )}
              <p className="text-body-sm text-on-surface-variant">
                {new Date(step.createdAt).toLocaleString("en-IN")}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-gutter-lg">
        <h2 className="text-headline-sm text-primary">Order Items</h2>
        <div className="mt-gutter-sm overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th>Product</Th>
                <Th>Quantity</Th>
                <Th>Rate</Th>
                <Th>Total</Th>
              </Tr>
            </THead>
            <TBody>
              {order.items.map((it) => (
                <Tr key={it.position}>
                  <Td>
                    <p className="font-medium text-on-surface">{it.productName}</p>
                    {it.brandName && (
                      <p className="text-body-sm text-on-surface-variant">{it.brandName}</p>
                    )}
                  </Td>
                  <Td className="tabular-nums">
                    {it.quantity} {it.unitLabel}
                  </Td>
                  <Td className="tabular-nums">{formatRupees(it.unitPrice)}</Td>
                  <Td className="font-semibold tabular-nums">{formatRupees(it.lineTotal)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
        <div className="mt-gutter-md flex justify-end border-t border-border pt-gutter-sm text-title-lg font-bold text-primary tabular-nums">
          Approved Total: {formatRupees(order.totalAmount)}
        </div>
      </Card>
    </div>
  );
}
