"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form-controls";
import { QuantityInput } from "@/components/common/quantity-input";
import { productEnquirySubject } from "@/lib/mailto";
import { productEnquiryMessage } from "@/lib/whatsapp";
import { AddToCompareButton } from "@/components/compare/add-to-compare-button";
import { AddToEnquiryButton } from "./add-to-enquiry-button";
import { RequestCallbackButton } from "./callback-modal";
import { EmailButton, WhatsAppButton } from "./contact-actions";

const ENQUIRY_TOPICS = [
  "Latest price",
  "Available quantity",
  "Available brands",
  "Packaging & specifications",
  "Bulk purchase rates",
  "Delivery availability",
] as const;

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
  businessPhone = null,
}: {
  productId: string;
  productName: string;
  brandName: string | null;
  sku: string | null;
  unit: string;
  whatsappNumber: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
}) {
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState("");
  const [topic, setTopic] = useState<(typeof ENQUIRY_TOPICS)[number]>("Latest price");

  const baseMessage = productEnquiryMessage({
    productName,
    brandName,
    sku,
    quantity,
    unitLabel: unit,
    deliveryLocation: location,
  });
  const preparedMessage = `${baseMessage} Enquiry about: ${topic}.`;
  return (
    <Card>
      <CardBody className="space-y-gutter-md">
        <h2 className="text-title-lg">Ask for latest price or availability</h2>
        <div>
          <p className="mb-gutter-xs text-label-md text-on-surface-variant">
            What would you like to ask?
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Enquiry topic">
            {ENQUIRY_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                className={`min-h-9 rounded-full border px-3 py-1 text-label-md transition-colors ${
                  topic === t
                    ? "border-primary bg-primary text-on-primary"
                    : "border-border bg-surface text-on-surface hover:bg-surface-muted"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
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
            message={preparedMessage}
          >
            WhatsApp enquiry
          </WhatsAppButton>
          <EmailButton
            hideIfUnavailable
            email={businessEmail}
            size="lg"
            subject={productEnquirySubject(productName)}
            message={preparedMessage}
          >
            Email enquiry
          </EmailButton>
          <AddToEnquiryButton
            productId={productId}
            productName={productName}
            quantity={quantity}
            size="lg"
          />
          <AddToCompareButton
            productId={productId}
            productName={productName}
            size="lg"
            variant="outline"
          />
          <RequestCallbackButton
            size="lg"
            variant="outline"
            defaultReason={`${topic}: ${productName} (${quantity} ${unit})`}
            contact={{ phone: businessPhone, whatsappNumber }}
          />
        </div>
        <p className="text-body-sm text-on-surface-variant">
          No online checkout or payment. The business confirms the final rate with you.
        </p>
      </CardBody>
    </Card>
  );
}
