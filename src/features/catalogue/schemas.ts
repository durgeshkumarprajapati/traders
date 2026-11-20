import { z } from "zod";
import { STOCK_STATUSES } from "@/features/products/stock";
import { UNIT_CODES, isValidUnit, type UnitCode } from "@/features/products/units";

/** Error text shared with the issue-code mapper in parse.ts. */
export const REQUIRED = "is required";

export const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const text = (max: number) => z.string().trim().max(max, `must be at most ${max} characters`);
const required = (max: number) => text(max).min(1, REQUIRED);

const id = z
  .string()
  .trim()
  .min(1, REQUIRED)
  .regex(
    /^[A-Za-z0-9_-]{1,64}$/,
    "may only contain letters, digits, '_' and '-' (max 64 characters)",
  );

const slug = z
  .string()
  .trim()
  .min(1, REQUIRED)
  .max(80, "must be at most 80 characters")
  .regex(
    slugRe,
    "must be lowercase letters and digits separated by single hyphens, e.g. 'my-product'",
  );

const bool = z.boolean({
  error: (iss) => (iss.input === undefined ? REQUIRED : "must be TRUE or FALSE"),
});

const enumOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .trim()
    .min(1, REQUIRED)
    .transform((s) => s.toUpperCase())
    .pipe(z.enum(values, { error: `must be one of: ${values.join(", ")}` }));

/** Hard (row-excluding) contract for a Products row. Input: cells coerced to text; booleans pre-parsed. */
export const productRowSchema = z
  .object({
    product_id: id,
    product_name: required(200),
    slug,
    sku: text(64).regex(/^[A-Za-z0-9._/-]*$/, "may only contain letters, digits and . _ / -"),
    category_id: id,
    brand_id: id,
    description: text(10000),
    unit: enumOf(UNIT_CODES),
    unit_custom: text(40),
    stock_status: enumOf(STOCK_STATUSES),
    is_featured: bool,
    is_active: bool,
  })
  .superRefine((row, ctx) => {
    // CUSTOM needs a display label; any other unit must not carry one. Units are never converted.
    if (!isValidUnit({ code: row.unit as UnitCode, customLabel: row.unit_custom })) {
      ctx.addIssue({
        code: "custom",
        path: ["unit_custom"],
        message:
          row.unit === "CUSTOM"
            ? "is required when unit is CUSTOM"
            : "must be empty unless unit is CUSTOM",
      });
    }
  });

export const categoryRowSchema = z.object({
  category_id: id,
  category_name: required(100),
  slug,
  description: text(1000),
  is_active: bool,
});

export const brandRowSchema = z.object({
  brand_id: id,
  brand_name: required(100),
  slug,
  description: text(1000),
  is_active: bool,
});

/** Soft field: specifications JSON. */
export const specificationsSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(100),
      value: z.string().trim().min(1).max(500),
    }),
  )
  .max(50);

/** Soft field: indicative price. Positive, bounded, never coerced from invalid input. */
export const priceSchema = z.number().positive().max(1_000_000_000);

/** Soft field: category display order. */
export const displayOrderSchema = z.number().int().min(0).max(100000);
