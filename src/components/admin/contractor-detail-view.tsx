"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import {
  createContractorMaterialListAction,
  createCustomerOfferAction,
} from "@/features/contractors/actions";
import type {
  ContractorMaterialList,
  CustomerOffer,
} from "@/features/contractors/server/contractors";
import type { CustomerSummary } from "@/features/crm/types";

export function ContractorDetailView({
  customer,
  lists,
  offers,
}: {
  customer: CustomerSummary;
  lists: ContractorMaterialList[];
  offers: CustomerOffer[];
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [listName, setListName] = useState("");
  const [listNotes, setListNotes] = useState("");
  const [offerTitle, setOfferTitle] = useState("");
  const [offerDesc, setOfferDesc] = useState("");
  const [discountType, setDiscountType] = useState<"CUSTOM_TERM" | "PERCENTAGE" | "FIXED_AMOUNT">(
    "CUSTOM_TERM",
  );
  const [discountValue, setDiscountValue] = useState("");

  function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!listName.trim()) return;
    startTransition(async () => {
      const res = await createContractorMaterialListAction({
        customerId: customer.id,
        name: listName,
        notes: listNotes.trim() || undefined,
      });
      if (res.ok) {
        setListName("");
        setListNotes("");
        setFeedback("Preferred material list created.");
      } else {
        setFeedback(res.message);
      }
    });
  }

  function handleCreateOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!offerTitle.trim()) return;
    startTransition(async () => {
      const res = await createCustomerOfferAction({
        customerId: customer.id,
        title: offerTitle,
        description: offerDesc.trim() || undefined,
        discountType,
        discountValue: discountValue.trim() ? Number(discountValue) : undefined,
        isActive: true,
      });
      if (res.ok) {
        setOfferTitle("");
        setOfferDesc("");
        setDiscountValue("");
        setFeedback("Approved commercial term saved.");
      } else {
        setFeedback(res.message);
      }
    });
  }

  return (
    <div className="space-y-gutter-lg">
      <div className="flex flex-wrap items-start justify-between gap-gutter-md">
        <div>
          <Link href="/admin/contractors" className="text-label-md text-primary hover:underline">
            ← Back to Contractors
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-gutter-xs">
            <h1 className="text-headline-lg text-primary">{customer.name}</h1>
            <Badge tone="info">{customer.relationshipTier}</Badge>
          </div>
          <p className="text-body-md text-on-surface-variant">
            +91 {customer.mobile}
            {customer.companyName ? ` • ${customer.companyName}` : ""}
          </p>
        </div>
        <ButtonLink href={`/admin/customers/${customer.id}`} variant="outline" size="sm">
          Open Full CRM Profile
        </ButtonLink>
      </div>

      {feedback && (
        <div role="status" className="rounded border border-info bg-surface-muted px-4 py-2 text-body-md">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-gutter-lg lg:grid-cols-2">
        <Card className="p-gutter-md space-y-gutter-md">
          <h2 className="text-headline-sm text-primary">Preferred Material Lists</h2>
          <form className="space-y-gutter-xs" onSubmit={handleCreateList}>
            <Field label="List Name">
              {(props) => (
                <Input
                  {...props}
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="e.g. Standard 3BHK Foundation List"
                />
              )}
            </Field>
            <Field label="Notes (Optional)">
              {(props) => (
                <Textarea
                  {...props}
                  rows={2}
                  value={listNotes}
                  onChange={(e) => setListNotes(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" size="sm" disabled={pending}>
              Create Material List
            </Button>
          </form>
          {lists.length > 0 && (
            <ul className="divide-y divide-border text-body-sm">
              {lists.map((l) => (
                <li key={l.id} className="py-2">
                  <p className="font-semibold text-on-surface">{l.name}</p>
                  {l.notes && <p className="text-on-surface-variant">{l.notes}</p>}
                  <p className="text-on-surface-variant">{l.items.length} items</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-gutter-md space-y-gutter-md">
          <div>
            <h2 className="text-headline-sm text-primary">Commercial Terms &amp; Offers</h2>
            <p className="text-body-sm text-on-surface-variant">
              Manually approved commercial terms only. Never auto-applied to quotations without
              administrator review.
            </p>
          </div>
          <form className="space-y-gutter-xs" onSubmit={handleCreateOffer}>
            <Field label="Offer / Term Title">
              {(props) => (
                <Input
                  {...props}
                  value={offerTitle}
                  onChange={(e) => setOfferTitle(e.target.value)}
                  placeholder="e.g. Priority Dispatch Scheduling"
                />
              )}
            </Field>
            <div className="grid grid-cols-2 gap-gutter-xs">
              <Field label="Type">
                {(props) => (
                  <Select
                    {...props}
                    value={discountType}
                    onChange={(e) =>
                      setDiscountType(
                        e.target.value as "CUSTOM_TERM" | "PERCENTAGE" | "FIXED_AMOUNT",
                      )
                    }
                  >
                    <option value="CUSTOM_TERM">Custom Term</option>
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
                  </Select>
                )}
              </Field>
              <Field label="Value (Optional)">
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                )}
              </Field>
            </div>
            <Field label="Description">
              {(props) => (
                <Textarea
                  {...props}
                  rows={2}
                  value={offerDesc}
                  onChange={(e) => setOfferDesc(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" size="sm" disabled={pending}>
              Save Approved Term
            </Button>
          </form>
          {offers.length > 0 && (
            <ul className="divide-y divide-border text-body-sm">
              {offers.map((o) => (
                <li key={o.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-on-surface">{o.title}</span>
                    <Badge tone={o.isActive ? "success" : "neutral"}>
                      {o.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {o.description && <p className="text-on-surface-variant">{o.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
