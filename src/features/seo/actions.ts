"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withAdminAction, type AdminActionResult } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";

const areaSchema = z.object({
  id: z.string().uuid().optional(),
  areaName: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(3000),
  deliveryCoverage: z.string().trim().max(300).nullable().optional(),
  seoTitle: z.string().trim().max(120).nullable().optional(),
  seoDescription: z.string().trim().max(300).nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});

export async function saveServiceAreaAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string; slug: string }>> {
  const parsed = areaSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid service area.",
    };
  }
  const v = parsed.data;
  return withAdminAction("saveServiceArea", async (_admin, client) => {
    const payload = {
      area_name: v.areaName,
      slug: v.slug,
      description: v.description,
      delivery_coverage: v.deliveryCoverage ?? null,
      seo_title: v.seoTitle ?? null,
      seo_description: v.seoDescription ?? null,
      status: v.status,
    };

    let areaId = v.id;
    if (areaId) {
      const { error } = await client.from("service_areas").update(payload).eq("id", areaId);
      if (error) throw new AppError("INTERNAL", "Failed to update service area.");
    } else {
      const { data, error } = await client
        .from("service_areas")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) throw new AppError("INTERNAL", "Failed to create service area.");
      areaId = String(data.id);
    }

    revalidatePath(`/areas/${v.slug}`);
    revalidatePath("/admin/service-areas");
    revalidatePath("/sitemap.xml");
    return { id: areaId, slug: v.slug };
  });
}
