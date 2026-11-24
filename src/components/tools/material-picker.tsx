"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ClipboardList, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { Notification } from "@/components/ui/notification";
import { stageEnquiry } from "@/features/material-lists/handoff";
import { materialStore, useMaterialData } from "@/features/material-lists/store";
import { LIMITS, type MaterialItem } from "@/features/material-lists/types";
import { unitsMatch } from "@/features/material-lists/units";
import type { EnquiryCatalogueItem } from "@/features/enquiries/types";

export type PickerRow = { label: string; quantity: number; unit: string };
type Choice = { productId: string; qty: string };

/**
 * Turns calculated quantities into enquiry / list items. The customer chooses which catalogue product each line is (or leaves it
 * as a custom requirement), can change every quantity, and nothing is sent: "Add to enquiry list" only fills the EXISTING
 * enquiry list and opens the bulk enquiry form, where the server re-checks every product, unit, price and availability.
 * A calculated quantity is a suggestion, never an order, and units are never converted for the customer.
 */
export function AddMaterialsPanel({
  rows,
  catalogue,
  heading,
}: {
  rows: PickerRow[];
  catalogue: EnquiryCatalogueItem[];
  heading: string;
}) {
  const router = useRouter();
  const data = useMaterialData();
  const [choices, setChoices] = useState<Choice[]>(() =>
    rows.map((r) => ({ productId: "", qty: String(r.quantity) })),
  );
  const [filter, setFilter] = useState("");
  const [target, setTarget] = useState("__new__");
  const [newName, setNewName] = useState("Calculator estimate");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
    link?: boolean;
  } | null>(null);

  const q = filter.trim().toLowerCase();
  const options = q
    ? catalogue.filter((p) => `${p.name} ${p.brandName ?? ""}`.toLowerCase().includes(q))
    : catalogue;
  const byId = new Map(catalogue.map((p) => [p.id, p]));

  function build(): Array<Omit<MaterialItem, "id">> | string {
    const items: Array<Omit<MaterialItem, "id">> = [];
    for (let i = 0; i < rows.length; i++) {
      const qty = Number(choices[i].qty);
      if (!Number.isFinite(qty) || qty <= 0 || qty > LIMITS.maxQuantity)
        return `Enter a quantity greater than zero for “${rows[i].label}”.`;
      const p = choices[i].productId ? byId.get(choices[i].productId) : undefined;
      items.push({
        productId: p ? p.id : null,
        name: p ? p.name : rows[i].label,
        quantity: qty,
        unit: p ? p.unitLabel : rows[i].unit,
        notes: "",
        source: qty === rows[i].quantity ? "ESTIMATED" : "MANUAL",
      });
    }
    return items;
  }

  function addToEnquiry() {
    const items = build();
    if (typeof items === "string") return setFeedback({ tone: "error", text: items });
    const r = stageEnquiry(
      items.map((it, i) => ({ ...it, id: `calc-${i}` })),
      { heading },
    );
    if (r.skippedFull)
      setFeedback({
        tone: "error",
        text: `${r.skippedFull} item(s) did not fit: the enquiry list holds up to 50 products.`,
      });
    router.push("/bulk-enquiry");
  }

  function saveToList() {
    const items = build();
    if (typeof items === "string") return setFeedback({ tone: "error", text: items });
    const id =
      target === "__new__" ? materialStore.createList(newName || "Calculator estimate") : target;
    if (!id)
      return setFeedback({
        tone: "error",
        text: `You can keep up to ${LIMITS.lists} lists. Delete one first.`,
      });
    let failed = 0;
    for (const it of items) if (!materialStore.addItem("list", id, it)) failed++;
    setFeedback(
      failed
        ? {
            tone: "error",
            text: `${failed} item(s) could not be added: a list holds up to ${LIMITS.itemsPerList} items.`,
          }
        : { tone: "success", text: "Saved to your material list on this device.", link: true },
    );
  }

  return (
    <section
      aria-labelledby="add-materials-heading"
      className="space-y-gutter-md rounded-md border border-border bg-surface-muted p-gutter-md"
    >
      <div>
        <h3 id="add-materials-heading" className="text-title-lg font-bold text-primary">
          Add materials to enquiry
        </h3>
        <p className="text-body-md text-on-surface-variant">
          Pick the catalogue product for each line (or leave it as a custom requirement) and adjust
          the quantity. These are <strong>suggested quantities, not an order</strong>. Sagar Traders
          confirms prices and availability when you send the enquiry.
        </p>
      </div>
      {catalogue.length > 0 && (
        <Field label="Find a product" helper="Narrows the product lists below.">
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
      )}
      <ul className="space-y-gutter-md">
        {rows.map((r, i) => {
          const p = choices[i].productId ? byId.get(choices[i].productId) : undefined;
          return (
            <li
              key={`${r.label}-${i}`}
              className="space-y-2 rounded border border-border bg-surface p-gutter-sm"
            >
              <p className="text-title-md font-semibold">
                {r.label}{" "}
                <span className="font-normal text-on-surface-variant">
                  — suggested {r.quantity.toLocaleString("en-IN")} {r.unit}
                </span>
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Field label={`Product for ${r.label}`}>
                    {(f) => (
                      <Select
                        {...f}
                        value={choices[i].productId}
                        onChange={(e) =>
                          setChoices((c) =>
                            c.map((x, k) => (k === i ? { ...x, productId: e.target.value } : x)),
                          )
                        }
                      >
                        <option value="">
                          No catalogue product — send as a custom requirement
                        </option>
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                            {o.brandName ? ` — ${o.brandName}` : ""} (per {o.unitLabel})
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
                <Field label={`Quantity (${p ? p.unitLabel : r.unit})`}>
                  {(f) => (
                    <Input
                      {...f}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={choices[i].qty}
                      onChange={(e) =>
                        setChoices((c) =>
                          c.map((x, k) => (k === i ? { ...x, qty: e.target.value } : x)),
                        )
                      }
                    />
                  )}
                </Field>
              </div>
              {p && !unitsMatch(r.unit, p.unitLabel) && (
                <p role="note" className="flex items-start gap-2 text-body-sm text-warning">
                  <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Calculated in {r.unit}, but this product is sold per {p.unitLabel}. Nothing is
                    converted for you — enter the quantity in {p.unitLabel}.
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {feedback && (
        <Notification tone={feedback.tone}>
          {feedback.text}{" "}
          {feedback.link && (
            <Link href="/my-material-lists" className="font-semibold text-primary underline">
              Open my lists
            </Link>
          )}
        </Notification>
      )}

      <div className="grid grid-cols-1 gap-gutter-md md:grid-cols-2">
        <div className="space-y-2">
          <Button type="button" size="lg" className="w-full" onClick={addToEnquiry}>
            <ClipboardList aria-hidden className="mr-2 size-4" />
            Add to enquiry list
          </Button>
          <p className="text-body-sm text-on-surface-variant">
            Opens the bulk enquiry form. Nothing is sent until you submit it there.
          </p>
        </div>
        <div className="space-y-2">
          <Field label="Save to">
            {(f) => (
              <Select {...f} value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="__new__">A new list</option>
                {data.lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {target === "__new__" && (
            <Field label="New list name">
              {(f) => (
                <Input
                  {...f}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={LIMITS.name}
                />
              )}
            </Field>
          )}
          <Button type="button" variant="outline" className="w-full" onClick={saveToList}>
            <ListPlus aria-hidden className="mr-2 size-4" />
            Save to a material list
          </Button>
        </div>
      </div>
    </section>
  );
}
