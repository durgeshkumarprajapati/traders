"use client";

import { useState } from "react";
import { Download, Share2, Copy, Check, ArrowLeft } from "lucide-react";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CustomerTrackedQuotation } from "@/features/quotations/types";
import { WhatsAppButton } from "./contact-actions";

interface QuotationViewProps {
  quotation: CustomerTrackedQuotation;
  token: string;
  whatsappNumber?: string;
  businessPhone?: string;
}

export function QuotationView({
  quotation,
  token,
  whatsappNumber,
  businessPhone,
}: QuotationViewProps) {
  const [copied, setCopied] = useState(false);

  function handleCopyLink() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  const issueDateFormatted = quotation.issuedAt
    ? new Date(quotation.issuedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const validUntilFormatted = quotation.validUntil
    ? new Date(quotation.validUntil).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const waShareMessage = `Hello, here is the formal quotation from Sagar Traders:\nRef: ${quotation.reference} (v${quotation.version})\nTotal: ₹${quotation.totalAmount.toLocaleString("en-IN")}\nLink: ${typeof window !== "undefined" ? window.location.href : ""}`;

  return (
    <div className="space-y-gutter-lg pb-section-md">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-gutter-sm rounded-lg border border-border bg-surface p-gutter-md">
        <ButtonLink
          href={`/track-enquiry?ref=${encodeURIComponent(quotation.enquiryReference)}&token=${encodeURIComponent(token)}`}
          variant="outline"
          size="sm"
        >
          <ArrowLeft className="size-4 mr-1" />
          Track Enquiry Timeline
        </ButtonLink>

        <div className="flex flex-wrap items-center gap-2">
          <ButtonAnchor
            href={`/api/quotation/${token}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            variant="primary"
            size="sm"
          >
            <Download className="size-4 mr-1.5" />
            Download PDF
          </ButtonAnchor>

          <Button type="button" variant="outline" size="sm" onClick={handleCopyLink}>
            {copied ? (
              <>
                <Check className="size-4 mr-1.5 text-success" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-4 mr-1.5" />
                Copy Link
              </>
            )}
          </Button>

          {whatsappNumber && (
            <WhatsAppButton
              number={whatsappNumber}
              message={waShareMessage}
              size="sm"
              variant="outline"
            >
              <Share2 className="size-4 mr-1.5" />
              Share WhatsApp
            </WhatsAppButton>
          )}
        </div>
      </div>

      {/* Main Quotation Document Card */}
      <Card className="overflow-hidden border border-border shadow-xs">
        {/* Navy Header Banner */}
        <div className="border-b-4 border-secondary bg-primary p-6 text-on-primary">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-headline-md font-bold text-on-primary">SAGAR TRADERS</h1>
              <p className="text-body-sm text-secondary font-medium mt-0.5">
                Quality Building Materials & Direct Site Supplies
              </p>
              <p className="text-body-sm text-on-primary/80 mt-2">
                Ring Road No. 2, Industrial Area, Raipur, CG - 492001
              </p>
            </div>

            <div className="rounded bg-on-primary/10 p-3 sm:text-right">
              <span className="text-label-sm font-semibold uppercase text-secondary">
                Formal Commercial Quotation
              </span>
              <div className="text-title-lg font-mono font-bold text-on-primary mt-1">
                {quotation.reference}
              </div>
              <div className="flex items-center gap-2 mt-1 sm:justify-end">
                <Badge
                  tone="neutral"
                  appearance="outline"
                  className="border-on-primary/30 text-on-primary"
                >
                  Version {quotation.version}
                </Badge>
                <span className="text-body-sm text-on-primary/80">Date: {issueDateFormatted}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Client & Enquiry Information */}
        <div className="border-b border-border bg-surface-muted p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                Quotation Issued To
              </span>
              <p className="text-title-md font-bold text-on-surface mt-1">
                {quotation.customerName}
              </p>
              {quotation.deliveryLocation && (
                <p className="text-body-sm text-on-surface-variant mt-1">
                  Site Delivery: <strong>{quotation.deliveryLocation}</strong>
                </p>
              )}
            </div>

            <div className="sm:text-right">
              <span className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                Enquiry Information
              </span>
              <p className="text-body-sm text-on-surface mt-1">
                Enquiry Reference: <strong>{quotation.enquiryReference}</strong>
              </p>
              {validUntilFormatted && (
                <p className="text-body-sm text-warning font-semibold mt-1">
                  Valid Until: {validUntilFormatted}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="p-6">
          <h2 className="text-title-md font-bold text-primary mb-4">Itemized Supplies</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-border bg-surface-muted text-on-surface-variant">
                <tr>
                  <th className="py-2.5 px-3 w-10">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3">Brand</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Unit Rate</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quotation.items.map((item) => (
                  <tr key={item.position} className="hover:bg-surface-muted/40">
                    <td className="py-3 px-3 text-on-surface-variant">{item.position}</td>
                    <td className="py-3 px-3 font-medium text-on-surface">
                      {item.productName}
                      {item.notes && (
                        <p className="text-body-sm text-on-surface-variant mt-0.5">{item.notes}</p>
                      )}
                    </td>
                    <td className="py-3 px-3 text-on-surface-variant">{item.brandName || "—"}</td>
                    <td className="py-3 px-3 text-right font-medium text-on-surface">
                      {item.quantity} {item.unitLabel}
                    </td>
                    <td className="py-3 px-3 text-right text-on-surface font-mono">
                      ₹{item.unitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-on-surface font-mono">
                      ₹{item.lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Bank Information Grid */}
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Bank details for RTGS/NEFT */}
            <div className="rounded-lg border border-border bg-surface-muted p-4 space-y-2 text-body-sm">
              <p className="font-bold text-primary text-body-md">Payment / Bank Details</p>
              <div className="space-y-1 text-on-surface">
                <p>
                  <strong>Beneficiary:</strong> Sagar Traders
                </p>
                <p>
                  <strong>Bank:</strong> State Bank of India
                </p>
                <p>
                  <strong>A/C No:</strong> 31234567890
                </p>
                <p>
                  <strong>IFSC Code:</strong> SBIN0001234
                </p>
                <p>
                  <strong>Branch:</strong> Raipur Main Branch
                </p>
              </div>
            </div>

            {/* Financial Totals */}
            <div className="rounded-lg border border-border bg-surface p-4 space-y-2">
              <div className="flex justify-between text-body-sm text-on-surface">
                <span>Subtotal:</span>
                <span className="font-mono">
                  ₹{quotation.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              {quotation.discountAmount > 0 && (
                <div className="flex justify-between text-body-sm text-success">
                  <span>Discount:</span>
                  <span className="font-mono">
                    -₹
                    {quotation.discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {quotation.taxAmount > 0 && (
                <div className="flex justify-between text-body-sm text-on-surface">
                  <span>Taxes (GST):</span>
                  <span className="font-mono">
                    ₹{quotation.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between text-title-md font-bold text-primary">
                <span>Grand Total:</span>
                <span className="font-mono">
                  ₹{quotation.totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          {quotation.termsAndConditions && (
            <div className="mt-8 border-t border-border pt-4">
              <h3 className="text-body-sm font-bold text-on-surface uppercase tracking-wider mb-2">
                Terms & Conditions
              </h3>
              <p className="text-body-sm text-on-surface-variant whitespace-pre-line leading-relaxed">
                {quotation.termsAndConditions}
              </p>
            </div>
          )}

          {/* Computer Generated Disclaimer */}
          <div className="mt-8 border-t border-border pt-4 text-center text-body-sm text-on-surface-variant">
            This is an official computer-generated quotation from Sagar Traders. For orders or
            dispatched site delivery, please contact our dispatch team at{" "}
            {businessPhone || "+91 91234 56789"}.
          </div>
        </div>
      </Card>
    </div>
  );
}
