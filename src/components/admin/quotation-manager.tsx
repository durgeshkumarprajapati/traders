"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Download,
  FilePlus2,
  Link2Off,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { AlertModal, Modal } from "@/components/ui/modal";
import { Notification } from "@/components/ui/notification";
import type { AdminEnquiryDetail } from "@/features/admin/types";
import { UNIT_CODES, UNIT_LABELS, type UnitCode } from "@/features/products/units";
import {
  createQuotationDraftAction,
  issueQuotationAction,
  revokeQuotationLinkAction,
  rotateQuotationLinkAction,
} from "@/features/quotations/actions";
import { createOrderFromQuotationAction } from "@/features/orders/actions";
import { calculateQuotationTotals, formatRupees } from "@/features/quotations/calculations";
import type { QuotationRecord, QuotationStatus } from "@/features/quotations/types";
import { buildMailtoUrl } from "@/lib/mailto";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type Line = {
  productId: string | null;
  sku: string | null;
  productName: string;
  brandName: string | null;
  unitCode: UnitCode;
  unitLabel: string;
  quantity: string;
  unitPrice: string;
};

const STATUS_TONE: Record<QuotationStatus, "neutral" | "success" | "warning" | "error" | "info"> = {
  DRAFT: "neutral",
  ISSUED: "success",
  REVISED: "warning",
  EXPIRED: "error",
  ACCEPTED: "success",
  REJECTED: "error",
  CHANGE_REQUESTED: "warning",
};

const num = (s: string) => (s.trim() === "" ? 0 : Number(s));
const blankLine = (): Line => ({
  productId: null,
  sku: null,
  productName: "",
  brandName: null,
  unitCode: "BAG",
  unitLabel: UNIT_LABELS.BAG,
  quantity: "1",
  unitPrice: "",
});

function linesFromQuotation(q: QuotationRecord): Line[] {
  return q.items.map((i) => ({
    productId: i.productId ?? null,
    sku: i.sku ?? null,
    productName: i.productName,
    brandName: i.brandName ?? null,
    unitCode: i.unitCode,
    unitLabel: i.unitLabel,
    quantity: String(i.quantity),
    unitPrice: String(i.unitPrice),
  }));
}

function linesFromEnquiry(e: AdminEnquiryDetail): Line[] {
  if (e.items.length === 0) return [blankLine()];
  return e.items.map((i) => ({
    productId: i.productId,
    sku: i.sku,
    productName: i.productName,
    brandName: i.brandName,
    unitCode: (i.unitCode as UnitCode) || "BAG",
    unitLabel: i.unitLabel,
    quantity: String(i.quantity),
    // The enquiry snapshot's listed price is only a starting suggestion; the admin must confirm every rate.
    unitPrice: i.listedPrice ? String(i.listedPrice) : "",
  }));
}

/**
 * Admin quotation workflow inside the enquiry page: draft → preview PDF → issue → share, revise (new immutable version),
 * rotate / revoke the customer link. Totals shown here are a PREVIEW; the database recomputes them. The customer link is
 * displayed once when created (only its hash is stored), so it is kept in component state until dismissed.
 */
