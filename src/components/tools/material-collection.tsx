"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ClipboardList,
  Copy,
  Download,
  Plus,
  Share2,
  Trash2,
  WifiOff,
} from "lucide-react";
import { QuantityInput } from "@/components/common/quantity-input";
import { useOnline } from "@/components/common/use-online";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { AlertModal, Modal } from "@/components/ui/modal";
import { Notification } from "@/components/ui/notification";
import { StockBadge } from "@/components/ui/status-badge";
import type { EnquiryCatalogueItem } from "@/features/enquiries/types";
import {
  resolveMaterialItemsAction,
  type ResolvedProduct,
} from "@/features/material-lists/actions";
import { stageEnquiry } from "@/features/material-lists/handoff";
import { materialStore, useMaterialData, type Kind } from "@/features/material-lists/store";
import {
  LIMITS,
  PROJECT_TYPES,
  PROJECT_TYPE_LABELS,
  type MaterialItem,
  type MaterialList,
  type Project,
  type ProjectType,
} from "@/features/material-lists/types";
import { PRICE_DISCLAIMER } from "@/features/products/format";

type Resolved = {
  status: "idle" | "loading" | "ready" | "error";
  source: "LIVE" | "STATIC" | null;
  products: Record<string, ResolvedProduct | null>;
};

/** Re-reads current catalogue facts for the linked products. Saved lists never keep prices or stock. */
function useResolved(items: MaterialItem[], enabled: boolean, retry: number): Resolved {
  const ids = useMemo(
    () => [...new Set(items.map((i) => i.productId).filter((x): x is string => !!x))].sort(),
    [items],
  );
  const key = ids.join(",");
  const [state, setState] = useState<Resolved & { key: string }>({
    status: "idle",
    source: null,
    products: {},
    key: "",
  });
  useEffect(() => {
    if (!enabled || !key) return;
    let cancelled = false;
    resolveMaterialItemsAction(key.split(","))
      .then((r) => {
        if (cancelled) return;
        setState(
          r.ok
            ? { status: "ready", source: r.source, products: r.products, key }
            : { status: "error", source: null, products: {}, key },
        );
      })
      .catch(() => !cancelled && setState({ status: "error", source: null, products: {}, key }));
    return () => {
      cancelled = true;
    };
  }, [key, enabled, retry]);
  if (!ids.length) return { status: "ready", source: null, products: {} };
  if (!enabled) return { status: "idle", source: null, products: {} };
  if (state.key !== key) return { status: "loading", source: null, products: {} };
  return state;
}

export function collectionToText(c: MaterialList | Project): string {
  const lines = [`${c.name}${"type" in c ? ` (${PROJECT_TYPE_LABELS[c.type]})` : ""}`];
  if ("location" in c && c.location) lines.push(`Location: ${c.location}`);
  if ("measurements" in c)
    for (const m of c.measurements) if (m.label || m.value) lines.push(`${m.label}: ${m.value}`);
  if (c.notes) lines.push(`Notes: ${c.notes}`);
  lines.push("", "Materials (suggested quantities — to be confirmed):");
  for (const i of c.items)
    lines.push(
      `- ${i.name}: ${Number(i.quantity.toFixed(3))}${i.unit ? ` ${i.unit}` : ""}${i.source === "ESTIMATED" ? " (calculator estimate)" : ""}${i.notes ? ` — ${i.notes}` : ""}`,
    );
  return lines.join("\n");
}

function StoreNotices() {
  const d = useMaterialData();
  const online = useOnline();
  return (
    <div className="space-y-gutter-sm">
      {d.status === "recovered" && (
        <Notification tone="warning" title="Some saved data could not be read">
          <span>
            It has been set aside on this device and everything that could be read was kept.{" "}
          </span>
          <Button size="sm" variant="outline" onClick={() => materialStore.acknowledgeRecovery()}>
            Dismiss
          </Button>
        </Notification>
      )}
      {d.status === "future" && (
        <Notification tone="warning" title="Saved by a newer version of this site">
          Your saved lists were written by a newer version, so they are shown empty here and left
          untouched. Reload the page or update the app to see them.
        </Notification>
      )}
      {d.persistFailed && d.status !== "future" && (
        <Notification tone="warning" title="Saving is not available in this browser">
          Your changes are kept only while this page stays open. Private browsing or a full browser
          storage can cause this.
        </Notification>
      )}
      {!online && (
        <Notification tone="info" title="You are offline">
          <span className="flex items-start gap-2">
            <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              Your lists work offline. Current prices and availability cannot be refreshed, and
              enquiries can only be sent when you are online.
            </span>
          </span>
        </Notification>
      )}
    </div>
  );
}

