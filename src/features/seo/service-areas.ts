import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ServiceAreaRecord {
  id: string;
  areaName: string;
  slug: string;
  description: string;
  deliveryCoverage: string | null;
  relevantProductIds: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: string;
}

function mapArea(r: Record<string, unknown>): ServiceAreaRecord {
  return {
    id: String(r.id),
    areaName: String(r.area_name),
    slug: String(r.slug),
    description: String(r.description),
    deliveryCoverage: (r.delivery_coverage as string) || null,
    relevantProductIds: Array.isArray(r.relevant_product_ids)
      ? r.relevant_product_ids.map(String)
      : [],
    seoTitle: (r.seo_title as string) || null,
    seoDescription: (r.seo_description as string) || null,
    status: String(r.status) as ServiceAreaRecord["status"],
    updatedAt: String(r.updated_at),
  };
}

export async function listPublicServiceAreas(): Promise<ServiceAreaRecord[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("service_areas")
      .select("*")
      .eq("status", "PUBLISHED")
      .order("area_name", { ascending: true });
    return (data ?? []).map((r: Record<string, unknown>) => mapArea(r));
  } catch {
    return [];
  }
}

export async function getPublicServiceAreaBySlug(slug: string): Promise<ServiceAreaRecord | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("service_areas")
      .select("*")
      .eq("slug", slug)
      .eq("status", "PUBLISHED")
      .maybeSingle();
    return data ? mapArea(data) : null;
  } catch {
    return null;
  }
}

export async function listAdminServiceAreas(
  clientOverride?: SupabaseClient,
): Promise<ServiceAreaRecord[]> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const { data } = await supabase
    .from("service_areas")
    .select("*")
    .order("area_name", { ascending: true });
  return (data ?? []).map((r: Record<string, unknown>) => mapArea(r));
}
