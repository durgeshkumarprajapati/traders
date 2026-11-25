"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { saveServiceAreaAction } from "@/features/seo/actions";
import type { ServiceAreaRecord } from "@/features/seo/service-areas";

export function ServiceAreasView({ areas }: { areas: ServiceAreaRecord[] }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [areaName, setAreaName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryCoverage, setDeliveryCoverage] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">("DRAFT");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveServiceAreaAction({
        areaName,
        slug,
        description,
        deliveryCoverage: deliveryCoverage.trim() || null,
        status,
      });
      if (res.ok) {
        setAreaName("");
        setSlug("");
        setDescription("");
        setDeliveryCoverage("");
        setFeedback(`Service area /areas/${res.data.slug} saved.`);
      } else {
        setFeedback(res.message);
      }
    });
  }

  return (
    <div className="space-y-gutter-lg">
      <div>
        <h1 className="text-headline-lg text-primary">Service Areas (Local SEO)</h1>
        <p className="text-body-md text-on-surface-variant">
          Create dedicated landing pages only for areas Sagar Traders genuinely serves.
        </p>
      </div>

      {feedback && (
        <div role="status" className="rounded border border-info bg-surface-muted px-4 py-2 text-body-md">
          {feedback}
        </div>
      )}

      <Card className="p-gutter-md">
        <h2 className="text-headline-sm text-primary">Add Service Area Page</h2>
        <form className="mt-gutter-sm space-y-gutter-sm" onSubmit={handleSave}>
          <div className="grid grid-cols-1 gap-gutter-sm sm:grid-cols-3">
            <Field label="Area Name" required>
              {(props) => (
                <Input
                  {...props}
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  placeholder="e.g. Raipur"
                  required
                />
              )}
            </Field>
            <Field label="URL Slug" required>
              {(props) => (
                <Input
                  {...props}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. raipur"
                  required
                />
              )}
            </Field>
            <Field label="Status">
              {(props) => (
                <Select
                  {...props}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </Select>
              )}
            </Field>
          </div>
          <Field label="Confirmed Delivery Coverage">
            {(props) => (
              <Input
                {...props}
                value={deliveryCoverage}
                onChange={(e) => setDeliveryCoverage(e.target.value)}
                placeholder="e.g. Raipur city and surrounding industrial corridors"
              />
            )}
          </Field>
          <Field label="Description" required>
            {(props) => (
              <Textarea
                {...props}
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            )}
          </Field>
          <Button type="submit" size="sm" disabled={pending}>
            Save Service Area
          </Button>
        </form>
      </Card>

      <div className="space-y-gutter-sm">
        {areas.map((a) => (
          <Card key={a.id} className="p-gutter-md flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-title-md font-semibold text-primary">{a.areaName}</span>
                <Badge tone={a.status === "PUBLISHED" ? "success" : "neutral"}>{a.status}</Badge>
              </div>
              <p className="text-body-sm text-on-surface-variant">/areas/{a.slug}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
