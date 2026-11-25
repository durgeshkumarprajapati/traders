"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import {
  addOrderNoteAction,
  transitionOrderStatusAction,
  updateDeliveryRecordAction,
} from "@/features/orders/actions";
import {
  ALLOWED_ORDER_TRANSITIONS,
  type DeliveryRecord,
  type OrderItem,
  type OrderRecord,
  type OrderStatus,
  type OrderStatusHistoryRow,
} from "@/features/orders/types";
import { formatRupees } from "@/features/quotations/calculations";

interface Props {
  order: OrderRecord;
  items: OrderItem[];
  history: OrderStatusHistoryRow[];
  delivery: DeliveryRecord | null;
  notes: { id: string; body: string; createdAt: string }[];
}

export function OrderDetailView({ order, items, history, delivery, notes }: Props) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const nextOptions = ALLOWED_ORDER_TRANSITIONS[order.status];
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">(nextOptions[0] ?? "");
  const [statusDesc, setStatusDesc] = useState("");
  const [noteBody, setNoteBody] = useState("");

  // Delivery fields
  const [deliveryAddress, setDeliveryAddress] = useState(
    delivery?.deliveryAddress ?? order.deliveryAddress ?? "",
  );
  const [contactPerson, setContactPerson] = useState(
    delivery?.contactPerson ?? order.customerName,
  );
  const [contactNumber, setContactNumber] = useState(delivery?.contactNumber ?? order.mobile);
  const [vehicleNumber, setVehicleNumber] = useState(delivery?.vehicleNumber ?? "");
  const [driverName, setDriverName] = useState(delivery?.driverName ?? "");
  const [expectedDate, setExpectedDate] = useState(
    delivery?.expectedDeliveryDate ?? order.expectedDeliveryDate ?? "",
  );
  const [deliveryNotes, setDeliveryNotes] = useState(delivery?.deliveryNotes ?? "");

  function handleTransition(e: React.FormEvent) {
    e.preventDefault();
    if (!nextStatus) return;
    startTransition(async () => {
      const res = await transitionOrderStatusAction({
        orderId: order.id,
        newStatus: nextStatus,
        description: statusDesc.trim() || undefined,
      });
      setFeedback(res.ok ? `Order moved to ${res.data.status}.` : res.message);
      if (res.ok) setStatusDesc("");
    });
  }

  function handleDeliverySave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateDeliveryRecordAction({
        orderId: order.id,
        deliveryAddress: deliveryAddress.trim() || null,
        contactPerson: contactPerson.trim() || null,
        contactNumber: contactNumber.trim() || null,
        vehicleNumber: vehicleNumber.trim() || null,
        driverName: driverName.trim() || null,
        expectedDeliveryDate: expectedDate || null,
        deliveryNotes: deliveryNotes.trim() || null,
      });
      setFeedback(res.ok ? "Delivery details saved." : res.message);
    });
  }

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    startTransition(async () => {
      const res = await addOrderNoteAction({ orderId: order.id, body: noteBody });
      if (res.ok) {
        setNoteBody("");
        setFeedback("Internal order note added.");
      } else {
        setFeedback(res.message);
      }
    });
  }

  return (
    <div className="space-y-gutter-lg">
      <div>
        <Link href="/admin/orders" className="text-label-md text-primary hover:underline">
          ← Back to Orders
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-gutter-sm">
          <h1 className="text-headline-lg text-primary tabular-nums">{order.reference}</h1>
          <Badge tone={order.status === "DELIVERED" ? "success" : "info"}>
            {order.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="text-body-md text-on-surface-variant">
          {order.customerName} • +91 {order.mobile} • Total {formatRupees(order.totalAmount)}
        </p>
      </div>

      {feedback && (
        <div role="status" className="rounded border border-info bg-surface-muted px-4 py-2 text-body-md">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-gutter-lg lg:grid-cols-3">
        <div className="space-y-gutter-lg lg:col-span-2">
          <Card className="p-gutter-md">
            <h2 className="text-headline-sm text-primary">Order Items (Immutable Snapshot)</h2>
            <div className="mt-gutter-sm overflow-x-auto">
              <Table>
                <THead>
                  <Tr>
                    <Th>Product</Th>
                    <Th>Qty</Th>
                    <Th>Rate</Th>
                    <Th>Total</Th>
                  </Tr>
                </THead>
                <TBody>
                  {items.map((it) => (
                    <Tr key={it.id}>
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
          </Card>

          <Card className="p-gutter-md">
            <h2 className="flex items-center gap-2 text-headline-sm text-primary">
              <Truck aria-hidden className="size-5" />
              Delivery &amp; Dispatch Details
            </h2>
            <form className="mt-gutter-sm space-y-gutter-sm" onSubmit={handleDeliverySave}>
              <Field label="Delivery Address">
                {(props) => (
                  <Textarea
                    {...props}
                    rows={2}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                  />
                )}
              </Field>
              <div className="grid grid-cols-1 gap-gutter-sm sm:grid-cols-2">
                <Field label="Contact Person">
                  {(props) => (
                    <Input
                      {...props}
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Contact Number">
                  {(props) => (
                    <Input
                      {...props}
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Vehicle Number (If Assigned)">
                  {(props) => (
                    <Input
                      {...props}
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="Optional"
                    />
                  )}
                </Field>
                <Field label="Driver Name (If Assigned)">
                  {(props) => (
                    <Input
                      {...props}
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Optional"
                    />
                  )}
                </Field>
                <Field label="Expected Delivery Date">
                  {(props) => (
                    <Input
                      {...props}
                      type="date"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                    />
                  )}
                </Field>
              </div>
              <Field label="Delivery Notes">
                {(props) => (
                  <Textarea
                    {...props}
                    rows={2}
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                  />
                )}
              </Field>
              <Button type="submit" size="sm" disabled={pending}>
                Save Delivery Details
              </Button>
            </form>
          </Card>
        </div>

        <div className="space-y-gutter-lg">
          {nextOptions.length > 0 && (
            <Card className="p-gutter-md">
              <h2 className="text-headline-sm text-primary">Update Order Status</h2>
              <form className="mt-gutter-sm space-y-gutter-sm" onSubmit={handleTransition}>
                <Field label="Next Status">
                  {(props) => (
                    <Select
                      {...props}
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
                    >
                      {nextOptions.map((st) => (
                        <option key={st} value={st}>
                          {st.replace(/_/g, " ")}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Status Note (Optional)">
                  {(props) => (
                    <Input
                      {...props}
                      value={statusDesc}
                      onChange={(e) => setStatusDesc(e.target.value)}
                      placeholder="e.g. Loaded onto truck"
                    />
                  )}
                </Field>
                <Button type="submit" size="sm" disabled={pending} className="w-full">
                  Update Status
                </Button>
              </form>
            </Card>
          )}

          <Card className="p-gutter-md">
            <h2 className="text-headline-sm text-primary">Status History</h2>
            <ul className="mt-gutter-sm space-y-2 text-body-sm">
              {history.map((h) => (
                <li key={h.id} className="border-l-2 border-primary pl-3">
                  <p className="font-semibold text-on-surface">{h.newStatus.replace(/_/g, " ")}</p>
                  {h.description && <p className="text-on-surface-variant">{h.description}</p>}
                  <p className="text-on-surface-variant">
                    {new Date(h.createdAt).toLocaleString("en-IN")}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-gutter-md">
            <h2 className="text-headline-sm text-primary">Internal Notes</h2>
            <form className="mt-gutter-sm space-y-gutter-xs" onSubmit={handleAddNote}>
              <Textarea
                rows={2}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Private order note..."
              />
              <Button type="submit" size="sm" variant="outline" disabled={pending}>
                Add Note
              </Button>
            </form>
            <ul className="mt-gutter-sm space-y-2 text-body-sm">
              {notes.map((n) => (
                <li key={n.id} className="rounded bg-surface-muted p-2">
                  <p>{n.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
