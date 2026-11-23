"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form-controls";
import { QuantityInput } from "@/components/common/quantity-input";
import { productEnquirySubject } from "@/lib/mailto";
import { productEnquiryMessage } from "@/lib/whatsapp";
import { AddToEnquiryButton } from "./add-to-enquiry-button";
import { RequestCallbackButton } from "./callback-modal";
import { EmailButton, WhatsAppButton } from "./contact-actions";

/**
 * Enquiry panel on the product page. The WhatsApp and email links only open a prepared message
 * (customer presses Send) and create NO database record; "Add to enquiry list" feeds the bulk enquiry.
 */
export function ProductEnquiryPanel({
  productId,
  productName,
  brandName,
  sku,
  unit,
  whatsappNumber,
  businessEmail = null,
}: {
  productId: string;
  productName: string;
  brandName: string | null;
  sku: string | null;
  unit: string;
  whatsappNumber: string | null;
  businessEmail?: string | null;
}) {
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState("");
  return (
    <Card>
      <CardBody className="space-y-gutter-md">
        <h2 className="text-title-lg">Request a quotation</h2>
        <div>
          <p className="mb-gutter-xs text-label-lg" id="qty-label">
            Quantity
          </p>
          <div className="flex items-center gap-gutter-sm">
            <QuantityInput value={quantity} onChange={setQuantity} label={`Quantity in ${unit}`} />
            <span className="text-body-md text-on-surface-variant">{unit}</span>
          </div>
        </div>
        <Field
          label="Delivery location (optional)"
          helper="Town or site landmark, used only to prepare your message."
        >
          {(p) => (
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={300}
              autoComplete="off"
              {...p}
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-gutter-sm">
          <WhatsAppButton
            hideIfUnavailable
            number={whatsappNumber}
            size="lg"
            message={productEnquiryMessage({
              productName,
              brandName,
              sku,
              quantity,
              unitLabel: unit,
              deliveryLocation: location,
            })}
          >
            WhatsApp enquiry
          </WhatsAppButton>
          <EmailButton
            hideIfUnavailable
            email={businessEmail}
            size="lg"
            subject={productEnquirySubject(productName)}
            message={productEnquiryMessage({
              productName,
              brandName,
              sku,
              quantity,
              unitLabel: unit,
              deliveryLocation: location,
            })}
          >
            Email enquiry
          </EmailButton>
          <AddToEnquiryButton
            productId={productId}
            productName={productName}
            quantity={quantity}
            size="lg"
          />
          <RequestCallbackButton
            size="lg"
            variant="outline"
            defaultReason={`Enquiry about ${productName} (${quantity} ${unit})`}
          />
        </div>
        <p className="text-body-sm text-on-surface-variant">
          No online checkout or payment. The business confirms the final rate with you.
        </p>
      </CardBody>
    </Card>
  );
}
