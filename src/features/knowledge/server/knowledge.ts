import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_KNOWLEDGE_ARTICLES } from "../default-guides";
import type { KnowledgeArticle, KnowledgeStatus } from "../types";

function mapArticle(r: Record<string, unknown>): KnowledgeArticle {
  return {
    id: String(r.id),
    title: String(r.title),
    slug: String(r.slug),
    category: String(r.category),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    summary: String(r.summary),
    body: String(r.body),
    translations:
      r.translations && typeof r.translations === "object"
        ? (r.translations as KnowledgeArticle["translations"])
        : {},
    relatedProductSlugs: Array.isArray(r.related_product_slugs)
      ? r.related_product_slugs.map(String)
      : [],
    technicalReviewed: Boolean(r.technical_reviewed),
    status: String(r.status) as KnowledgeStatus,
    publishedAt: (r.published_at as string) || null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listPublicKnowledgeArticles(): Promise<KnowledgeArticle[]> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("knowledge_articles")
      .select("*")
      .eq("status", "PUBLISHED")
      .order("published_at", { ascending: false });

    const dbArticles = (data ?? []).map((r: Record<string, unknown>) => mapArticle(r));
    const dbSlugs = new Set(dbArticles.map((a) => a.slug));
    const fallback = DEFAULT_KNOWLEDGE_ARTICLES.filter((a) => !dbSlugs.has(a.slug));
    return [...dbArticles, ...fallback];
  } catch {
    return DEFAULT_KNOWLEDGE_ARTICLES;
  }
}

export async function getPublicKnowledgeArticleBySlug(
  slug: string,
): Promise<KnowledgeArticle | null> {
  try {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("knowledge_articles")
      .select("*")
      .eq("slug", slug)
      .eq("status", "PUBLISHED")
      .maybeSingle();
    if (data) return mapArticle(data);
  } catch {
    /* fallback to built-in guides */
  }
  return DEFAULT_KNOWLEDGE_ARTICLES.find((a) => a.slug === slug) ?? null;
}

export async function listAdminKnowledgeArticles(
  clientOverride?: SupabaseClient,
): Promise<KnowledgeArticle[]> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const { data } = await supabase
    .from("knowledge_articles")
    .select("*")
    .order("updated_at", { ascending: false });
  return (data ?? []).map((r: Record<string, unknown>) => mapArticle(r));
}

export async function getAdminKnowledgeArticleById(
  id: string,
  clientOverride?: SupabaseClient,
): Promise<KnowledgeArticle | null> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const { data } = await supabase
    .from("knowledge_articles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapArticle(data) : null;
}
