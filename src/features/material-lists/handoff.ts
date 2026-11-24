"use client";

import { enquiryList, MAX_ENQUIRY_ITEMS } from "@/features/enquiries/enquiry-list-store";
import type { MaterialItem } from "./types";

/**
 * Hands a material list over to the EXISTING bulk-enquiry flow. Nothing is submitted here: catalogue-linked items go into the
 * existing enquiry list (product id + quantity only — the server re-reads name, unit, price and availability when the customer
 * submits), and everything else becomes clearly labelled text in the message the customer can read and edit before sending.
 */
export const PREFILL_KEY = "sagar-enquiry-prefill-v1";
const MAX_MESSAGE = 1000; // the bulk enquiry form's own limit

export function buildEnquiryMessage(input: {
  heading?: string;
  notes?: string;
  custom: Array<Pick<MaterialItem, "name" | "quantity" | "unit">>;
}): string {
  const lines: string[] = [];
  if (input.heading?.trim()) lines.push(input.heading.trim());
  if (input.notes?.trim()) lines.push(`Notes: ${input.notes.trim()}`);
  if (input.custom.length) {
    lines.push("Additional requirements (not matched to catalogue products, please quote):");
    for (const c of input.custom)
      lines.push(`- ${c.name}: ${Number(c.quantity.toFixed(3))}${c.unit ? ` ${c.unit}` : ""}`);
  }
  const text = lines.join("\n");
  return text.length <= MAX_MESSAGE ? text : `${text.slice(0, MAX_MESSAGE - 1)}…`;
}

export type HandoffResult = { added: number; custom: number; skippedFull: number };

/** Puts the items into the enquiry list / message prefill. Does NOT navigate and does NOT submit. */
export function stageEnquiry(
  items: MaterialItem[],
  opts: { heading?: string; notes?: string } = {},
): HandoffResult {
  let added = 0;
  let skippedFull = 0;
  const custom: MaterialItem[] = [];
  for (const i of items) {
    if (i.productId) {
      if (enquiryList.add(i.productId, i.quantity)) added++;
      else skippedFull++;
    } else custom.push(i);
  }
  const message = buildEnquiryMessage({ heading: opts.heading, notes: opts.notes, custom });
  try {
    if (message) window.sessionStorage.setItem(PREFILL_KEY, JSON.stringify({ message }));
  } catch {
    /* storage unavailable: the customer can still type the message */
  }
  return { added, custom: custom.length, skippedFull };
}

/** Read once by the bulk enquiry form; removed immediately so it never reappears. */
export function takeEnquiryPrefill(): string | null {
  try {
    const raw = window.sessionStorage.getItem(PREFILL_KEY);
    window.sessionStorage.removeItem(PREFILL_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    const m = (v as { message?: unknown })?.message;
    return typeof m === "string" && m.trim() ? m.slice(0, MAX_MESSAGE) : null;
  } catch {
    return null;
  }
}

export { MAX_ENQUIRY_ITEMS };
