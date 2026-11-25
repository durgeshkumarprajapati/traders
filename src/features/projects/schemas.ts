import { z } from "zod";
import { PROJECT_STATUSES } from "./types";

export const projectImageInputSchema = z.object({
  imageUrl: z
    .string()
    .trim()
    .url()
    .refine((u) => u.startsWith("https://res.cloudinary.com/"), {
      message: "Image URL must be a valid HTTPS Cloudinary URL.",
    }),
  cloudinaryPublicId: z.string().trim().max(200).nullable().optional(),
  altText: z.string().trim().min(2, "Alt text is required").max(200),
});

export const saveProjectSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(3).max(200),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
    description: z.string().trim().min(10).max(5000),
    category: z.string().trim().min(2).max(100),
    location: z.string().trim().max(200).nullable().optional(),
    completionDate: z.string().nullable().optional(),
    materialsSupplied: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
    brandsSupplied: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
    customerTestimonial: z.string().trim().max(2000).nullable().optional(),
    customerDisplayName: z.string().trim().max(120).nullable().optional(),
    isAnonymized: z.boolean().default(false),
    authenticityConfirmed: z.boolean().default(false),
    customerConsentObtained: z.boolean().default(false),
    seoTitle: z.string().trim().max(120).nullable().optional(),
    seoDescription: z.string().trim().max(300).nullable().optional(),
    status: z.enum(PROJECT_STATUSES).default("DRAFT"),
    images: z.array(projectImageInputSchema).max(12).default([]),
  })
  .superRefine((val, ctx) => {
    if (val.status === "PUBLISHED") {
      if (!val.authenticityConfirmed) {
        ctx.addIssue({
          code: "custom",
          path: ["authenticityConfirmed"],
          message: "You must confirm that the project details are genuine before publishing.",
        });
      }
      const hasIdentifiableInfo =
        !val.isAnonymized &&
        (Boolean(val.customerDisplayName?.trim()) || Boolean(val.customerTestimonial?.trim()));
      if (hasIdentifiableInfo && !val.customerConsentObtained) {
        ctx.addIssue({
          code: "custom",
          path: ["customerConsentObtained"],
          message:
            "Customer consent is required before publishing identifiable customer names or testimonials.",
        });
      }
    }
  });
