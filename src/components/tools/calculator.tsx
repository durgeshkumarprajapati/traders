"use client";

import { useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { Notification } from "@/components/ui/notification";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import {
  DEFAULT_WASTAGE_PERCENT,
  ESTIMATE_DISCLAIMER,
  LENGTH_UNITS,
  MIX_RATIOS,
  STEEL_DIAMETERS_MM,
  STEEL_DISCLAIMER,
  UNIT_SIZE_PRESETS,
  type LengthUnit,
  type MixRatioId,
} from "@/features/calculator/config";
import {
  calculateConcrete,
  calculateMasonry,
  calculateMix,
  calculateSteelBars,
  calculateSteelMesh,
  type CalcOutcome,
} from "@/features/calculator/calculate";
import type { EnquiryCatalogueItem } from "@/features/enquiries/types";
import { AddMaterialsPanel } from "./material-picker";

const num = (s: string | undefined) =>
  s === undefined || s.trim() === "" ? Number.NaN : Number(s);
const n = (v: number) => v.toLocaleString("en-IN", { maximumFractionDigits: 3 });

type Values = Record<string, string>;
function useValues(initial: Values) {
  const [v, setV] = useState<Values>(initial);
  const set = (k: string) => (e: { target: { value: string } }) =>
    setV((p) => ({ ...p, [k]: e.target.value }));
  return [v, set, setV] as const;
}

function NumberField({
  label,
  name,
  v,
  set,
  errors,
  helper,
  required = true,
}: {
  label: string;
  name: string;
  v: Values;
  set: ReturnType<typeof useValues>[1];
  errors?: Record<string, string>;
  helper?: string;
  required?: boolean;
}) {
  return (
    <Field label={label} required={required} error={errors?.[name]} helper={helper}>
      {(p) => (
        <Input
          {...p}
          name={name}
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={v[name] ?? ""}
          onChange={set(name)}
        />
      )}
    </Field>
  );
}

function UnitField({
  v,
  set,
  errors,
  label = "Measurement unit",
}: {
  v: Values;
  set: ReturnType<typeof useValues>[1];
  errors?: Record<string, string>;
  label?: string;
}) {
  return (
    <Field label={label} required error={errors?.unit}>
      {(p) => (
        <Select {...p} name="unit" value={v.unit} onChange={set("unit")}>
          {Object.entries(LENGTH_UNITS).map(([k, u]) => (
            <option key={k} value={k}>
              {u.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function Result({
  outcome,
  steel,
  catalogue,
  heading,
}: {
  outcome: CalcOutcome | null;
  steel?: boolean;
  catalogue: EnquiryCatalogueItem[];
  heading: string;
}) {
  if (!outcome) return null;
  if (!outcome.ok) {
    return (
      <Notification tone="error" title="Please check the highlighted fields">
        {Object.values(outcome.errors).join(" ")}
      </Notification>
    );
  }
  const { result } = outcome;
  return (
    <section aria-live="polite" className="space-y-gutter-md">
      <h3 className="text-title-lg font-bold text-primary">Estimate</h3>
      {result.summary.length > 0 && (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {result.summary.map((s, i) => (
            <div key={i} className="rounded border border-border p-gutter-sm">
              <dt className="text-label-md text-on-surface-variant">{s.label}</dt>
              <dd className="text-title-md font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {result.rows.length > 0 && (
        <Table stacked>
          <caption className="sr-only">Estimated quantities</caption>
          <THead>
            <Tr>
              <Th>Material</Th>
              <Th className="text-right">Estimated (exact)</Th>
              <Th className="text-right">With wastage</Th>
              <Th className="text-right">Suggested purchase (rounded up)</Th>
            </Tr>
          </THead>
          <TBody>
            {result.rows.map((r) => (
              <Tr key={r.key}>
                <Td label="Material" className="font-medium">
                  {r.label}
                </Td>
                <Td label="Estimated (exact)" className="md:text-right">
                  {n(r.theoretical)} {r.unit}
                </Td>
                <Td label="With wastage" className="md:text-right">
                  {n(r.withWastage)} {r.unit}
                </Td>
                <Td label="Suggested purchase" className="font-semibold md:text-right">
                  {n(r.suggested)} {r.unit}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <details open className="rounded border border-border p-gutter-sm">
        <summary className="cursor-pointer text-title-md font-semibold">
          How this was calculated
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-body-md">
          {result.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </details>
      <details className="rounded border border-border p-gutter-sm">
        <summary className="cursor-pointer text-title-md font-semibold">Assumptions used</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-body-md">
          {result.assumptions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </details>
      <Notification
        tone={steel ? "warning" : "info"}
        title={steel ? "Preliminary steel estimate" : "Approximate estimate"}
      >
        {steel ? STEEL_DISCLAIMER : ESTIMATE_DISCLAIMER}
      </Notification>
      {result.rows.length > 0 && (
        <AddMaterialsPanel
          key={JSON.stringify(result.rows)}
          rows={result.rows.map((r) => ({ label: r.label, quantity: r.suggested, unit: r.unit }))}
          catalogue={catalogue}
          heading={heading}
        />
      )}
    </section>
  );
}

function ConcreteCalc({ catalogue }: { catalogue: EnquiryCatalogueItem[] }) {
  const [v, set] = useValues({ length: "", width: "", depth: "", unit: "ft" });
  const [out, setOut] = useState<CalcOutcome | null>(null);
  const errors = out && !out.ok ? out.errors : undefined;
  return (
    <form
      noValidate
      className="space-y-gutter-md"
      onSubmit={(e) => {
        e.preventDefault();
        setOut(
          calculateConcrete({
            length: num(v.length),
            width: num(v.width),
            depth: num(v.depth),
            unit: v.unit as LengthUnit,
          }),
        );
      }}
    >
      <p className="text-body-md text-on-surface-variant">
        Volume of a slab, footing or floor: length × width × depth.
      </p>
      <div className="grid grid-cols-1 gap-gutter-md sm:grid-cols-2">
        <UnitField v={v} set={set} errors={errors} />
        <NumberField label="Length" name="length" v={v} set={set} errors={errors} />
        <NumberField label="Width" name="width" v={v} set={set} errors={errors} />
        <NumberField label="Depth or thickness" name="depth" v={v} set={set} errors={errors} />
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-auto">
        Calculate volume
      </Button>
      <Result outcome={out} catalogue={catalogue} heading="Concrete estimate (calculator)" />
      {out?.ok && (
        <p className="text-body-md">
          Need cement, sand and aggregate for this volume? Use the{" "}
          <strong>Cement, sand &amp; aggregate</strong> tab with the same dimensions.
        </p>
      )}
    </form>
  );
}

function MixCalc({ catalogue }: { catalogue: EnquiryCatalogueItem[] }) {
  const [v, set] = useValues({
    length: "",
    width: "",
    depth: "",
    unit: "ft",
    mix: "",
    wastage: String(DEFAULT_WASTAGE_PERCENT),
  });
  const [out, setOut] = useState<CalcOutcome | null>(null);
  const errors = out && !out.ok ? out.errors : undefined;
  return (
    <form
      noValidate
      className="space-y-gutter-md"
      onSubmit={(e) => {
        e.preventDefault();
        setOut(
          calculateMix({
            length: num(v.length),
            width: num(v.width),
            depth: num(v.depth),
            unit: v.unit as LengthUnit,
            mix: v.mix as MixRatioId,
            wastagePercent: num(v.wastage),
          }),
        );
      }}
    >
      <p className="text-body-md text-on-surface-variant">
        Cement, sand and aggregate for a volume of concrete at a chosen mix ratio (cement : sand :
        aggregate by volume).
      </p>
      <div className="grid grid-cols-1 gap-gutter-md sm:grid-cols-2">
        <UnitField v={v} set={set} errors={errors} />
        <Field
          label="Mix ratio"
          required
          error={errors?.mix}
          helper="Used for the arithmetic only — whether a ratio suits your element is for an engineer to decide."
        >
          {(p) => (
            <Select {...p} name="mix" value={v.mix} onChange={set("mix")}>
              <option value="">Choose a ratio</option>
              {MIX_RATIOS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <NumberField label="Length" name="length" v={v} set={set} errors={errors} />
        <NumberField label="Width" name="width" v={v} set={set} errors={errors} />
        <NumberField label="Depth or thickness" name="depth" v={v} set={set} errors={errors} />
        <NumberField
          label="Wastage (%)"
          name="wastage"
          v={v}
          set={set}
          errors={errors}
          required={false}
          helper="0–25%. Allows for spillage and over-measurement."
        />
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-auto">
        Calculate materials
      </Button>
      <Result
        outcome={out}
        catalogue={catalogue}
        heading="Concrete materials estimate (calculator)"
      />
    </form>
  );
}

function MasonryCalc({ catalogue }: { catalogue: EnquiryCatalogueItem[] }) {
  const [v, set, setV] = useValues({
    kind: "brick",
    wallLength: "",
    wallHeight: "",
    wallThickness: "",
    unit: "ft",
    openingArea: "",
    preset: "",
    unitLength: "",
    unitWidth: "",
    unitHeight: "",
    jointMm: "",
    wastage: String(DEFAULT_WASTAGE_PERCENT),
  });
  const [out, setOut] = useState<CalcOutcome | null>(null);
  const errors = out && !out.ok ? out.errors : undefined;
  const presets = UNIT_SIZE_PRESETS.filter((p) => p.kind === v.kind);
  const word = v.kind === "brick" ? "Brick" : "Block";
  return (
    <form
      noValidate
      className="space-y-gutter-md"
      onSubmit={(e) => {
        e.preventDefault();
        setOut(
          calculateMasonry({
            kind: v.kind as "brick" | "block",
            wallLength: num(v.wallLength),
            wallHeight: num(v.wallHeight),
            wallThickness: num(v.wallThickness),
            unit: v.unit as LengthUnit,
            openingArea: v.openingArea.trim() === "" ? 0 : num(v.openingArea),
            unitLength: num(v.unitLength),
            unitWidth: num(v.unitWidth),
            unitHeight: num(v.unitHeight),
            jointMm: num(v.jointMm),
            wastagePercent: num(v.wastage),
          }),
        );
      }}
    >
      <p className="text-body-md text-on-surface-variant">
        Number of bricks or blocks for a wall, counted by volume. You choose the size — nothing is
        assumed.
      </p>
      <div className="grid grid-cols-1 gap-gutter-md sm:grid-cols-2">
        <Field label="Material" required>
          {(p) => (
            <Select
              {...p}
              value={v.kind}
              onChange={(e) =>
                setV((x) => ({
                  ...x,
                  kind: e.target.value,
                  preset: "",
                  unitLength: "",
                  unitWidth: "",
                  unitHeight: "",
                }))
              }
            >
              <option value="brick">Bricks</option>
              <option value="block">Blocks</option>
            </Select>
          )}
        </Field>
        <UnitField v={v} set={set} errors={errors} label="Wall measurement unit" />
        <NumberField label="Wall length" name="wallLength" v={v} set={set} errors={errors} />
        <NumberField label="Wall height" name="wallHeight" v={v} set={set} errors={errors} />
        <NumberField label="Wall thickness" name="wallThickness" v={v} set={set} errors={errors} />
        <NumberField
          label="Openings area (doors, windows)"
          name="openingArea"
          v={v}
          set={set}
          errors={errors}
          required={false}
          helper="In square units of the unit above. Leave blank for none."
        />
      </div>
      <fieldset className="space-y-gutter-md rounded border border-border p-gutter-md">
        <legend className="px-1 text-title-md font-semibold">{word} size (millimetres)</legend>
        <Field
          label="Start from a typical size"
          helper="Typical nominal sizes only — real products vary by maker. Check your product, or type your own below."
        >
          {(p) => (
            <Select
              {...p}
              value={v.preset}
              onChange={(e) => {
                const pr = UNIT_SIZE_PRESETS.find((x) => x.id === e.target.value);
                setV((x) => ({
                  ...x,
                  preset: e.target.value,
                  ...(pr
                    ? {
                        unitLength: String(pr.length),
                        unitWidth: String(pr.width),
                        unitHeight: String(pr.height),
                      }
                    : {}),
                }));
              }}
            >
              <option value="">Enter my own size</option>
              {presets.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-1 gap-gutter-md sm:grid-cols-4">
          <NumberField
            label={`${word} length (mm)`}
            name="unitLength"
            v={v}
            set={set}
            errors={errors}
          />
          <NumberField
            label={`${word} width (mm)`}
            name="unitWidth"
            v={v}
            set={set}
            errors={errors}
          />
          <NumberField
            label={`${word} height (mm)`}
            name="unitHeight"
            v={v}
            set={set}
            errors={errors}
          />
          <NumberField
            label="Mortar joint (mm)"
            name="jointMm"
            v={v}
            set={set}
            errors={errors}
            helper="0 for none."
          />
        </div>
      </fieldset>
      <NumberField
        label="Wastage (%)"
        name="wastage"
        v={v}
        set={set}
        errors={errors}
        required={false}
        helper="0–25%. Allows for breakage and cutting."
      />
      <Button type="submit" size="lg" className="w-full sm:w-auto">
        Calculate {v.kind === "brick" ? "bricks" : "blocks"}
      </Button>
      <Result outcome={out} catalogue={catalogue} heading={`${word} estimate (calculator)`} />
    </form>
  );
}

function SteelCalc({ catalogue }: { catalogue: EnquiryCatalogueItem[] }) {
  const [mode, setMode] = useState<"bars" | "mesh" | "unsure">("bars");
  const [v, set] = useValues({
    unit: "m",
    diameter: "",
    barCount: "",
    barLength: "",
    panelLength: "",
    panelWidth: "",
    spacing: "",
  });
  const [out, setOut] = useState<CalcOutcome | null>(null);
  const errors = out && !out.ok ? out.errors : undefined;
  const diameter = (
    <Field label="Bar diameter" required error={errors?.diameter}>
      {(p) => (
        <Select {...p} value={v.diameter} onChange={set("diameter")}>
          <option value="">Choose a diameter</option>
          {STEEL_DIAMETERS_MM.map((d) => (
            <option key={d} value={d}>
              {d} mm
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
  return (
    <div className="space-y-gutter-md">
      <Notification tone="warning" title="Preliminary estimates only">
        {STEEL_DISCLAIMER}
      </Notification>
      <p className="text-body-md text-on-surface-variant">
        Steel is not estimated from floor area. Use a method below only if you already know the bar
        details from drawings.
      </p>
      <div role="group" aria-label="Steel method" className="flex flex-wrap gap-2">
        {(
          [
            ["bars", "Bars of known length"],
            ["mesh", "Bars in a panel at a set spacing"],
            ["unsure", "I don’t have these details"],
          ] as const
        ).map(([k, label]) => (
          <Button
            key={k}
            type="button"
            variant={mode === k ? "primary" : "outline"}
            aria-pressed={mode === k}
            onClick={() => {
              setMode(k);
              setOut(null);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {mode === "unsure" ? (
        <div className="space-y-2 rounded border border-border p-gutter-md">
          <p className="text-body-md">
            Without bar diameters, spacing and lengths from approved structural drawings, a reliable
            steel quantity cannot be estimated. Please ask the Sagar Traders team to prepare an
            estimate with you.
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/ask-expert">Ask a materials expert</ButtonLink>
            <ButtonLink href="/contact" variant="outline">
              Contact us
            </ButtonLink>
          </div>
        </div>
      ) : (
        <form
          noValidate
          className="space-y-gutter-md"
          onSubmit={(e) => {
            e.preventDefault();
            setOut(
              mode === "bars"
                ? calculateSteelBars({
                    diameterMm: num(v.diameter),
                    barCount: num(v.barCount),
                    barLength: num(v.barLength),
                    unit: v.unit as LengthUnit,
                  })
                : calculateSteelMesh({
                    panelLength: num(v.panelLength),
                    panelWidth: num(v.panelWidth),
                    spacing: num(v.spacing),
                    diameterMm: num(v.diameter),
                    unit: v.unit as LengthUnit,
                  }),
            );
          }}
        >
          <div className="grid grid-cols-1 gap-gutter-md sm:grid-cols-2">
            <UnitField v={v} set={set} errors={errors} />
            {diameter}
            {mode === "bars" ? (
              <>
                <NumberField
                  label="Number of bars"
                  name="barCount"
                  v={v}
                  set={set}
                  errors={errors}
                  helper="A whole number."
                />
                <NumberField
                  label="Length of each bar"
                  name="barLength"
                  v={v}
                  set={set}
                  errors={errors}
                />
              </>
            ) : (
              <>
                <NumberField
                  label="Panel length"
                  name="panelLength"
                  v={v}
                  set={set}
                  errors={errors}
                />
                <NumberField
                  label="Panel width"
                  name="panelWidth"
                  v={v}
                  set={set}
                  errors={errors}
                />
                <NumberField
                  label="Bar spacing (centre to centre)"
                  name="spacing"
                  v={v}
                  set={set}
                  errors={errors}
                  helper="Same unit as above."
                />
              </>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full sm:w-auto">
            Calculate steel weight
          </Button>
          <Result
            outcome={out}
            steel
            catalogue={catalogue}
            heading="Steel estimate (calculator) — preliminary, to be confirmed by a structural engineer"
          />
        </form>
      )}
    </div>
  );
}

export function MaterialCalculator({
  catalogue,
  catalogueNote,
}: {
  catalogue: EnquiryCatalogueItem[];
  catalogueNote?: string;
}) {
  return (
    <div className="space-y-gutter-lg">
      <Notification tone="info" title="Estimates, not specifications">
        <span className="flex items-start gap-2">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {ESTIMATE_DISCLAIMER} Every assumption is shown with each result. Want to keep several
            calculations together? Use the{" "}
            <Link href="/tools/project-planner" className="font-semibold text-primary underline">
              project planner
            </Link>
            .
          </span>
        </span>
      </Notification>
      {catalogueNote && <Notification tone="warning">{catalogueNote}</Notification>}
      <Tabs
        label="Calculators"
        items={[
          { id: "concrete", label: "Concrete", content: <ConcreteCalc catalogue={catalogue} /> },
          {
            id: "mix",
            label: "Cement, sand & aggregate",
            content: <MixCalc catalogue={catalogue} />,
          },
          {
            id: "masonry",
            label: "Bricks & blocks",
            content: <MasonryCalc catalogue={catalogue} />,
          },
          { id: "steel", label: "Steel", content: <SteelCalc catalogue={catalogue} /> },
        ]}
      />
    </div>
  );
}