function AddItem({
  kind,
  id,
  catalogue,
}: {
  kind: Kind;
  id: string;
  catalogue: EnquiryCatalogueItem[];
}) {
  const [mode, setMode] = useState<"catalogue" | "custom">(
    catalogue.length ? "catalogue" : "custom",
  );
  const [filter, setFilter] = useState("");
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [qty, setQty] = useState("1");
  const [err, setErr] = useState<string | null>(null);
  const f = filter.trim().toLowerCase();
  const options = f
    ? catalogue.filter((p) => `${p.name} ${p.brandName ?? ""}`.toLowerCase().includes(f))
    : catalogue;

  function add(e: React.FormEvent) {
    e.preventDefault();
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > LIMITS.maxQuantity)
      return setErr("Enter a quantity greater than zero.");
    let ok: boolean;
    if (mode === "catalogue") {
      const p = catalogue.find((x) => x.id === productId);
      if (!p) return setErr("Choose a product.");
      ok = materialStore.addItem(kind, id, {
        productId: p.id,
        name: p.name,
        quantity,
        unit: p.unitLabel,
        notes: "",
        source: "MANUAL",
      });
    } else {
      if (!name.trim()) return setErr("Describe the material.");
      ok = materialStore.addItem(kind, id, {
        productId: null,
        name: name.trim(),
        quantity,
        unit: unit.trim(),
        notes: "",
        source: "MANUAL",
      });
    }
    if (!ok) return setErr(`A list holds up to ${LIMITS.itemsPerList} items.`);
    setErr(null);
    setProductId("");
    setName("");
    setQty("1");
  }

  return (
    <form
      onSubmit={add}
      noValidate
      className="space-y-gutter-sm rounded border border-border p-gutter-md"
    >
      <p className="text-title-md font-semibold">Add a material</p>
      {catalogue.length > 0 && (
        <div role="group" aria-label="Kind of material" className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "catalogue" ? "primary" : "outline"}
            aria-pressed={mode === "catalogue"}
            onClick={() => setMode("catalogue")}
          >
            Catalogue product
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "custom" ? "primary" : "outline"}
            aria-pressed={mode === "custom"}
            onClick={() => setMode("custom")}
          >
            Custom requirement
          </Button>
        </div>
      )}
      {mode === "catalogue" ? (
        <div className="grid grid-cols-1 gap-gutter-sm sm:grid-cols-3">
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
          <Field label="Product" required>
            {(p) => (
              <Select {...p} value={productId} onChange={(e) => setProductId(e.target.value)}>
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
          <Field label="Quantity" required>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            )}
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-gutter-sm sm:grid-cols-3">
          <Field
            label="Material"
            required
            helper="Not a catalogue product — it will be sent as a requirement for the team to quote."
          >
            {(p) => (
              <Input
                {...p}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={LIMITS.itemName}
              />
            )}
          </Field>
          <Field label="Unit">
            {(p) => (
              <Input
                {...p}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                maxLength={LIMITS.unit}
                placeholder="e.g. bags, metres"
              />
            )}
          </Field>
          <Field label="Quantity" required>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            )}
          </Field>
        </div>
      )}
      {err && (
        <p role="alert" className="text-body-sm text-error">
          {err}
        </p>
      )}
      <Button type="submit" size="sm">
        <Plus aria-hidden className="mr-1.5 size-4" />
        Add to {kind === "list" ? "list" : "project"}
      </Button>
    </form>
  );
}

