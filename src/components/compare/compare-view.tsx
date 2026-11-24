"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Plus, Scale, Trash2 } from "lucide-react";
import { WhatsAppButton } from "@/components/website/contact-actions";
import { AddToEnquiryButton } from "@/components/website/add-to-enquiry-button";
import { ProductImage } from "@/components/website/product-image";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Select, Input } from "@/components/ui/form-controls";
import { Notification } from "@/components/ui/notification";
import { StockBadge } from "@/components/ui/status-badge";
import { compareHref, MAX_COMPARE, type Comparison } from "@/features/compare/compare";
import { compareStore, useCompareIds } from "@/features/compare/store";
import { formatUpdated, PRICE_DISCLAIMER } from "@/features/products/format";
import { productEnquiryMessage } from "@/lib/whatsapp";

export type PickerProduct = {
  id: string;
  name: string;
  brandName: string | null;
  unitLabel: string;
};

const NS = <span className="text-on-surface-variant">Not specified</span>;

/**
 * Side-by-side comparison. Shows only catalogue facts; anything missing says "Not specified". No product is ever labelled best,
 * cheapest or most suitable, and different units are flagged, never converted.
 */
export function CompareView({
  comparison,
  requestedIds,
  picker,
  whatsappNumber,
  source,
}: {
  comparison: Comparison;
  requestedIds: string[];
  picker: PickerProduct[];
  whatsappNumber: string | null;
  source: "LIVE" | "STATIC";
}) {
  const router = useRouter();
  const stored = useCompareIds();
  const [filter, setFilter] = useState("");
  const [choice, setChoice] = useState("");
  const [copied, setCopied] = useState(false);
  const { columns, missing, specRows, notes } = comparison;
  const shownIds = columns.map((c) => c.id);

  // Keep the URL and the saved list in step. A list saved earlier opens here; ids that no longer exist are dropped from it.
  useEffect(() => {
    if (requestedIds.length === 0 && stored.length > 0) router.replace(compareHref([...stored]));
    else if (requestedIds.length > 0) compareStore.set(shownIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedIds.join(","), shownIds.join(",")]);

  const f = filter.trim().toLowerCase();
  const options = picker.filter(
    (p) =>
      !shownIds.includes(p.id) &&
      (!f || `${p.name} ${p.brandName ?? ""}`.toLowerCase().includes(f)),
  );
  const go = (ids: string[]) => router.push(compareHref(ids));

  if (columns.length === 0) {
    return (
      <div className="space-y-gutter-lg">
        {missing.length > 0 && (
          <Notification tone="warning">
            {missing.length} selected product(s) are no longer available and were removed.
          </Notification>
        )}
        <EmptyState
          icon={<Scale />}
          title="Nothing to compare yet"
          description="Use the Compare button on a product, or pick products below."
          action={<ButtonLink href="/products">Browse products</ButtonLink>}
        />
        <Picker
          filter={filter}
          setFilter={setFilter}
          choice={choice}
          setChoice={setChoice}
          options={options}
          full={false}
          onAdd={(id) => go([id])}
        />
      </div>
    );
  }

  return (
    <div className="space-y-gutter-lg">
      {missing.length > 0 && (
        <Notification tone="warning">
          {missing.length} product(s) are no longer available and were removed from this comparison.
        </Notification>
      )}
      {source === "STATIC" && (
        <Notification tone="warning">
          Live prices are not available at the moment; rates shown are not current.
        </Notification>
      )}
      {notes.map((n) => (
        <Notification key={n} tone="info">
          {n}
        </Notification>
      ))}
      {columns.length === 1 && (
        <p className="text-body-md text-on-surface-variant">
          Add at least one more product to compare.
        </p>
      )}

      <div
        role="region"
        aria-label="Product comparison — scroll sideways to see every product"
        tabIndex={0}
        className="overflow-x-auto rounded-md border border-border focus-visible:outline-2"
      >
        <table className="w-full min-w-[34rem] border-collapse text-left text-body-md">
          <caption className="sr-only">
            Comparison of {columns.map((c) => c.name).join(", ")}
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-32 border-b border-border bg-surface-muted p-gutter-sm text-label-lg"
              >
                Product
              </th>
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className="min-w-52 border-b border-l border-border bg-surface p-gutter-sm align-top"
                >
                  <ProductImage src={c.imageUrl} name={c.name} className="mb-2" sizes="220px" />
                  <Link
                    href={`/products/${c.slug}`}
                    className="text-title-md font-bold text-primary hover:underline [overflow-wrap:anywhere]"
                  >
                    {c.name}
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${c.name} from comparison`}
                      onClick={() => go(shownIds.filter((x) => x !== c.id))}
                    >
                      <Trash2 aria-hidden className="mr-1 size-4" />
                      Remove
                    </Button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <Row label="Brand" cells={columns.map((c) => c.brand)} />
            <Row label="Category" cells={columns.map((c) => c.category)} />
            <Row label="SKU" cells={columns.map((c) => c.sku)} />
            <Row label="Unit" cells={columns.map((c) => c.unit)} />
            <Row label="Indicative rate" cells={columns.map((c) => c.rate)} />
            <tr>
              <th scope="row" className="sticky left-0 bg-surface-muted p-gutter-sm text-label-lg">
                Availability
              </th>
              {columns.map((c) => (
                <td key={c.id} className="border-l border-border p-gutter-sm">
                  <StockBadge status={c.stockStatus} />
                </td>
              ))}
            </tr>
            <Row label="Last updated" cells={columns.map((c) => formatUpdated(c.updatedAt))} />
            {specRows.map((r) => (
              <Row key={r.label} label={r.label} cells={r.values} />
            ))}
            <tr>
              <th scope="row" className="sticky left-0 bg-surface-muted p-gutter-sm text-label-lg">
                Actions
              </th>
              {columns.map((c) => (
                <td key={c.id} className="space-y-2 border-l border-border p-gutter-sm align-top">
                  <ButtonLink
                    href={`/products/${c.slug}`}
                    size="sm"
                    variant="outline"
                    className="w-full"
                  >
                    View details
                  </ButtonLink>
                  <AddToEnquiryButton productId={c.id} productName={c.name} className="w-full" />
                  <WhatsAppButton
                    hideIfUnavailable
                    number={whatsappNumber}
                    size="sm"
                    className="w-full"
                    message={productEnquiryMessage({
                      productName: c.name,
                      brandName: c.brand,
                      sku: c.sku,
                      unitLabel: c.unit,
                    })}
                  >
                    WhatsApp enquiry
                  </WhatsAppButton>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-body-sm text-on-surface-variant">{PRICE_DISCLAIMER}</p>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            navigator.clipboard
              .writeText(`${window.location.origin}${compareHref(shownIds)}`)
              .then(() => setCopied(true))
          }
        >
          <Copy aria-hidden className="mr-1.5 size-4" />
          {copied ? "Link copied" : "Copy comparison link"}
        </Button>
        <Button variant="outline" onClick={() => go([])}>
          Clear comparison
        </Button>
      </div>
      <Picker
        filter={filter}
        setFilter={setFilter}
        choice={choice}
        setChoice={setChoice}
        options={options}
        full={columns.length >= MAX_COMPARE}
        onAdd={(id) => go([...shownIds, id])}
      />
    </div>
  );
}

function Row({ label, cells }: { label: string; cells: Array<string | null> }) {
  return (
    <tr>
      <th scope="row" className="sticky left-0 bg-surface-muted p-gutter-sm text-label-lg">
        {label}
      </th>
      {cells.map((v, i) => (
        <td key={i} className="border-l border-border p-gutter-sm [overflow-wrap:anywhere]">
          {v ?? NS}
        </td>
      ))}
    </tr>
  );
}

function Picker({
  filter,
  setFilter,
  choice,
  setChoice,
  options,
  full,
  onAdd,
}: {
  filter: string;
  setFilter: (v: string) => void;
  choice: string;
  setChoice: (v: string) => void;
  options: PickerProduct[];
  full: boolean;
  onAdd: (id: string) => void;
}) {
  return (
    <section
      aria-labelledby="add-compare"
      className="space-y-gutter-sm rounded border border-border p-gutter-md"
    >
      <h2 id="add-compare" className="text-title-lg font-bold text-primary">
        Add a product to compare
      </h2>
      {full ? (
        <p className="text-body-md text-on-surface-variant">
          You are comparing the maximum of {MAX_COMPARE} products. Remove one above to add another
          (or replace it).
        </p>
      ) : (
        <form
          className="grid grid-cols-1 items-end gap-gutter-sm sm:grid-cols-[1fr_2fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (choice) onAdd(choice);
          }}
        >
          <Field label="Find a product">
            {(p) => (
              <Input
                {...p}
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                maxLength={60}
                autoComplete="off"
              />
            )}
          </Field>
          <Field label="Product">
            {(p) => (
              <Select {...p} value={choice} onChange={(e) => setChoice(e.target.value)}>
                <option value="">Choose a product</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.brandName ? ` — ${o.brandName}` : ""} (per {o.unitLabel})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Button type="submit" disabled={!choice}>
            <Plus aria-hidden className="mr-1.5 size-4" />
            Add
          </Button>
        </form>
      )}
    </section>
  );
}
