"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withAdminAction, type AdminActionResult } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";
import { KNOWLEDGE_STATUSES } from "./types";

const articleSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(3).max(200),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    category: z.string().trim().min(2).max(100),
    tags: z.array(z.string().trim().min(1).max(60)).max(15).default([]),
    summary: z.string().trim().min(10).max(500),
    body: z.string().trim().min(20).max(20000),
    technicalReviewed: z.boolean().default(false),
    status: z.enum(KNOWLEDGE_STATUSES).default("DRAFT"),
  })
  .superRefine((v, ctx) => {
    if (v.status === "PUBLISHED" && !v.technicalReviewed) {
      ctx.addIssue({
        code: "custom",
        path: ["technicalReviewed"],
        message: "Technical accuracy review must be confirmed before publishing.",
      });
    }
  });

export async function saveKnowledgeArticleAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string; slug: string }>> {
  const parsed = articleSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid article.",
    };
  }
  const v = parsed.data;
  return withAdminAction("saveKnowledgeArticle", async (admin, client) => {
    const payload = {
      title: v.title,
      slug: v.slug,
      category: v.category,
      tags: v.tags,
      summary: v.summary,
      body: v.body,
      technical_reviewed: v.technicalReviewed,
      status: v.status,
      published_at: v.status === "PUBLISHED" ? new Date().toISOString() : null,
      created_by: admin.id,
    };

    let id = v.id;
    if (id) {
      const { error } = await client.from("knowledge_articles").update(payload).eq("id", id);
      if (error) throw new AppError("INTERNAL", "Failed to update article.");
    } else {
      const { data, error } = await client
        .from("knowledge_articles")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) throw new AppError("INTERNAL", "Failed to create article.");
      id = String(data.id);
    }

    revalidatePath("/knowledge");
    revalidatePath(`/knowledge/${v.slug}`);
    revalidatePath("/admin/knowledge");
    revalidatePath("/sitemap.xml");
    return { id, slug: v.slug };
  });
}
