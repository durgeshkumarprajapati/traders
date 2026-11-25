"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Package, RefreshCw, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { enquiryList } from "@/features/enquiries/enquiry-list-store";
import {
  confirmOrderDeliveryAction,
  reportDeliveryIssueAction,
} from "@/features/orders/customer-actions";
import type { CustomerTrackedOrder, OrderStatus } from "@/features/orders/types";
import { formatRupees } from "@/features/quotations/calculations";
import { submitOrderReviewAction } from "@/features/reviews/actions";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const ORDER_STATUS_EXPLANATIONS: Record<OrderStatus, string> = {
  DRAFT: "Your order is being finalized by our team.",
  CONFIRMED: "Your order is confirmed and scheduled for preparation.",
  PREPARING: "Materials are being gathered and packed at our depot.",
  READY_FOR_DISPATCH: "Your materials are packed and ready for loading.",
  DISPATCHED: "Your order has left our depot and is on the way.",
  OUT_FOR_DELIVERY: "Your delivery vehicle is heading to your site.",
  DELIVERED: "Your order has been delivered.",
  CANCELLED: "This order has been cancelled. Contact Sagar Traders for any questions.",
};

export function OrderTrackingView({
  order,
  token,
  whatsappNumber = null,
}: {
  order: CustomerTrackedOrder;
  token: string;
  whatsappNumber?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmedAt, setConfirmedAt] = useState(order.customerConfirmedAt);
  const [confirmNote, setConfirmNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueType, setIssueType] = useState<
    "DELAY" | "MISSING_MATERIAL" | "DAMAGED_MATERIAL" | "INCORRECT_MATERIAL" | "OTHER"
  >("DELAY");
  const [issueDesc, setIssueDesc] = useState("");

  const [hasReview, setHasReview] = useState(order.hasReview);
  const [overallRating, setOverallRating] = useState(5);
  const [qualityRating, setQualityRating] = useState(5);
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewConsent, setReviewConsent] = useState(false);

  const [reorderNotice, setReorderNotice] = useState<string | null>(null);

  function handleConfirmDelivery() {
    startTransition(async () => {
      const res = await confirmOrderDeliveryAction({
        token,
        note: confirmNote.trim() || undefined,
      });
      if (res.ok) {
        setConfirmedAt(new Date().toISOString());
        setFeedback("Thank you! Your delivery confirmation has been recorded.");
      } else {
        setFeedback(res.message);
      }
    });
  }

  function handleIssueSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await reportDeliveryIssueAction({
        token,
        issueType,
        description: issueDesc,
      });
      if (res.ok) {
        setIssueDesc("");
        setShowIssueForm(false);
        setFeedback("Your delivery issue has been reported to Sagar Traders.");
      } else {
        setFeedback(res.message);
      }
    });
  }

  function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await submitOrderReviewAction({
        token,
        overallRating,
        qualityRating,
        deliveryRating,
        serviceRating,
        feedback: reviewText.trim() || undefined,
        reviewerDisplayName: reviewerName.trim() || undefined,
        consentToPublish: reviewConsent,
      });
      if (res.ok) {
        setHasReview(true);
        setFeedback("Thank you for your verified review!");
      } else {
        setFeedback(res.message);
      }
    });
  }

  function handleReorder() {
    let addedCount = 0;
    let unlinkedCount = 0;
    for (const item of order.items) {
      if (item.productId) {
        enquiryList.add(item.productId, item.quantity);
        addedCount += 1;
      } else {
        unlinkedCount += 1;
      }
    }
    if (addedCount > 0) {
      router.push("/bulk-enquiry");
    } else {
      setReorderNotice(
        `These ${unlinkedCount} custom items can be reordered directly via WhatsApp or Bulk Enquiry with current rates.`,
      );
    }
  }

  const waReorderHref = buildWhatsAppUrl(
    whatsappNumber,
    `Hello Sagar Traders, I would like to reorder materials from order ${order.reference}:\n${order.items
      .map((i) => `- ${i.productName}: ${i.quantity} ${i.unitLabel}`)
      .join("\n")}\nPlease share the latest rates and availability.`,
  );

  const canConfirm =
    !confirmedAt &&
    (order.status === "DISPATCHED" ||
      order.status === "OUT_FOR_DELIVERY" ||
      order.status === "DELIVERED");

  return (
    <div className="space-y-gutter-lg">
      {feedback && (
        <div role="status" className="rounded border border-info bg-surface-muted px-4 py-3 text-body-md">
          {feedback}
        </div>
      )}

      <Card className="p-gutter-lg space-y-gutter-md">
        <div className="flex flex-wrap items-center justify-between gap-gutter-md">
          <div>
            <p className="text-label-md text-on-surface-variant">Order Reference</p>
            <h1 className="text-headline-lg text-primary tabular-nums">{order.reference}</h1>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Customer: {order.customerName}
              {order.deliveryAddress ? ` • Delivery: ${order.deliveryAddress}` : ""}
            </p>
          </div>
          <Badge tone={order.status === "DELIVERED" ? "success" : order.status === "CANCELLED" ? "error" : "info"}>
            {order.status.replace(/_/g, " ")}
          </Badge>
        </div>

        <p className="rounded bg-surface-muted p-3 text-body-md text-on-surface">
          <strong>What this means: </strong>
          {ORDER_STATUS_EXPLANATIONS[order.status]}
        </p>

        {(order.expectedDeliveryDate ||
          order.dispatchedAt ||
          order.actualDeliveryDate ||
          order.contactPerson ||
          order.customerInstructions) && (
          <div className="grid grid-cols-1 gap-gutter-sm rounded border border-border p-gutter-md sm:grid-cols-2 lg:grid-cols-3 text-body-sm">
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
            {(order.contactPerson || order.contactNumber) && (
              <div>
                <p className="text-on-surface-variant">Delivery Contact</p>
                <p className="font-semibold text-on-surface">
                  {order.contactPerson}
                  {order.contactNumber ? ` (${order.contactNumber})` : ""}
                </p>
              </div>
            )}
            {order.customerInstructions && (
              <div className="sm:col-span-2">
                <p className="text-on-surface-variant">Delivery Instructions</p>
                <p className="text-on-surface">{order.customerInstructions}</p>
              </div>
            )}
          </div>
        )}

        {/* Customer delivery confirmation & issue reporting */}
        <div className="flex flex-wrap items-center gap-gutter-sm pt-2">
          {confirmedAt ? (
            <Badge tone="success">
              Delivery confirmed by you on {new Date(confirmedAt).toLocaleDateString("en-IN")}
            </Badge>
          ) : canConfirm ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Optional delivery confirmation note"
                className="max-w-xs"
                placeholder="Optional note (e.g. received in good condition)"
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
              />
              <Button type="button" size="sm" disabled={pending} onClick={handleConfirmDelivery}>
                <CheckCircle2 aria-hidden className="size-4" />
                Confirm Delivery Received
              </Button>
            </div>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowIssueForm((v) => !v)}
          >
            <AlertTriangle aria-hidden className="size-4" />
            Report a Delivery Issue
          </Button>
        </div>

        {showIssueForm && (
          <form
            className="space-y-gutter-sm rounded border border-border bg-surface-muted p-gutter-md"
            onSubmit={handleIssueSubmit}
          >
            <h3 className="text-title-md font-semibold text-primary">Report Delivery Issue</h3>
            <Field label="Issue Type">
              {(props) => (
                <Select
                  {...props}
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value as typeof issueType)}
                >
                  <option value="DELAY">Delivery Delay</option>
                  <option value="MISSING_MATERIAL">Missing Material</option>
                  <option value="DAMAGED_MATERIAL">Damaged Material</option>
                  <option value="INCORRECT_MATERIAL">Incorrect Material</option>
                  <option value="OTHER">Other Delivery Issue</option>
                </Select>
              )}
            </Field>
            <Field label="Describe what happened">
              {(props) => (
                <Textarea
                  {...props}
                  rows={3}
                  required
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                  placeholder="Share details so our team can assist quickly..."
                />
              )}
            </Field>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                Submit Issue Report
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowIssueForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
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

      <Card className="p-gutter-lg space-y-gutter-md">
        <div className="flex flex-wrap items-center justify-between gap-gutter-sm">
          <h2 className="text-headline-sm text-primary">Order Items</h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleReorder}>
              <RefreshCw aria-hidden className="size-4" />
              Reorder These Materials
            </Button>
            {waReorderHref && (
              <ButtonLink href={waReorderHref} target="_blank" rel="noopener noreferrer" size="sm" variant="outline">
                Reorder via WhatsApp
              </ButtonLink>
            )}
          </div>
        </div>
        {reorderNotice && (
          <p className="rounded bg-surface-muted p-3 text-body-sm text-on-surface-variant">
            {reorderNotice}
          </p>
        )}
        <div className="overflow-x-auto">
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
        <div className="flex justify-end border-t border-border pt-gutter-sm text-title-lg font-bold text-primary tabular-nums">
          Approved Total: {formatRupees(order.totalAmount)}
        </div>
        <p className="text-body-sm text-on-surface-variant">
          Note: Reordering creates a fresh enquiry using current Google Sheets rates and availability.
        </p>
      </Card>

      {/* Verified Review Section for Delivered Orders */}
      {order.status === "DELIVERED" && (
        <Card className="p-gutter-lg space-y-gutter-md">
          <h2 className="flex items-center gap-2 text-headline-sm text-primary">
            <Star aria-hidden className="size-5 text-secondary" />
            Share Your Experience
          </h2>
          {hasReview ? (
            <p className="text-body-md text-success font-medium">
              Thank you — your verified-purchase review for this order has been submitted.
            </p>
          ) : (
            <form className="space-y-gutter-sm" onSubmit={handleReviewSubmit}>
              <div className="grid grid-cols-2 gap-gutter-sm sm:grid-cols-4">
                {[
                  { label: "Overall (1-5)", val: overallRating, set: setOverallRating },
                  { label: "Product Quality", val: qualityRating, set: setQualityRating },
                  { label: "Delivery", val: deliveryRating, set: setDeliveryRating },
                  { label: "Service", val: serviceRating, set: setServiceRating },
                ].map((r) => (
                  <Field key={r.label} label={r.label}>
                    {(props) => (
                      <Select
                        {...props}
                        value={r.val}
                        onChange={(e) => r.set(Number(e.target.value))}
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>
                            {n} / 5
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                ))}
              </div>
              <Field label="Your Feedback (Optional)">
                {(props) => (
                  <Textarea
                    {...props}
                    rows={3}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="How was the material quality and delivery?"
                  />
                )}
              </Field>
              <Field label="Display Name (Optional)">
                {(props) => (
                  <Input
                    {...props}
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="Shown only if you give consent below"
                  />
                )}
              </Field>
              <label className="flex items-center gap-2 text-body-sm">
                <input
                  type="checkbox"
                  checked={reviewConsent}
                  onChange={(e) => setReviewConsent(e.target.checked)}
                />
                <span>I agree that my display name and feedback may be published after review.</span>
              </label>
              <Button type="submit" size="md" disabled={pending}>
                Submit Verified Review
              </Button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