export function QuotationManager({
  enquiry,
  quotations = [],
}: {
  enquiry: AdminEnquiryDetail;
  quotations?: QuotationRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [basedOn, setBasedOn] = useState<QuotationRecord | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [terms, setTerms] = useState("");
  const [validDays, setValidDays] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );
  const [confirmIssue, setConfirmIssue] = useState<QuotationRecord | null>(null);
  const [shown, setShown] = useState<{ reference: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function openForm(from: QuotationRecord | null) {
    setBasedOn(from);
    setLines(from ? linesFromQuotation(from) : linesFromEnquiry(enquiry));
    setDiscount(from && from.discountAmount ? String(from.discountAmount) : "");
    setTax(from && from.taxAmount ? String(from.taxAmount) : "");
    setTerms(from?.termsAndConditions ?? "");
    setValidDays("");
    setFormError(null);
    setOpen(true);
  }

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const preview = calculateQuotationTotals(
    lines.map((l) => ({ quantity: num(l.quantity), unitPrice: num(l.unitPrice) })),
    num(discount),
    num(tax),
  );

  function submitDraft(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    startTransition(async () => {
      const res = await createQuotationDraftAction({
        enquiryId: enquiry.id,
        items: lines.map((l) => ({
          productId: l.productId,
          sku: l.sku,
          productName: l.productName,
          brandName: l.brandName,
          unitCode: l.unitCode,
          unitLabel: l.unitLabel,
          quantity: num(l.quantity),
          unitPrice: num(l.unitPrice),
        })),
        discountAmount: num(discount),
        taxAmount: num(tax),
        termsAndConditions: terms.trim() || null,
        validDays: validDays.trim() === "" ? 0 : Number(validDays),
      });
      if (!res.ok) {
        setFormError(res.message);
        return;
      }
      setOpen(false);
      setFeedback({
        tone: "success",
        text: `Draft ${res.data.reference} (version ${res.data.version}) saved. Preview the PDF, then issue it to the customer.`,
      });
      router.refresh();
    });
  }

  function issue(q: QuotationRecord) {
    setConfirmIssue(null);
    startTransition(async () => {
      const res = await issueQuotationAction(q.id, enquiry.id);
      if (!res.ok) return setFeedback({ tone: "error", text: res.message });
      setShown({
        reference: res.data.reference,
        url: `${window.location.origin}${res.data.trackingUrl}`,
      });
      setFeedback({
        tone: "success",
        text: `Quotation ${res.data.reference} issued.${res.data.enquiryStatusChanged ? " The enquiry moved to Quotation Sent." : ""} Copy the customer link below now — it is shown only once.`,
      });
      router.refresh();
    });
  }

  function rotate(q: QuotationRecord) {
    startTransition(async () => {
      const res = await rotateQuotationLinkAction(q.id, enquiry.id);
      if (!res.ok) return setFeedback({ tone: "error", text: res.message });
      setShown({ reference: q.reference, url: `${window.location.origin}${res.data.trackingUrl}` });
      setFeedback({
        tone: "success",
        text: "New link created. The previous link no longer works.",
      });
      router.refresh();
    });
  }

  function revoke(q: QuotationRecord) {
    startTransition(async () => {
      const res = await revokeQuotationLinkAction(q.id, enquiry.id);
      if (!res.ok) return setFeedback({ tone: "error", text: res.message });
      setShown(null);
      setFeedback({
        tone: "success",
        text: `Link for ${q.reference} revoked. The customer can no longer open it.`,
      });
      router.refresh();
    });
  }

  const customerMessage = shown
    ? `Hello ${enquiry.customerName}, your quotation ${shown.reference} from Sagar Traders is ready: ${shown.url}`
    : "";
  const waUrl = shown
    ? buildWhatsAppUrl(`91${enquiry.mobile.replace(/\D/g, "").slice(-10)}`, customerMessage)
    : null;
  const mailUrl = shown
    ? buildMailtoUrl(enquiry.email, `Quotation ${shown.reference}`, customerMessage)
    : null;

  return (
    <Card className="border border-border">
      <CardHeader className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <CardTitle className="flex items-center gap-2 text-title-lg">
          <Send aria-hidden className="size-5 text-primary" />
          Quotations ({quotations.length})
        </CardTitle>
        <Button type="button" size="sm" onClick={() => openForm(null)} disabled={isPending}>
          <FilePlus2 aria-hidden className="mr-1.5 size-4" />
          New quotation
        </Button>
      </CardHeader>
      <CardBody className="space-y-gutter-md p-4 sm:p-6">
        {feedback && <Notification tone={feedback.tone}>{feedback.text}</Notification>}

        {shown && (
          <div className="space-y-2 rounded border border-secondary/50 bg-secondary/10 p-gutter-md">
            <p className="text-title-md font-semibold">
              Customer link for {shown.reference} — shown once
            </p>
            <p className="break-all rounded border border-border bg-surface p-2 font-mono text-body-sm">
              {shown.url}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  navigator.clipboard.writeText(shown.url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                  })
                }
              >
                <Copy aria-hidden className="mr-1.5 size-4" />
                {copied ? "Copied" : "Copy link"}
              </Button>
              {waUrl && (
                <ButtonAnchor
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  variant="outline"
                >
                  <MessageCircle aria-hidden className="mr-1.5 size-4" />
                  Send via WhatsApp
                </ButtonAnchor>
              )}
              {mailUrl && (
                <ButtonAnchor href={mailUrl} size="sm" variant="outline">
                  <Mail aria-hidden className="mr-1.5 size-4" />
                  Email customer (opens your email app)
                </ButtonAnchor>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={() => setShown(null)}>
                Dismiss
              </Button>
            </div>
            <p className="text-body-sm text-on-surface-variant">
              WhatsApp and email only open your own apps with this message prepared — nothing is
              sent by the website, and delivery is not tracked. Automatic emailing of quotations is
              not available yet.
            </p>
          </div>
        )}

        {quotations.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">
            No quotation has been created for this enquiry yet.
          </p>
        ) : (
          <ul className="space-y-gutter-sm">
            {quotations.map((q) => (
              <li key={q.id} className="space-y-2 rounded border border-border p-gutter-md">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-title-md font-bold text-primary">
                    {q.reference}
                  </span>
                  <Badge tone="neutral" appearance="outline">
                    Version {q.version}
                  </Badge>
                  <Badge tone={STATUS_TONE[q.status]}>
                    {q.status === "REVISED" ? "Superseded" : q.status}
                  </Badge>
                  {q.status !== "DRAFT" && (
                    <Badge
                      tone={
                        q.linkState === "ACTIVE"
                          ? "success"
                          : q.linkState === "NONE"
                            ? "neutral"
                            : "warning"
                      }
                      appearance="outline"
                    >
                      Link: {q.linkState.toLowerCase()}
                    </Badge>
                  )}
                </div>
                <p className="text-body-md">
                  Total <strong>{formatRupees(q.totalAmount)}</strong>
                  {q.validUntil && (
                    <span className="text-on-surface-variant">
                      {" "}
                      · valid until{" "}
                      {new Date(q.validUntil).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </span>
                  )}
                  {q.status !== "DRAFT" && (
                    <span className="text-on-surface-variant">
                      {" "}
                      · customer views: {q.viewCount}
                      {q.lastViewedAt &&
                        ` (last ${new Date(q.lastViewedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })})`}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <ButtonAnchor
                    href={`/api/admin/quotations/${q.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    variant="outline"
                  >
                    <Download aria-hidden className="mr-1.5 size-4" />
                    {q.status === "DRAFT" ? "Preview PDF" : "PDF"}
                  </ButtonAnchor>
                  {q.status === "DRAFT" && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setConfirmIssue(q)}
                      disabled={isPending}
                    >
                      <Send aria-hidden className="mr-1.5 size-4" />
                      Issue to customer
                    </Button>
                  )}
                  {q.status === "ACCEPTED" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await createOrderFromQuotationAction({
                            quotationId: q.id,
                          });
                          if (res.ok) {
                            setFeedback({
                              tone: "success",
                              text: `Order ${res.data.reference} created. Customer tracking path: ${res.data.trackingPath}`,
                            });
                            router.refresh();
                          } else {
                            setFeedback({ tone: "error", text: res.message });
                          }
                        })
                      }
                    >
                      Create Order
                    </Button>
                  )}
                  {q.status === "ISSUED" && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => rotate(q)}
                        disabled={isPending}
                      >
                        <RefreshCw aria-hidden className="mr-1.5 size-4" />
                        New link
                      </Button>
                      {q.linkState === "ACTIVE" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => revoke(q)}
                          disabled={isPending}
                        >
                          <Link2Off aria-hidden className="mr-1.5 size-4" />
                          Revoke link
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => openForm(q)}
                    disabled={isPending}
                  >
                    <FilePlus2 aria-hidden className="mr-1.5 size-4" />
                    {q.status === "DRAFT" ? "Copy as new draft" : "Revise (new version)"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <AlertModal
        open={confirmIssue !== null}
        onClose={() => setConfirmIssue(null)}
        title="Issue this quotation?"
        description="An issued quotation can never be edited — only revised as a new version. The enquiry moves to Quotation Sent if it is still New or Contacted. You will get a one-time customer link."
        confirmLabel="Issue quotation"
        destructive={false}
        pending={isPending}
        onConfirm={() => confirmIssue && issue(confirmIssue)}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          basedOn
            ? `New version based on ${basedOn.reference} v${basedOn.version}`
            : "New quotation"
        }
        description="Rates are yours to set. Totals below are a preview; the system recalculates them when saving."
      >
        <form onSubmit={submitDraft} className="space-y-gutter-md" noValidate>
          {formError && <Notification tone="error">{formError}</Notification>}
          {lines.map((l, i) => (
            <fieldset key={i} className="space-y-2 rounded border border-border p-gutter-sm">
              <legend className="px-1 text-label-md text-on-surface-variant">Line {i + 1}</legend>
              <Field label="Description" required>
                {(p) => (
                  <Input
                    {...p}
                    value={l.productName}
                    readOnly={Boolean(l.productId)}
                    onChange={(e) => setLine(i, { productName: e.target.value })}
                    maxLength={200}
                  />
                )}
              </Field>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Field label="Quantity" required>
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={l.quantity}
                      onChange={(e) => setLine(i, { quantity: e.target.value })}
                    />
                  )}
                </Field>
                <Field label="Unit" required>
                  {(p) => (
                    <Select
                      {...p}
                      value={l.unitCode}
                      disabled={Boolean(l.productId)}
                      onChange={(e) => {
                        const code = e.target.value as UnitCode;
                        setLine(i, { unitCode: code, unitLabel: UNIT_LABELS[code] });
                      }}
                    >
                      {UNIT_CODES.map((c) => (
                        <option key={c} value={c}>
                          {UNIT_LABELS[c]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Rate (₹ per unit)" required>
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={l.unitPrice}
                      onChange={(e) => setLine(i, { unitPrice: e.target.value })}
                    />
                  )}
                </Field>
              </div>
              {lines.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 aria-hidden className="mr-1.5 size-4" />
                  Remove line {i + 1}
                </Button>
              )}
            </fieldset>
          ))}
          {lines.length < 100 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setLines((prev) => [...prev, blankLine()])}
            >
              Add a manual line
            </Button>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="Discount (₹)">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Tax amount (₹)"
              helper="Enter only if tax applies. Not calculated automatically."
            >
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                />
              )}
            </Field>
            <Field label="Valid for (days)" required helper="1–90">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="90"
                  step="1"
                  value={validDays}
                  onChange={(e) => setValidDays(e.target.value)}
                />
              )}
            </Field>
          </div>
          <Field
            label="Terms & conditions (optional)"
            helper="Printed exactly as typed. Nothing is added automatically."
          >
            {(p) => (
              <Textarea
                {...p}
                rows={4}
                maxLength={3000}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
            )}
          </Field>
          <dl className="space-y-0.5 rounded bg-surface-muted p-gutter-sm text-body-md">
            <div className="flex justify-between">
              <dt>Subtotal (preview)</dt>
              <dd>{formatRupees(preview.subtotal)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Total (preview)</dt>
              <dd>{formatRupees(preview.totalAmount)}</dd>
            </div>
          </dl>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save draft"}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
