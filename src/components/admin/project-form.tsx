"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { saveProjectAction } from "@/features/projects/actions";
import { PROJECT_STATUSES, type ProjectRecord } from "@/features/projects/types";

export function ProjectForm({ project }: { project?: ProjectRecord }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(project?.title ?? "");
  const [slug, setSlug] = useState(project?.slug ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [category, setCategory] = useState(project?.category ?? "Residential");
  const [location, setLocation] = useState(project?.location ?? "");
  const [completionDate, setCompletionDate] = useState(project?.completionDate ?? "");
  const [materials, setMaterials] = useState((project?.materialsSupplied ?? []).join(", "));
  const [brands, setBrands] = useState((project?.brandsSupplied ?? []).join(", "));
  const [testimonial, setTestimonial] = useState(project?.customerTestimonial ?? "");
  const [customerDisplayName, setCustomerDisplayName] = useState(
    project?.customerDisplayName ?? "",
  );
  const [isAnonymized, setIsAnonymized] = useState(project?.isAnonymized ?? false);
  const [authenticityConfirmed, setAuthenticityConfirmed] = useState(
    project?.authenticityConfirmed ?? false,
  );
  const [customerConsentObtained, setCustomerConsentObtained] = useState(
    project?.customerConsentObtained ?? false,
  );
  const [seoTitle, setSeoTitle] = useState(project?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(project?.seoDescription ?? "");
  const [status, setStatus] = useState(project?.status ?? "DRAFT");
  const [imageUrl, setImageUrl] = useState(project?.images[0]?.imageUrl ?? "");
  const [imageAlt, setImageAlt] = useState(project?.images[0]?.altText ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveProjectAction({
        id: project?.id,
        title,
        slug,
        description,
        category,
        location: location.trim() || null,
        completionDate: completionDate || null,
        materialsSupplied: materials
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        brandsSupplied: brands
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        customerTestimonial: testimonial.trim() || null,
        customerDisplayName: customerDisplayName.trim() || null,
        isAnonymized,
        authenticityConfirmed,
        customerConsentObtained,
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        status,
        images:
          imageUrl.trim() && imageAlt.trim()
            ? [{ imageUrl: imageUrl.trim(), altText: imageAlt.trim() }]
            : [],
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.push("/admin/projects");
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
          <Field label="Project Title" required>
            {(props) => <Input {...props} value={title} onChange={(e) => setTitle(e.target.value)} required />}
          </Field>
          <Field label="URL Slug" required>
            {(props) => (
              <Input
                {...props}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. raipur-residential-villa"
                required
              />
            )}
          </Field>
          <Field label="Category" required>
            {(props) => <Input {...props} value={category} onChange={(e) => setCategory(e.target.value)} required />}
          </Field>
          <Field label="Location">
            {(props) => <Input {...props} value={location} onChange={(e) => setLocation(e.target.value)} />}
          </Field>
          <Field label="Completion Date">
            {(props) => (
              <Input
                {...props}
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
              />
            )}
          </Field>
          <Field label="Status">
            {(props) => (
              <Select
                {...props}
                value={status}
                onChange={(e) => setStatus(e.target.value as (typeof PROJECT_STATUSES)[number])}
              >
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Project Description" required>
          {(props) => (
            <Textarea
              {...props}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          )}
        </Field>

        <div className="grid grid-cols-1 gap-gutter-sm sm:grid-cols-2">
          <Field label="Materials Supplied (comma-separated)">
            {(props) => (
              <Input
                {...props}
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
                placeholder="PPC Cement, Fe 550D TMT Rebars, AAC Blocks"
              />
            )}
          </Field>
          <Field label="Brands Supplied (comma-separated)">
            {(props) => <Input {...props} value={brands} onChange={(e) => setBrands(e.target.value)} />}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-gutter-sm sm:grid-cols-2">
          <Field label="Primary Photo URL (https://res.cloudinary.com/...)">
            {(props) => (
              <Input
                {...props}
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://res.cloudinary.com/..."
              />
            )}
          </Field>
          <Field label="Photo Alt Text">
            {(props) => <Input {...props} value={imageAlt} onChange={(e) => setImageAlt(e.target.value)} />}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-gutter-sm sm:grid-cols-2">
          <Field label="Customer Display Name">
            {(props) => (
              <Input
                {...props}
                value={customerDisplayName}
                onChange={(e) => setCustomerDisplayName(e.target.value)}
              />
            )}
          </Field>
          <Field label="SEO Title">
            {(props) => <Input {...props} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />}
          </Field>
        </div>

        <Field label="Customer Testimonial">
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              value={testimonial}
              onChange={(e) => setTestimonial(e.target.value)}
            />
          )}
        </Field>
        <Field label="SEO Description">
          {(props) => (
            <Textarea
              {...props}
              rows={2}
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
            />
          )}
        </Field>

        <div className="space-y-2 rounded bg-surface-muted p-gutter-md text-body-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={authenticityConfirmed}
              onChange={(e) => setAuthenticityConfirmed(e.target.checked)}
            />
            <span>I confirm this project and supplied materials are genuine.</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={customerConsentObtained}
              onChange={(e) => setCustomerConsentObtained(e.target.checked)}
            />
            <span>Customer consent has been obtained for publishing identifiable details/photos.</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isAnonymized}
              onChange={(e) => setIsAnonymized(e.target.checked)}
            />
            <span>Anonymize customer identity on public page.</span>
          </label>
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save Project"}
        </Button>
      </form>
    </Card>
  );
}
