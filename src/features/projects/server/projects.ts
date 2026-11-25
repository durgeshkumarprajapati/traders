import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectImage, ProjectRecord, ProjectStatus } from "../types";

function mapProject(r: Record<string, unknown>, images: ProjectImage[] = []): ProjectRecord {
  return {
    id: String(r.id),
    title: String(r.title),
    slug: String(r.slug),
    description: String(r.description),
    category: String(r.category),
    location: (r.location as string) || null,
    completionDate: (r.completion_date as string) || null,
    materialsSupplied: Array.isArray(r.materials_supplied)
      ? r.materials_supplied.map(String)
      : [],
    brandsSupplied: Array.isArray(r.brands_supplied) ? r.brands_supplied.map(String) : [],
    customerTestimonial: (r.customer_testimonial as string) || null,
    customerDisplayName: (r.customer_display_name as string) || null,
    isAnonymized: Boolean(r.is_anonymized),
    authenticityConfirmed: Boolean(r.authenticity_confirmed),
    customerConsentObtained: Boolean(r.customer_consent_obtained),
    consentRecordedAt: (r.consent_recorded_at as string) || null,
    seoTitle: (r.seo_title as string) || null,
    seoDescription: (r.seo_description as string) || null,
    status: String(r.status) as ProjectStatus,
    publishedAt: (r.published_at as string) || null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    images,
  };
}

export async function listPublicProjects(): Promise<ProjectRecord[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data: rows } = await supabase
      .from("projects")
      .select("*")
      .eq("status", "PUBLISHED")
      .order("published_at", { ascending: false });

    if (!rows || rows.length === 0) return [];
    const ids = rows.map((r: { id: string }) => r.id);
    const { data: imgRows } = await supabase
      .from("project_images")
      .select("*")
      .in("project_id", ids)
      .order("position", { ascending: true });

    const imgsByProject: Record<string, ProjectImage[]> = {};
    for (const im of imgRows ?? []) {
      (imgsByProject[im.project_id] ??= []).push({
        id: String(im.id),
        projectId: String(im.project_id),
        imageUrl: String(im.image_url),
        cloudinaryPublicId: (im.cloudinary_public_id as string) || null,
        altText: String(im.alt_text),
        position: Number(im.position),
      });
    }
    return rows.map((r: Record<string, unknown>) => mapProject(r, imgsByProject[String(r.id)] ?? []));
  } catch {
    return [];
  }
}

export async function getPublicProjectBySlug(slug: string): Promise<ProjectRecord | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data: row } = await supabase
      .from("projects")
      .select("*")
      .eq("slug", slug)
      .eq("status", "PUBLISHED")
      .maybeSingle();

    if (!row) return null;
    const { data: imgRows } = await supabase
      .from("project_images")
      .select("*")
      .eq("project_id", row.id)
      .order("position", { ascending: true });

    const images: ProjectImage[] = (imgRows ?? []).map((im: Record<string, unknown>) => ({
      id: String(im.id),
      projectId: String(im.project_id),
      imageUrl: String(im.image_url),
      cloudinaryPublicId: (im.cloudinary_public_id as string) || null,
      altText: String(im.alt_text),
      position: Number(im.position),
    }));
    return mapProject(row, images);
  } catch {
    return null;
  }
}

export async function listAdminProjects(
  clientOverride?: SupabaseClient,
): Promise<ProjectRecord[]> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const { data: rows } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  return (rows ?? []).map((r: Record<string, unknown>) => mapProject(r));
}

export async function getAdminProjectById(
  id: string,
  clientOverride?: SupabaseClient,
): Promise<ProjectRecord | null> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const { data: row } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const { data: imgRows } = await supabase
    .from("project_images")
    .select("*")
    .eq("project_id", id)
    .order("position", { ascending: true });

  const images: ProjectImage[] = (imgRows ?? []).map((im) => ({
    id: String(im.id),
    projectId: String(im.project_id),
    imageUrl: String(im.image_url),
    cloudinaryPublicId: (im.cloudinary_public_id as string) || null,
    altText: String(im.alt_text),
    position: Number(im.position),
  }));
  return mapProject(row, images);
}
