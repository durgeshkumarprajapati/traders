"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form-controls";
import {
  calculateProjectEstimate,
  ESTIMATOR_DISCLAIMER,
  type EstimatorLine,
  type ProjectEstimateType,
} from "@/features/calculator/cost-estimator";
import { formatRupees } from "@/features/quotations/calculations";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export interface EstimatorCatalogueProduct {
  id: string;
  name: string;
  unitLabel: string;
  price: number | null;
}

const PROJECT_TYPE_LABELS: Record<ProjectEstimateType, string> = {
  ROOM: "Room construction or renovation (walls + floor)",
  WALL: "Wall construction (brickwork & plaster)",
  FLOOR: "Floor construction (PCC / base)",
  RESIDENTIAL_BASIC: "Basic residential house planning",
};

export function ProjectCostEstimator({
  products,
  whatsappNumber,
}: {
  products: EstimatorCatalogueProduct[];
  whatsappNumber: string | null;
}) {
  const [projectType, setProjectType] = useState<ProjectEstimateType>("ROOM");
  const [lengthFt, setLengthFt] = useState("12");
  const [widthFt, setWidthFt] = useState("10");
  const [heightFt, setHeightFt] = useState("10");
  const [wastagePercent, setWastagePercent] = useState("5");
  const [lines, setLines] = useState<EstimatorLine[] | null>(null);
  const [areaSqFt, setAreaSqFt] = useState<number | null>(null);

  function runEstimate(e: React.FormEvent) {
    e.preventDefault();
    const res = calculateProjectEstimate({
      projectType,
      lengthFt: Number(lengthFt) || 10,
      widthFt: Number(widthFt) || 10,
      heightFt: Number(heightFt) || 10,
      wastagePercent: Number(wastagePercent) || 5,
    });

    const enriched = res.lines.map((line) => {
      const match = products.find((p) =>
        p.name.toLowerCase().includes(line.materialHint.toLowerCase()),
      );
      const validPrice = match && typeof match.price === "number" && match.price > 0 ? match.price : null;
      return {
        ...line,
        matchedProductId: match?.id ?? null,
        matchedProductName: match?.name ?? null,
        unitPrice: validPrice,
        estimatedCost: validPrice ? Math.round(validPrice * line.quantity) : null,
      };
    });

    setAreaSqFt(res.areaSqFt);
    setLines(enriched);
  }

  function updateQuantity(key: string, qty: number) {
    if (!lines || qty <= 0) return;
    setLines(
      lines.map((l) =>
        l.key === key
          ? {
              ...l,
              quantity: qty,
              estimatedCost: l.unitPrice ? Math.round(l.unitPrice * qty) : null,
            }
          : l,
      ),
    );
  }

  function removeLine(key: string) {
    if (!lines) return;
    setLines(lines.filter((l) => l.key !== key));
  }

  function downloadReport() {
    if (!lines) return;
    const textLines = [
      "Sagar Traders — Approximate Material Estimate Report",
      `Project Type: ${PROJECT_TYPE_LABELS[projectType]}`,
      `Measurements: ${lengthFt} ft × ${widthFt} ft (Height: ${heightFt} ft), Wastage: ${wastagePercent}%`,
      "",
      ...lines.map(
        (l) =>
          `- ${l.label}: ${l.quantity} ${l.unitLabel}${
            l.estimatedCost ? ` (Approx. ${formatRupees(l.estimatedCost)} based on ${l.matchedProductName})` : " (Rate on request)"
          } | Formula: ${l.formulaNote}`,
      ),
      "",
      ESTIMATOR_DISCLAIMER,
    ];
    const blob = new Blob([textLines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sagar-traders-material-estimate.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalEstimated =
    lines?.reduce((sum, l) => sum + (l.estimatedCost ?? 0), 0) ?? 0;
  const hasMissingPrices = Boolean(lines?.some((l) => !l.unitPrice));

  const waHref =
    lines && lines.length > 0
      ? buildWhatsAppUrl(
          whatsappNumber,
          `Hello Sagar Traders, please verify this approximate material estimate for ${PROJECT_TYPE_LABELS[projectType]}:\n${lines
            .map((l) => `- ${l.label}: ${l.quantity} ${l.unitLabel}`)
            .join("\n")}`,
        )
      : null;

  return (
    <div className="space-y-gutter-lg">
      <Card className="p-gutter-lg">
        <form className="space-y-gutter-md" onSubmit={runEstimate}>
          <Field
            label="What are you building?"
            helper="Choose the option closest to your work."
          >
            {(props) => (
              <Select
                {...props}
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as ProjectEstimateType)}
              >
                {Object.entries(PROJECT_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-gutter-sm sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Length (in feet)" helper="Example: 12 ft for a standard room">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="1"
                  step="0.5"
                  value={lengthFt}
                  onChange={(e) => setLengthFt(e.target.value)}
                  required
                />
              )}
            </Field>
            {projectType !== "WALL" && (
              <Field label="Width (in feet)" helper="Example: 10 ft">
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min="1"
                    step="0.5"
                    value={widthFt}
                    onChange={(e) => setWidthFt(e.target.value)}
                    required
                  />
                )}
              </Field>
            )}
            {(projectType === "ROOM" || projectType === "WALL") && (
              <Field label="Wall Height (in feet)" helper="Example: 10 ft ceiling height">
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    min="1"
                    step="0.5"
                    value={heightFt}
                    onChange={(e) => setHeightFt(e.target.value)}
                    required
                  />
                )}
              </Field>
            )}
            <Field label="Wastage (%)" helper="Usually 5% to 10%">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="0"
                  max="30"
                  value={wastagePercent}
                  onChange={(e) => setWastagePercent(e.target.value)}
                />
              )}
            </Field>
          </div>

          <Button type="submit" size="lg">
            Calculate Approximate Materials &amp; Cost
          </Button>
        </form>
      </Card>

      {lines && (
        <Card className="p-gutter-lg space-y-gutter-md">
          <div className="flex flex-wrap items-center justify-between gap-gutter-sm">
            <div>
              <h2 className="text-headline-sm text-primary">
                Approximate Material Breakdown ({areaSqFt?.toFixed(1)} sq ft)
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                You can adjust quantities or remove items below before sending to Sagar Traders.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={downloadReport}>
              <Download aria-hidden className="size-4" />
              Download Estimate
            </Button>
          </div>

          <div className="space-y-gutter-sm">
            {lines.map((l) => (
              <div
                key={l.key}
                className="flex flex-wrap items-center justify-between gap-gutter-md rounded border border-border p-gutter-md"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-title-md font-semibold text-on-surface">{l.label}</p>
                  <p className="text-body-sm text-on-surface-variant">Formula: {l.formulaNote}</p>
                  {l.matchedProductName ? (
                    <p className="text-body-sm text-on-surface-variant">
                      Catalogue match: {l.matchedProductName} —{" "}
                      {l.unitPrice ? `${formatRupees(l.unitPrice)} / ${l.unitLabel}` : "Rate on request"}
                    </p>
                  ) : (
                    <Badge tone="warning">Price not listed — confirm rate with team</Badge>
                  )}
                </div>

                <div className="flex items-center gap-gutter-sm">
                  <Input
                    aria-label={`Quantity for ${l.label}`}
                    type="number"
                    min="0.1"
                    step="any"
                    className="w-24 tabular-nums"
                    value={l.quantity}
                    onChange={(e) => updateQuantity(l.key, Number(e.target.value))}
                  />
                  <span className="text-body-sm text-on-surface-variant">{l.unitLabel}</span>
                  {l.estimatedCost && (
                    <span className="font-semibold text-primary tabular-nums">
                      ≈ {formatRupees(l.estimatedCost)}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${l.label}`}
                    onClick={() => removeLine(l.key)}
                  >
                    <Trash2 aria-hidden className="size-4 text-error" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded bg-surface-muted p-gutter-md space-y-2">
            <p className="text-title-md font-bold text-primary tabular-nums">
              {totalEstimated > 0
                ? `Indicative Material Subtotal (priced items only): ≈ ${formatRupees(totalEstimated)}`
                : "Indicative Cost: Request exact rates from Sagar Traders"}
            </p>
            {hasMissingPrices && (
              <p className="text-body-sm text-warning">
                Some materials do not have an active listed price in our catalogue and are excluded
                from the subtotal.
              </p>
            )}
            <p className="text-body-sm text-on-surface-variant">{ESTIMATOR_DISCLAIMER}</p>
          </div>

          <div className="flex flex-wrap gap-gutter-sm">
            <ButtonLink href="/bulk-enquiry" size="md">
              Send List for Exact Quotation
            </ButtonLink>
            {waHref && (
              <ButtonLink href={waHref} target="_blank" rel="noopener noreferrer" variant="outline" size="md">
                Verify on WhatsApp
              </ButtonLink>
            )}
            <Link href="/ask-expert" className="self-center text-label-lg text-primary hover:underline">
              Ask a Materials Expert →
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
