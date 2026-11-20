"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form-controls";
import { Notification } from "@/components/ui/notification";
import { Spinner } from "@/components/ui/feedback";
import { EnquiryStatusBadge, StockBadge, type EnquiryStatus } from "@/components/ui/status-badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import {
  addEnquiryNoteAction,
  retryNotificationAction,
  updateEnquiryStatusAction,
} from "@/features/admin/actions";
import {
  ALLOWED_STATUS_TRANSITIONS,
  type AdminEnquiryDetail,
  type AdminEnquiryNote,
} from "@/features/admin/types";
import { formatPrice } from "@/features/products/format";

interface EnquiryDetailViewProps {
  enquiry: AdminEnquiryDetail;
}

export function EnquiryDetailView({ enquiry: initialEnquiry }: EnquiryDetailViewProps) {
  const router = useRouter();
  const [enquiry, setEnquiry] = useState(initialEnquiry);

  // Status mutation state
  const [status, setStatus] = useState<EnquiryStatus>(initialEnquiry.status);
  const [isUpdatingStatus, startStatusTransition] = useTransition();
  const [statusNotification, setStatusNotification] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  // Notes mutation state
  const [notes, setNotes] = useState<AdminEnquiryNote[]>(initialEnquiry.notes);
  const [noteBody, setNoteBody] = useState("");
  const [isAddingNote, startNoteTransition] = useTransition();
  const [noteNotification, setNoteNotification] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  // Outbox retry state
  const [isRetryingOutbox, startOutboxTransition] = useTransition();
  const [outboxNotification, setOutboxNotification] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  // Allowed transitions from current enquiry status
  const allowedNextStatuses = useMemo(() => {
    const list = ALLOWED_STATUS_TRANSITIONS[enquiry.status] ?? [];
    return [enquiry.status, ...list];
  }, [enquiry.status]);

  // Handle status update
  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status === enquiry.status) return;

    setStatusNotification(null);
    startStatusTransition(async () => {
      const res = await updateEnquiryStatusAction(enquiry.id, status);
      if (res.ok) {
        setEnquiry((prev) => ({ ...prev, status }));
        setStatusNotification({
          tone: "success",
          message: `Enquiry status updated to ${status}.`,
        });
        router.refresh();
      } else {
        setStatusNotification({
          tone: "error",
          message: res.message || "Failed to update enquiry status.",
        });
      }
    });
  };

  // Handle adding internal note
  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = noteBody.trim();
    if (!clean) return;

    setNoteNotification(null);
    startNoteTransition(async () => {
      const res = await addEnquiryNoteAction(enquiry.id, clean);
      if (res.ok) {
        const newNote: AdminEnquiryNote = {
          id: res.data.id,
          enquiryId: enquiry.id,
          authorId: "current-admin",
          authorEmail: "Administrator",
          authorName: "Administrator",
          body: res.data.body,
          createdAt: new Date().toISOString(),
        };
        setNotes((prev) => [newNote, ...prev]);
        setNoteBody("");
        setNoteNotification({
          tone: "success",
          message: "Internal staff note added.",
        });
        router.refresh();
      } else {
        setNoteNotification({
          tone: "error",
          message: res.message || "Failed to add internal note.",
        });
      }
    });
  };

  // Handle manual outbox retry
  const handleOutboxRetry = () => {
    if (!enquiry.outbox) return;
    setOutboxNotification(null);
    startOutboxTransition(async () => {
      const res = await retryNotificationAction(enquiry.outbox!.id);
      if (res.ok) {
        setOutboxNotification({
          tone: "success",
          message: "Email notification queued for retry.",
        });
        router.refresh();
      } else {
        setOutboxNotification({
          tone: "error",
          message: res.message || "Failed to retry email notification.",
        });
      }
    });
  };

  // Calculate indicative total if prices exist
  const indicativeTotal = useMemo(() => {
    let sum = 0;
    let hasPrices = false;
    for (const item of enquiry.items) {
      if (item.listedPrice !== null && item.listedPrice > 0) {
        sum += item.listedPrice * item.quantity;
        hasPrices = true;
      }
    }
    return hasPrices ? sum : null;
  }, [enquiry.items]);

  const cleanPhoneDigits = enquiry.mobile.replace(/\D/g, "");

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <ButtonLink variant="outline" size="sm" href="/admin/enquiries">
            <ArrowLeft aria-hidden="true" className="size-4 mr-1.5" />
            Back to Enquiries
          </ButtonLink>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-headline-xl font-bold font-mono text-primary">
              {enquiry.reference}
            </h1>
            <EnquiryStatusBadge status={enquiry.status} />
            <Badge tone={enquiry.type === "BULK" ? "primary" : "neutral"} appearance="outline">
              {enquiry.type === "BULK" ? "Bulk Quotation Request" : "General Contact Enquiry"}
            </Badge>
          </div>
        </div>

        {/* Quick Contact Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink
            variant="outline"
            size="sm"
            href={`tel:${enquiry.mobile}`}
            aria-label={`Call customer at ${enquiry.mobile}`}
          >
            <Phone aria-hidden="true" className="size-4 mr-1.5 text-primary" />
            Call Customer
          </ButtonLink>

          <ButtonLink
            variant="outline"
            size="sm"
            href={`https://wa.me/91${cleanPhoneDigits}?text=${encodeURIComponent(
              `Hello ${enquiry.customerName}, regarding your enquiry ${enquiry.reference} with Sagar Traders:`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Chat with customer on WhatsApp at ${enquiry.mobile}`}
          >
            <MessageSquare aria-hidden="true" className="size-4 mr-1.5 text-success" />
            WhatsApp
            <ExternalLink aria-hidden="true" className="size-3.5 ml-1 text-on-surface-variant" />
          </ButtonLink>
        </div>
      </div>

      {/* Grid: Customer Details & Status Workflow */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Customer & Location Information */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border p-4 sm:p-6">
            <CardTitle className="text-title-lg flex items-center gap-2">
              <User aria-hidden="true" className="size-5 text-primary" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardBody className="p-4 sm:p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-label-sm text-on-surface-variant">Customer Name</p>
                <p className="text-body-lg font-semibold text-on-surface mt-0.5">
                  {enquiry.customerName}
                </p>
              </div>

              <div>
                <p className="text-label-sm text-on-surface-variant">Contact Mobile</p>
                <p className="text-body-lg font-medium text-on-surface mt-0.5 flex items-center gap-1.5">
                  <a href={`tel:${enquiry.mobile}`} className="hover:text-primary hover:underline">
                    {enquiry.mobile}
                  </a>
                </p>
              </div>

              <div>
                <p className="text-label-sm text-on-surface-variant">Email Address</p>
                <p className="text-body-md text-on-surface mt-0.5">
                  {enquiry.email ? (
                    <a href={`mailto:${enquiry.email}`} className="text-primary hover:underline">
                      {enquiry.email}
                    </a>
                  ) : (
                    <span className="text-on-surface-variant italic">Not provided</span>
                  )}
                </p>
              </div>

              <div>
                <p className="text-label-sm text-on-surface-variant">Submission Date</p>
                <p className="text-body-md text-on-surface mt-0.5 flex items-center gap-1.5">
                  <Calendar aria-hidden="true" className="size-4 text-on-surface-variant" />
                  {new Date(enquiry.createdAt).toLocaleString("en-IN", {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>

            {enquiry.deliveryLocation && (
              <div className="border-t border-border pt-4">
                <p className="text-label-sm text-on-surface-variant flex items-center gap-1.5">
                  <MapPin aria-hidden="true" className="size-4 text-primary" />
                  Delivery Location / Site Address
                </p>
                <p className="text-body-md font-medium text-on-surface mt-1 bg-surface-muted p-3 rounded border border-border">
                  {enquiry.deliveryLocation}
                </p>
              </div>
            )}

            {enquiry.message && (
              <div className="border-t border-border pt-4">
                <p className="text-label-sm text-on-surface-variant flex items-center gap-1.5">
                  <MessageSquare aria-hidden="true" className="size-4 text-primary" />
                  Customer Message / Notes
                </p>
                <p className="text-body-md text-on-surface mt-1 bg-surface-muted p-3 rounded border border-border whitespace-pre-line">
                  {enquiry.message}
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Status Workflow & Notification Outbox */}
        <div className="space-y-6">
          {/* Status Mutation Card */}
          <Card>
            <CardHeader className="border-b border-border p-4 sm:p-6">
              <CardTitle className="text-title-lg flex items-center gap-2">
                <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
                Workflow Status
              </CardTitle>
            </CardHeader>
            <CardBody className="p-4 sm:p-6 space-y-4">
              {statusNotification && (
                <Notification tone={statusNotification.tone}>
                  {statusNotification.message}
                </Notification>
              )}

              <form onSubmit={handleStatusSubmit} className="space-y-4">
                <Field
                  label="Update Enquiry Status"
                  helper="Advance through the quotation and order lifecycle"
                >
                  {(p) => (
                    <Select
                      {...p}
                      value={status}
                      onChange={(e) => setStatus(e.target.value as EnquiryStatus)}
                      disabled={isUpdatingStatus}
                    >
                      {allowedNextStatuses.map((s) => (
                        <option key={s} value={s}>
                          {s === "QUOTATION_SENT" ? "Quotation Sent" : s}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={isUpdatingStatus || status === enquiry.status}
                >
                  {isUpdatingStatus ? (
                    <>
                      <Spinner className="mr-2" />
                      Updating Status...
                    </>
                  ) : (
                    "Save Status Change"
                  )}
                </Button>
              </form>

              <div className="text-body-xs text-on-surface-variant border-t border-border pt-3">
                <p className="font-semibold text-on-surface mb-1">Standard Lifecycle:</p>
                <p>
                  NEW → CONTACTED → QUOTATION_SENT → CONFIRMED → COMPLETED (or CANCELLED at any
                  stage).
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Email Outbox Status Card */}
          <Card>
            <CardHeader className="border-b border-border p-4 sm:p-6">
              <CardTitle className="text-title-md flex items-center gap-2">
                <Mail aria-hidden="true" className="size-4 text-primary" />
                Email Delivery Status
              </CardTitle>
            </CardHeader>
            <CardBody className="p-4 sm:p-6 space-y-3">
              {outboxNotification && (
                <Notification tone={outboxNotification.tone}>
                  {outboxNotification.message}
                </Notification>
              )}

              {enquiry.outbox ? (
                <div className="space-y-2 text-body-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Outbox State:</span>
                    <Badge
                      tone={
                        enquiry.outbox.status === "SENT"
                          ? "success"
                          : enquiry.outbox.status === "FAILED"
                            ? "error"
                            : "warning"
                      }
                    >
                      {enquiry.outbox.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-on-surface-variant">Delivery Attempts:</span>
                    <span className="font-medium text-on-surface">
                      {enquiry.outbox.attemptCount} / {enquiry.outbox.maxAttempts}
                    </span>
                  </div>

                  {enquiry.outbox.sentAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant">Delivered At:</span>
                      <span className="text-on-surface">
                        {new Date(enquiry.outbox.sentAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}

                  {enquiry.outbox.lastError && (
                    <div className="rounded bg-surface-muted p-2.5 text-body-xs text-on-surface-variant border border-border">
                      <span className="font-semibold text-on-surface">Last Error: </span>
                      {enquiry.outbox.lastError}
                    </div>
                  )}

                  {enquiry.outbox.status === "FAILED" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={handleOutboxRetry}
                      disabled={isRetryingOutbox}
                    >
                      <RefreshCw aria-hidden="true" className="size-3.5 mr-1.5" />
                      {isRetryingOutbox ? "Retrying..." : "Retry Email Notification"}
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-body-sm text-on-surface-variant italic">
                  No automated notification outbox record associated with this enquiry.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Requested Items (Snapshots from Submission Time) */}
      {enquiry.items.length > 0 && (
        <Card>
          <CardHeader className="border-b border-border p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-title-lg flex items-center gap-2">
              <Package aria-hidden="true" className="size-5 text-primary" />
              Requested Building Materials ({enquiry.items.length})
            </CardTitle>
            <span className="text-body-xs text-on-surface-variant">
              Frozen snapshot captured at submission time.
            </span>
          </CardHeader>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <Tr>
                    <Th className="w-12">#</Th>
                    <Th>Material Name</Th>
                    <Th>Brand</Th>
                    <Th>SKU</Th>
                    <Th className="text-right">Quantity</Th>
                    <Th className="text-right">Rate at Submission</Th>
                    <Th className="text-right">Indicative Total</Th>
                    <Th>Stock Status</Th>
                  </Tr>
                </THead>
                <TBody>
                  {enquiry.items.map((item) => {
                    const lineTotal =
                      item.listedPrice !== null && item.listedPrice > 0
                        ? item.listedPrice * item.quantity
                        : null;

                    return (
                      <Tr key={item.id}>
                        <Td className="text-body-xs text-on-surface-variant font-mono">
                          {item.position}
                        </Td>
                        <Td className="font-semibold text-on-surface">{item.productName}</Td>
                        <Td className="text-body-sm text-on-surface-variant">
                          {item.brandName || "—"}
                        </Td>
                        <Td className="font-mono text-body-xs text-on-surface-variant">
                          {item.sku || "—"}
                        </Td>
                        <Td className="text-right font-medium text-on-surface">
                          {item.quantity} {item.unitLabel}
                        </Td>
                        <Td className="text-right text-body-sm text-on-surface-variant">
                          {item.listedPrice !== null
                            ? formatPrice(item.listedPrice)
                            : "Rate on request"}
                        </Td>
                        <Td className="text-right font-semibold text-on-surface">
                          {lineTotal !== null ? formatPrice(lineTotal) : "—"}
                        </Td>
                        <Td>
                          <StockBadge status={item.stockStatus} />
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>

            {indicativeTotal !== null && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-border p-4 sm:p-6 bg-surface-muted/50">
                <p className="text-body-xs text-on-surface-variant italic">
                  * Sum based on indicative rates at submission time. Final quotation may vary based
                  on transport and taxes.
                </p>
                <div className="mt-2 sm:mt-0 text-right">
                  <span className="text-body-sm text-on-surface-variant mr-2">
                    Indicative Total:
                  </span>
                  <span className="text-title-lg font-bold text-primary">
                    {formatPrice(indicativeTotal)}
                  </span>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Internal Staff Notes (Admin Only) */}
      <Card>
        <CardHeader className="border-b border-border p-4 sm:p-6">
          <CardTitle className="text-title-lg flex items-center gap-2">
            <MessageSquare aria-hidden="true" className="size-5 text-primary" />
            Internal Staff Notes ({notes.length})
          </CardTitle>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Private administrative notes visible only to logged-in team members. Customers cannot
            see these notes.
          </p>
        </CardHeader>
        <CardBody className="p-4 sm:p-6 space-y-6">
          {noteNotification && (
            <Notification tone={noteNotification.tone}>{noteNotification.message}</Notification>
          )}

          {/* Add Note Form */}
          <form onSubmit={handleNoteSubmit} className="space-y-3">
            <Field
              label="Add New Staff Note"
              helper={`Max 2000 characters (${2000 - noteBody.length} remaining)`}
            >
              {(p) => (
                <Textarea
                  {...p}
                  rows={3}
                  placeholder="Record customer follow-up call details, quotation discussions, freight rate agreements..."
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  maxLength={2000}
                  disabled={isAddingNote}
                />
              )}
            </Field>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isAddingNote || !noteBody.trim()}
              >
                {isAddingNote ? (
                  <>
                    <Spinner className="mr-2" />
                    Saving Note...
                  </>
                ) : (
                  <>
                    <Send aria-hidden="true" className="size-3.5 mr-1.5" />
                    Add Note
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Notes History */}
          <div className="border-t border-border pt-4 space-y-4">
            {notes.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant italic py-2 text-center">
                No internal staff notes recorded for this enquiry yet.
              </p>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border border-border bg-surface-muted/30 p-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-body-xs">
                    <span className="font-semibold text-primary">
                      {note.authorName || note.authorEmail || "Administrator"}
                    </span>
                    <span className="text-on-surface-variant flex items-center gap-1">
                      <Clock aria-hidden="true" className="size-3" />
                      {new Date(note.createdAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <p className="text-body-md text-on-surface whitespace-pre-line">{note.body}</p>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
