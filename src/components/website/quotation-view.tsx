"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Copy, Download, Phone, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonAnchor, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatRupees } from "@/features/quotations/calculations";
import type { CustomerTrackedQuotation } from "@/features/quotations/types";
import { WhatsAppButton } from "./contact-actions";

export interface QuotationBusiness {
  name: string;
  tagline?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  whatsappNumber?: string | null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Customer quotation. Every business fact (name, address, phone, GSTIN …) comes from Business Settings — nothing is
 * hard-coded, and there are no payment/bank instructions because none exist in the configured data. Terms are exactly what
 * the administrator entered for this quotation. Superseded and expired quotations are labelled, never presented as current.
 */
export function QuotationView({
  quotation,
  token,
  business,
}: {
  quotation: CustomerTrackedQuotation;
  token: string;
  business: QuotationBusiness;
}) {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  }

  const shareText = `Quotation ${quotation.reference} (version ${quotation.version}) from ${business.name}. Total ${formatRupees(quotation.totalAmount)}.`;
  const shareHref = () =>
    `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${typeof window !== "undefined" ? window.location.href : ""}`)}`;

  const banner = !quotation.isLatest
    ? "This is an earlier version. A newer version of this quotation has been issued — please use the latest version or contact us."
    : quotation.isExpired
      ? "This quotation has expired. Rates and availability must be re-confirmed — please contact us."
      : null;

  return (
    <div className="space-y-gutter-lg pb-section-md">
      <div className="flex flex-wrap items-center justify-between gap-gutter-sm rounded-lg border border-border bg-surface p-gutter-md">
        <ButtonLink href="/track-enquiry" variant="outline" size="sm">
          <ArrowLeft aria-hidden className="mr-1 size-4" />
          Track your enquiry
        </ButtonLink>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonAnchor href={`/api/quotation/${token}/pdf`} variant="primary" size="sm">
            <Download aria-hidden className="mr-1.5 size-4" />
            Download PDF
          </ButtonAnchor>
          <Button type="button" variant="outline" size="sm" onClick={copyLink}>
            {copied ? (
              <>
                <Check aria-hidden className="mr-1.5 size-4 text-success" />
                Copied
              </>
            ) : (
              <>
                <Copy aria-hidden className="mr-1.5 size-4" />
                Copy link
              </>
            )}
          </Button>
          <ButtonAnchor
            href={shareHref()}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            size="sm"
          >
            <Share2 aria-hidden className="mr-1.5 size-4" />
            Share on WhatsApp
            <span className="sr-only"> (opens WhatsApp; you choose who to send it to)</span>
          </ButtonAnchor>
        </div>
      </div>

      {banner && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-gutter-md text-body-md"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
          <p>
            <strong>{!quotation.isLatest ? "Superseded. " : "Expired. "}</strong>
            {banner}
          </p>
        </div>
      )}

      <Card className="overflow-hidden border border-border">
        <div className="border-b-4 border-secondary bg-primary p-6 text-on-primary">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-headline-md font-bold text-on-primary">{business.name}</h1>
              {business.tagline && (
                <p className="mt-0.5 text-body-sm font-medium text-secondary">{business.tagline}</p>
              )}
              <div className="mt-2 space-y-0.5 text-body-sm text-on-primary/85 [overflow-wrap:anywhere]">
                {business.address && <p className="whitespace-pre-line">{business.address}</p>}
                {(business.phone || business.email) && (
                  <p>
                    {[
                      business.phone && `Phone: ${business.phone}`,
                      business.email && `Email: ${business.email}`,
                    ]
                      .filter(Boolean)
                      .join("  ·  ")}
                  </p>
                )}
                {business.gstin && <p>GSTIN: {business.gstin}</p>}
              </div>
            </div>
            <div className="shrink-0 rounded border border-on-primary/30 p-3 text-body-sm">
              <p className="text-title-md font-bold">Quotation</p>
              <p>
                Ref: <strong>{quotation.reference}</strong>
              </p>
              <p>Version {quotation.version}</p>
              <p>Enquiry: {quotation.enquiryReference}</p>
              {quotation.issuedAt && <p>Date: {fmtDate(quotation.issuedAt)}</p>}
              {quotation.validUntil && (
                <p>
                  {quotation.isExpired ? "Expired" : "Valid until"}: {fmtDate(quotation.validUntil)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-gutter-lg p-gutter-lg">
          <div>
            <p className="text-label-md text-on-surface-variant">Quotation for</p>
            <p className="text-title-lg font-bold [overflow-wrap:anywhere]">
              {quotation.customerName}
            </p>
            {quotation.deliveryLocation && (
              <p className="text-body-md text-on-surface-variant [overflow-wrap:anywhere]">
                Delivery site: {quotation.deliveryLocation}
              </p>
            )}
          </div>

          <Table stacked>
            <caption className="sr-only">Quotation line items</caption>
            <THead>
              <Tr>
                <Th>#</Th>
                <Th>Item</Th>
                <Th>Brand</Th>
                <Th>Quantity</Th>
                <Th className="text-right">Rate</Th>
                <Th className="text-right">Amount</Th>
              </Tr>
            </THead>
            <TBody>
              {quotation.items.map((it) => (
                <Tr key={it.position}>
                  <Td label="#">{it.position}</Td>
                  <Td label="Item">
                    <span className="font-medium">{it.productName}</span>
                    {it.notes && (
                      <span className="block text-body-sm text-on-surface-variant">{it.notes}</span>
                    )}
                  </Td>
                  <Td label="Brand">{it.brandName ?? "—"}</Td>
                  <Td label="Quantity">
                    {Number(it.quantity.toFixed(3))} {it.unitLabel}
                  </Td>
                  <Td label="Rate" className="md:text-right">
                    {formatRupees(it.unitPrice)}
                  </Td>
                  <Td label="Amount" className="font-semibold md:text-right">
                    {formatRupees(it.lineTotal)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>

          <dl className="ml-auto w-full max-w-xs space-y-1 rounded border border-border p-gutter-md text-body-md">
            <div className="flex justify-between gap-4">
              <dt>Subtotal</dt>
              <dd>{formatRupees(quotation.subtotal)}</dd>
            </div>
            {quotation.discountAmount > 0 && (
              <div className="flex justify-between gap-4">
                <dt>Discount</dt>
                <dd>− {formatRupees(quotation.discountAmount)}</dd>
              </div>
            )}
            {quotation.taxAmount > 0 && (
              <div className="flex justify-between gap-4">
                <dt>Tax</dt>
                <dd>{formatRupees(quotation.taxAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t border-border pt-2 text-title-md font-bold text-primary">
              <dt>Total</dt>
              <dd>{formatRupees(quotation.totalAmount)}</dd>
            </div>
          </dl>

          {quotation.termsAndConditions && (
            <section aria-labelledby="terms-heading">
              <h2 id="terms-heading" className="text-title-md font-bold text-primary">
                Terms &amp; conditions
              </h2>
              <p className="mt-1 whitespace-pre-line text-body-md text-on-surface-variant [overflow-wrap:anywhere]">
                {quotation.termsAndConditions}
              </p>
            </section>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-gutter-sm p-gutter-md sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-md">
          <Badge tone="neutral" appearance="outline">
            Questions?
          </Badge>{" "}
          Contact us about this quotation.
        </p>
        <div className="flex flex-wrap gap-2">
          {business.phone && (
            <ButtonAnchor
              href={`tel:${business.phone.replace(/[^0-9+]/g, "")}`}
              variant="outline"
              size="sm"
            >
              <Phone aria-hidden className="mr-1.5 size-4" />
              Call {business.phone}
            </ButtonAnchor>
          )}
          <WhatsAppButton
            hideIfUnavailable
            number={business.whatsappNumber ?? null}
            message={`Hello, I have a question about quotation ${quotation.reference} (version ${quotation.version}).`}
            variant="outline"
            size="sm"
          >
            WhatsApp us
          </WhatsAppButton>
        </div>
      </Card>
    </div>
  );
}
