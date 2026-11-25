"use server";

import { revalidatePath } from "next/cache";
import { withAdminAction, type AdminActionResult } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import { saveProjectSchema } from "./schemas";
import type { ProjectStatus } from "./types";

export async function saveProjectAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string; slug: string }>> {
  const parsed = saveProjectSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid project details.",
    };
  }
  const v = parsed.data;
  return withAdminAction("saveProject", async (admin, client) => {
    const payload = {
      title: v.title,
      slug: v.slug,
      description: v.description,
      category: v.category,
      location: v.location || null,
      completion_date: v.completionDate || null,
      materials_supplied: v.materialsSupplied,
      brands_supplied: v.brandsSupplied,
      customer_testimonial: v.customerTestimonial || null,
      customer_display_name: v.customerDisplayName || null,
      is_anonymized: v.isAnonymized,
      authenticity_confirmed: v.authenticityConfirmed,
      customer_consent_obtained: v.customerConsentObtained,
      consent_recorded_at: v.customerConsentObtained ? new Date().toISOString() : null,
      seo_title: v.seoTitle || null,
      seo_description: v.seoDescription || null,
      status: v.status,
      published_at: v.status === "PUBLISHED" ? new Date().toISOString() : null,
      created_by: admin.id,
    };

    let projectId = v.id;
    if (projectId) {
      const { error } = await client.from("projects").update(payload).eq("id", projectId);
      if (error) throw new AppError("INTERNAL", "Failed to update project.");
      await client.from("project_images").delete().eq("project_id", projectId);
    } else {
      const { data, error } = await client
        .from("projects")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) throw new AppError("INTERNAL", "Failed to create project.");
      projectId = String(data.id);
    }

    if (v.images.length > 0) {
      const imgRows = v.images.map((im, idx) => ({
        project_id: projectId,
        image_url: im.imageUrl,
        cloudinary_public_id: im.cloudinaryPublicId ?? null,
        alt_text: im.altText,
        position: idx + 1,
      }));
      const { error: imgErr } = await client.from("project_images").insert(imgRows);
      if (imgErr) throw new AppError("INTERNAL", "Failed to save project images.");
    }

    await client.from("audit_logs").insert({
      actor_id: admin.id,
      actor_type: "ADMIN",
      action: v.status === "PUBLISHED" ? "PROJECT_PUBLISHED" : "PROJECT_SAVED",
      entity_type: "project",
      entity_id: projectId,
      details: { slug: v.slug, status: v.status },
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${v.slug}`);
    revalidatePath("/admin/projects");
    revalidatePath("/sitemap.xml");
    return { id: projectId, slug: v.slug };
  });
}

export async function updateProjectStatusAction(
  projectId: string,
  status: ProjectStatus,
): Promise<AdminActionResult<{ id: string; status: ProjectStatus }>> {
  return withAdminAction("updateProjectStatus", async (admin, client) => {
    const patch: Record<string, unknown> = { status };
    if (status === "PUBLISHED") patch.published_at = new Date().toISOString();
    const { error } = await client.from("projects").update(patch).eq("id", projectId);
    if (error) {
      throw new AppError(
        "VALIDATION",
        "Cannot publish project until authenticity and customer consent requirements are satisfied.",
      );
    }
    await client.from("audit_logs").insert({
      actor_id: admin.id,
      actor_type: "ADMIN",
      action: `PROJECT_${status}`,
      entity_type: "project",
      entity_id: projectId,
      details: { status },
    });
    revalidatePath("/projects");
    revalidatePath("/admin/projects");
    return { id: projectId, status };
  });
}
