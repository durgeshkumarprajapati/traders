"use client";

import { useState, useTransition } from "react";
import { Download, FileText, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonAnchor } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import { Notification } from "@/components/ui/notification";
import type { AdminEnquiryDetail } from "@/features/admin/types";
import { createQuotationDraftAction, issueQuotationAction } from "@/features/quotations/actions";
import { calculateLineTotal, calculateQuotationTotals } from "@/features/quotations/calculations";
import type { QuotationItemInput, QuotationRecord } from "@/features/quotations/types";

interface QuotationManagerProps {
  enquiry: AdminEnquiryDetail;
  existingQuotations?: QuotationRecord[];
}

export function QuotationManager({ enquiry, existingQuotations = [] }: QuotationManagerProps) {
  const [quotations] = useState<QuotationRecord[]>(existingQuotations);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [items, setItems] = useState<QuotationItemInput[]>(() => {
    if (enquiry.items.length > 0) {
      return enquiry.items.map((it) => ({
        productId: it.productId,
        sku: it.sku,
        productName: it.productName,
        brandName: it.brandName,
        unitCode: (it.unitCode as QuotationItemInput["unitCode"]) || "BAG",
        unitLabel: it.unitLabel,
        quantity: it.quantity,
        unitPrice: it.listedPrice ?? 0,
      }));
    }
    return [
      {
        productName: "Building Material Supply",
        unitCode: "BAG",
        unitLabel: "Bag",
        quantity: 1,
        unitPrice: 0,
      },
    ];
  });
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [terms, setTerms] = useState(
    "1. Rates valid for 7 days. 2. Site delivery charges as agreed. 3. Advance RTGS/NEFT payment.",
  );
  const [validDays, setValidDays] = useState(7);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );
  const [issuedResult, setIssuedResult] = useState<{
    reference: string;
    trackingUrl: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleItemPriceChange(index: number, price: number) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], unitPrice: Math.max(0, price) };
      return next;
    });
  }

  function handleItemQtyChange(index: number, qty: number) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: Math.max(0.001, qty) };
      return next;
    });
  }

  function handleCreateDraft(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await createQuotationDraftAction({
        enquiryId: enquiry.id,
        items,
        discountAmount,
        taxAmount,
        termsAndConditions: terms,
        validDays,
      });

      if (res.ok) {
        setFeedback({ tone: "success", text: `Draft quotation ${res.data.reference} created.` });
        setIsModalOpen(false);
        // Refresh quotations list
        window.location.reload();
      } else {
        setFeedback({ tone: "error", text: res.message || "Failed to create draft." });
      }
    });
  }

  function handleIssue(quotationId: string) {
    setFeedback(null);
    startTransition(async () => {
      const res = await issueQuotationAction(quotationId, enquiry.id);
      if (res.ok) {
        setIssuedResult({
          reference: res.data.reference,
          trackingUrl: `${window.location.origin}${res.data.trackingUrl}`,
        });
        setFeedback({
          tone: "success",
          text: `Quotation ${res.data.reference} successfully issued to customer!`,
        });
        window.location.reload();
      } else {
        setFeedback({ tone: "error", text: res.message || "Failed to issue quotation." });
      }
    });
  }

  function handleCopyIssuedUrl() {
    if (!issuedResult) return;
    navigator.clipboard.writeText(issuedResult.trackingUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    });
  }

  const totals = calculateQuotationTotals(
    items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice })),
    discountAmount,
    taxAmount,
  );

  return (
    <Card className="border border-border">
      <CardHeader className="border-b border-border p-4 sm:p-6 flex flex-row items-center justify-between">
        <CardTitle className="text-title-lg flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          Digital Quotations
        </CardTitle>
        <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="size-4 mr-1" />
          Create Quotation
        </Button>
      </CardHeader>
      <CardBody className="p-4 sm:p-6 space-y-4">
        {feedback && <Notification tone={feedback.tone}>{feedback.text}</Notification>}

        {issuedResult && (
          <div className="rounded-lg border border-success/30 bg-success/5 p-4 space-y-2">
            <p className="font-bold text-success text-body-md">
              Quotation Issued: {issuedResult.reference}
            </p>
            <p className="text-body-sm text-on-surface">
              Customer can access and download their formal quotation directly:
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="font-mono text-body-sm bg-surface p-2 rounded border border-border break-all">
                {issuedResult.trackingUrl}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={handleCopyIssuedUrl}>
                {copiedLink ? "Copied!" : "Copy Link"}
              </Button>
            </div>
          </div>
        )}

        {quotations.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant italic py-2">
            No quotations generated yet for this enquiry. Click &ldquo;Create Quotation&rdquo; to
            prepare an itemized quote.
          </p>
        ) : (
          <div className="space-y-3">
            {quotations.map((quo) => (
              <div
                key={quo.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface-muted"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary">{quo.reference}</span>
                    <Badge tone="neutral" appearance="outline">
                      v{quo.version}
                    </Badge>
                    <Badge
                      tone={
                        quo.status === "ISSUED"
                          ? "success"
                          : quo.status === "DRAFT"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {quo.status}
                    </Badge>
                  </div>
                  <p className="text-body-sm text-on-surface mt-1">
                    Total:{" "}
                    <strong>
                      ₹{quo.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </strong>
                    <span className="text-on-surface-variant ml-2">({quo.items.length} items)</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {quo.status === "DRAFT" && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => handleIssue(quo.id)}
                      disabled={isPending}
                    >
                      <Send className="size-3.5 mr-1" />
                      Issue to Customer
                    </Button>
                  )}
                  {quo.status === "ISSUED" && quo.trackingTokenHash && (
                    <ButtonAnchor
                      href={`/api/quotation/${quo.reference}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outline"
                      size="sm"
                    >
                      <Download className="size-3.5 mr-1" />
                      PDF
                    </ButtonAnchor>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal to Create Quotation Draft */}
        {isModalOpen && (
          <Modal
            open={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Create Formal Quotation"
            description={`Prepare an itemized quotation for ${enquiry.customerName} (${enquiry.reference}).`}
          >
            <form
              onSubmit={handleCreateDraft}
              className="p-4 space-y-4 max-h-[75vh] overflow-y-auto"
            >
              <h3 className="text-body-md font-bold text-on-surface">Line Items & Rates</h3>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded border border-border bg-surface-muted space-y-2"
                  >
                    <div className="flex justify-between items-center text-body-sm">
                      <span className="font-semibold text-primary">
                        {idx + 1}. {item.productName}
                      </span>
                      <span className="text-body-sm text-on-surface-variant">
                        {item.brandName || "Standard"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div>
                        <label className="block text-body-sm font-medium text-on-surface-variant mb-0.5">
                          Qty ({item.unitLabel})
                        </label>
                        <Input
                          type="number"
                          step="any"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemQtyChange(idx, parseFloat(e.target.value) || 0)
                          }
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-body-sm font-medium text-on-surface-variant mb-0.5">
                          Unit Rate (₹)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemPriceChange(idx, parseFloat(e.target.value) || 0)
                          }
                          required
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-body-sm font-medium text-on-surface-variant mb-0.5">
                          Line Total
                        </label>
                        <div className="p-2 font-mono font-bold text-on-surface bg-surface rounded border border-border text-body-sm">
                          ₹
                          {calculateLineTotal(item.quantity, item.unitPrice).toLocaleString(
                            "en-IN",
                            { minimumFractionDigits: 2 },
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-border">
                <Field label="Discount Amount (₹)">
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    />
                  )}
                </Field>

                <Field label="Tax / GST Amount (₹)">
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      step="0.01"
                      min="0"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                    />
                  )}
                </Field>
              </div>

              <div className="p-3 rounded bg-primary/5 border border-primary/20 space-y-1 text-body-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono">
                    ₹{totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-primary text-body-md border-t border-primary/20 pt-1">
                  <span>Grand Total:</span>
                  <span className="font-mono">
                    ₹{totals.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <Field label="Quotation Validity (Days)">
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    min="1"
                    max="90"
                    value={validDays}
                    onChange={(e) => setValidDays(parseInt(e.target.value, 10) || 7)}
                  />
                )}
              </Field>

              <Field label="Terms and Conditions">
                {(p) => (
                  <Textarea
                    {...p}
                    rows={2}
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                  />
                )}
              </Field>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? "Saving..." : "Save Draft Quotation"}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </CardBody>
    </Card>
  );
}