function ItemRow({
  kind,
  id,
  item,
  resolved,
  status,
}: {
  kind: Kind;
  id: string;
  item: MaterialItem;
  resolved: ResolvedProduct | null | undefined;
  status: Resolved["status"];
}) {
  const gone = item.productId !== null && status === "ready" && resolved === null;
  const live = item.productId !== null && resolved ? resolved : null;
  return (
    <li className="space-y-2 rounded border border-border p-gutter-md">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-title-md font-semibold [overflow-wrap:anywhere]">
            {live ? live.name : item.name}
          </p>
          <p className="text-body-sm text-on-surface-variant">
            {live?.brandName ? `${live.brandName} · ` : ""}
            {item.productId ? "Catalogue product" : "Custom requirement"} ·{" "}
            {live ? live.unitLabel : item.unit || "no unit"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {item.source === "ESTIMATED" && (
            <Badge tone="info" appearance="outline">
              Calculator estimate
            </Badge>
          )}
          {gone && <Badge tone="error">No longer available</Badge>}
        </div>
      </div>
      {gone && (
        <p role="note" className="flex items-start gap-2 text-body-sm text-error">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          This product is no longer listed. It will not be included when you send this list as an
          enquiry.
        </p>
      )}
      {live && (
        <p className="flex flex-wrap items-center gap-2 text-body-sm">
          <span>{live.rate ? `Indicative rate ${live.rate}` : "Rate on request"}</span>
          <StockBadge status={live.stockStatus} />
        </p>
      )}
      <div className="flex flex-wrap items-center gap-gutter-md">
        <QuantityInput
          value={item.quantity}
          onChange={(q) => materialStore.updateItem(kind, id, item.id, { quantity: q })}
          label={`Quantity of ${item.name}`}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Remove ${item.name}`}
          onClick={() => materialStore.removeItem(kind, id, item.id)}
        >
          <Trash2 aria-hidden className="mr-1.5 size-4" />
          Remove
        </Button>
      </div>
      <Field label="Note (optional)">
        {(p) => (
          <Input
            {...p}
            defaultValue={item.notes}
            maxLength={LIMITS.itemNotes}
            onBlur={(e) => materialStore.updateItem(kind, id, item.id, { notes: e.target.value })}
          />
        )}
      </Field>
    </li>
  );
}

function SendReview({
  open,
  onClose,
  c,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  c: MaterialList | Project;
  kind: Kind;
}) {
  const router = useRouter();
  const online = useOnline();
  const [retry, setRetry] = useState(0);
  const resolved = useResolved(c.items, open && online, retry);
  const available = c.items.filter(
    (i) => !i.productId || (resolved.products[i.productId] ?? null) !== null,
  );
  const removed = c.items.length - available.length;
  const ready = online && resolved.status === "ready";

  function go() {
    const r = stageEnquiry(available, {
      heading: `${kind === "project" ? "Project" : "Material list"}: ${c.name}`,
      notes: c.notes,
    });
    if (r.added + r.custom === 0) return;
    onClose();
    router.push("/bulk-enquiry");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send this list as an enquiry"
      description="Review the current product details. Nothing is sent until you submit the enquiry form."
    >
      <div className="space-y-gutter-md">
        {!online && (
          <Notification tone="warning">
            You are offline. Connect to the internet to refresh product details and send an enquiry.
          </Notification>
        )}
        {resolved.status === "loading" && <p role="status">Checking the current catalogue…</p>}
        {resolved.status === "error" && (
          <Notification tone="error">
            <span>The catalogue could not be checked right now. </span>
            <Button size="sm" variant="outline" onClick={() => setRetry((r) => r + 1)}>
              Try again
            </Button>
          </Notification>
        )}
        {resolved.source === "STATIC" && (
          <Notification tone="warning">
            Live prices are not available at the moment; any rates shown are not current.
          </Notification>
        )}
        {ready && (
          <>
            <ul className="space-y-2">
              {c.items.map((i) => {
                const p = i.productId ? resolved.products[i.productId] : null;
                const gone = i.productId !== null && !p;
                return (
                  <li key={i.id} className="rounded border border-border p-gutter-sm">
                    <p className={gone ? "font-semibold text-error line-through" : "font-semibold"}>
                      {p ? p.name : i.name}
                    </p>
                    <p className="text-body-sm text-on-surface-variant">
                      {gone
                        ? "No longer available — will not be sent"
                        : `${Number(i.quantity.toFixed(3))} ${p ? p.unitLabel : i.unit}`.trim()}
                      {p && ` · ${p.rate ? `indicative rate ${p.rate}` : "rate on request"}`}
                      {!i.productId && " · custom requirement"}
                    </p>
                  </li>
                );
              })}
            </ul>
            {removed > 0 && (
              <p role="note" className="text-body-sm text-error">
                {removed} item(s) are no longer available and will be left out.
              </p>
            )}
            <p className="text-body-sm text-on-surface-variant">
              {PRICE_DISCLAIMER} Quantities can still be changed in the enquiry form.
            </p>
          </>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} disabled={!ready || available.length === 0}>
            Continue to enquiry form
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Editor({
  kind,
  c,
  catalogue,
}: {
  kind: Kind;
  c: MaterialList | Project;
  catalogue: EnquiryCatalogueItem[];
}) {
  const online = useOnline();
  const [retry] = useState(0);
  const resolved = useResolved(c.items, online, retry);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [review, setReview] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const project = "type" in c ? c : null;

  const text = collectionToText(c);
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: c.name, text });
      } else {
        await navigator.clipboard.writeText(text);
        setMsg("Copied to the clipboard.");
      }
    } catch {
      /* the customer closed the share sheet */
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c.name.replace(/[^\w-]+/g, "-").slice(0, 40) || "materials"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardBody className="space-y-gutter-md">
        {resolved.source === "STATIC" && (
          <Notification tone="warning">
            Live prices are not available at the moment; rates shown are not current.
          </Notification>
        )}
        <div className="grid grid-cols-1 gap-gutter-md sm:grid-cols-2">
          <Field label={kind === "project" ? "Project name" : "List name"} required>
            {(p) => (
              <Input
                {...p}
                defaultValue={c.name}
                maxLength={LIMITS.name}
                onBlur={(e) => materialStore.rename(kind, c.id, e.target.value)}
              />
            )}
          </Field>
          {project && (
            <Field label="Project type">
              {(p) => (
                <Select
                  {...p}
                  value={project.type}
                  onChange={(e) =>
                    materialStore.updateProject(c.id, { type: e.target.value as ProjectType })
                  }
                >
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PROJECT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          {project && (
            <Field
              label="Location (optional)"
              helper="Stays on this device unless you put it in an enquiry."
            >
              {(p) => (
                <Input
                  {...p}
                  defaultValue={project.location}
                  maxLength={LIMITS.location}
                  onBlur={(e) => materialStore.updateProject(c.id, { location: e.target.value })}
                />
              )}
            </Field>
          )}
        </div>
        {project && (
          <fieldset className="space-y-2 rounded border border-border p-gutter-md">
            <legend className="px-1 text-title-md font-semibold">
              Measurements you want to remember
            </legend>
            {project.measurements.map((m, i) => (
              <div
                key={`${i}-${m.label}`}
                className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
              >
                <Field label={`Label ${i + 1}`}>
                  {(p) => (
                    <Input
                      {...p}
                      defaultValue={m.label}
                      maxLength={LIMITS.measurementText}
                      onBlur={(e) =>
                        materialStore.updateProject(c.id, {
                          measurements: project.measurements.map((x, k) =>
                            k === i ? { ...x, label: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  )}
                </Field>
                <Field label={`Value ${i + 1}`}>
                  {(p) => (
                    <Input
                      {...p}
                      defaultValue={m.value}
                      maxLength={LIMITS.measurementText}
                      onBlur={(e) =>
                        materialStore.updateProject(c.id, {
                          measurements: project.measurements.map((x, k) =>
                            k === i ? { ...x, value: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  )}
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove measurement ${i + 1}`}
                  onClick={() =>
                    materialStore.updateProject(c.id, {
                      measurements: project.measurements.filter((_, k) => k !== i),
                    })
                  }
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>
            ))}
            {project.measurements.length < LIMITS.measurements && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  materialStore.updateProject(c.id, {
                    measurements: [...project.measurements, { label: "", value: "" }],
                  })
                }
              >
                Add a measurement
              </Button>
            )}
          </fieldset>
        )}
        <Field label="Notes (optional)">
          {(p) => (
            <Textarea
              {...p}
              defaultValue={c.notes}
              rows={3}
              maxLength={LIMITS.notes}
              onBlur={(e) => materialStore.setNotes(kind, c.id, e.target.value)}
            />
          )}
        </Field>

        <section aria-labelledby={`items-${c.id}`} className="space-y-gutter-sm">
          <h3 id={`items-${c.id}`} className="text-title-lg font-bold text-primary">
            Materials ({c.items.length})
          </h3>
          {resolved.status === "loading" && (
            <p role="status" className="text-body-sm text-on-surface-variant">
              Refreshing current product details…
            </p>
          )}
          {resolved.status === "error" && (
            <p className="text-body-sm text-warning">
              Current prices and availability could not be refreshed.
            </p>
          )}
          {c.items.length === 0 ? (
            <EmptyState
              icon={<ClipboardList />}
              title="No materials yet"
              description="Add products below, or use the material calculator and save the result here."
            />
          ) : (
            <ul className="space-y-gutter-sm">
              {c.items.map((i) => (
                <ItemRow
                  key={i.id}
                  kind={kind}
                  id={c.id}
                  item={i}
                  status={resolved.status}
                  resolved={i.productId ? resolved.products[i.productId] : undefined}
                />
              ))}
            </ul>
          )}
          <AddItem kind={kind} id={c.id} catalogue={catalogue} />
        </section>

        {msg && (
          <p role="status" className="text-body-sm text-success">
            {msg}
          </p>
        )}
        <div className="flex flex-wrap gap-2 border-t border-border pt-gutter-md">
          <Button onClick={() => setReview(true)} disabled={c.items.length === 0}>
            <ClipboardList aria-hidden className="mr-1.5 size-4" />
            {kind === "project" ? "Send this project as an enquiry" : "Send this list as enquiry"}
          </Button>
          <Button variant="outline" onClick={share}>
            <Share2 aria-hidden className="mr-1.5 size-4" />
            Share list
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              navigator.clipboard.writeText(text).then(() => setMsg("Copied to the clipboard."))
            }
          >
            <Copy aria-hidden className="mr-1.5 size-4" />
            Copy as text
          </Button>
          <Button variant="outline" onClick={download}>
            <Download aria-hidden className="mr-1.5 size-4" />
            Download .txt
          </Button>
          <Button variant="outline" onClick={() => materialStore.duplicate(kind, c.id)}>
            Duplicate
          </Button>
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden className="mr-1.5 size-4" />
            Delete
          </Button>
        </div>
        {!online && (
          <p className="text-body-sm text-on-surface-variant">
            Sending an enquiry needs an internet connection.
          </p>
        )}
      </CardBody>
      <AlertModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete “${c.name}”?`}
        description="It will be removed from this device. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          materialStore.delete(kind, c.id);
          setConfirmDelete(false);
        }}
      />
      <SendReview open={review} onClose={() => setReview(false)} c={c} kind={kind} />
    </Card>
  );
}

/**
 * One manager for both standalone saved lists and project checklists (the same item model and the same hand-off). Everything
 * is stored in this browser only; catalogue prices and stock are re-read each time and never saved.
 */
export function MaterialCollection({
  kind,
  catalogue,
}: {
  kind: Kind;
  catalogue: EnquiryCatalogueItem[];
}) {
  const data = useMaterialData();
  const coll: Array<MaterialList | Project> = kind === "list" ? data.lists : data.projects;
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("HOUSE");
  const [error, setError] = useState<string | null>(null);
  const current = coll.find((x) => x.id === selected) ?? coll[0] ?? null;
  const noun = kind === "list" ? "list" : "project";
  const limit = kind === "list" ? LIMITS.lists : LIMITS.projects;

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(`Give your ${noun} a name.`);
    const id =
      kind === "list"
        ? materialStore.createList(name)
        : materialStore.createProject({ name, type });
    if (!id) return setError(`You can keep up to ${limit} ${noun}s. Delete one first.`);
    setError(null);
    setName("");
    setSelected(id);
  }

  return (
    <div className="space-y-gutter-lg">
      <StoreNotices />
      <Card>
        <CardBody>
          <form
            onSubmit={create}
            noValidate
            className="grid grid-cols-1 items-end gap-gutter-md sm:grid-cols-[2fr_1fr_auto]"
          >
            <Field
              label={kind === "list" ? "New list name" : "New project name"}
              required
              error={error ?? undefined}
            >
              {(p) => (
                <Input
                  {...p}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={LIMITS.name}
                  placeholder={kind === "list" ? "e.g. Monthly cement" : "e.g. Ground floor house"}
                />
              )}
            </Field>
            {kind === "project" ? (
              <Field label="Project type">
                {(p) => (
                  <Select
                    {...p}
                    value={type}
                    onChange={(e) => setType(e.target.value as ProjectType)}
                  >
                    {PROJECT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {PROJECT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <span />
            )}
            <Button type="submit" size="lg">
              <Plus aria-hidden className="mr-1.5 size-4" />
              Create {noun}
            </Button>
          </form>
        </CardBody>
      </Card>

      {coll.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title={`No saved ${noun}s yet`}
          description={`Create a ${noun} above. It is stored only on this device — no account needed.`}
        />
      ) : (
        <>
          <nav aria-label={`Your ${noun}s`}>
            <ul className="flex flex-wrap gap-2">
              {coll.map((x) => (
                <li key={x.id}>
                  <Button
                    variant={current?.id === x.id ? "primary" : "outline"}
                    aria-pressed={current?.id === x.id}
                    onClick={() => setSelected(x.id)}
                  >
                    {x.name}{" "}
                    <span className="ml-1 text-label-md opacity-80">({x.items.length})</span>
                  </Button>
                </li>
              ))}
            </ul>
          </nav>
          {current && <Editor key={current.id} kind={kind} c={current} catalogue={catalogue} />}
        </>
      )}
      <p className="text-body-sm text-on-surface-variant">
        Saved on this device only (no account). Clearing your browser data removes them. Rates shown
        are indicative and always re-read from the catalogue — they are never saved with your list.
      </p>
    </div>
  );
}
