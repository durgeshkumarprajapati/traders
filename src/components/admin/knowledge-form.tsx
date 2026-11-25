"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { saveKnowledgeArticleAction } from "@/features/knowledge/actions";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_STATUSES,
  type KnowledgeArticle,
} from "@/features/knowledge/types";

export function KnowledgeForm({ article }: { article?: KnowledgeArticle }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [category, setCategory] = useState(article?.category ?? KNOWLEDGE_CATEGORIES[0]);
  const [tags, setTags] = useState((article?.tags ?? []).join(", "));
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [body, setBody] = useState(article?.body ?? "");
  const [technicalReviewed, setTechnicalReviewed] = useState(article?.technicalReviewed ?? false);
  const [status, setStatus] = useState(article?.status ?? "DRAFT");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveKnowledgeArticleAction({
        id: article?.id,
        title,
        slug,
        category,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        summary,
        body,
        technicalReviewed,
        status,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.push("/admin/knowledge");
      router.refresh();
    });
  }

  return (
    <Card className="p-gutter-lg">
      <form className="space-y-gutter-md" onSubmit={handleSubmit}>
        {error && (
          <div role="alert" className="rounded border border-error bg-error/10 p-3 text-error">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 gap-gutter-sm sm:grid-cols-2">
          <Field label="Title" required>
            {(props) => <Input {...props} value={title} onChange={(e) => setTitle(e.target.value)} required />}
          </Field>
          <Field label="Slug" required>
            {(props) => (
              <Input
                {...props}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. cement-storage-guide"
                required
              />
            )}
          </Field>
          <Field label="Category">
            {(props) => (
              <Select {...props} value={category} onChange={(e) => setCategory(e.target.value)}>
                {KNOWLEDGE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Status">
            {(props) => (
              <Select
                {...props}
                value={status}
                onChange={(e) => setStatus(e.target.value as (typeof KNOWLEDGE_STATUSES)[number])}
              >
                {KNOWLEDGE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Tags (comma-separated)">
          {(props) => <Input {...props} value={tags} onChange={(e) => setTags(e.target.value)} />}
        </Field>
        <Field label="Plain-Language Summary" required>
          {(props) => <Textarea {...props} rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} required />}
        </Field>
        <Field label="Article Content" required>
          {(props) => <Textarea {...props} rows={8} value={body} onChange={(e) => setBody(e.target.value)} required />}
        </Field>

        <label className="flex items-center gap-2 rounded bg-surface-muted p-3 text-body-sm">
          <input
            type="checkbox"
            checked={technicalReviewed}
            onChange={(e) => setTechnicalReviewed(e.target.checked)}
          />
          <span>I confirm this technical/educational guidance has been reviewed for accuracy.</span>
        </label>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save Article"}
        </Button>
      </form>
    </Card>
  );
}
