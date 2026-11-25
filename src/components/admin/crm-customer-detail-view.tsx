"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { MessageSquare, PhoneCall, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import {
  addCustomerInteractionAction,
  addCustomerNoteAction,
  createFollowupAction,
  mergeCustomersAction,
  updateCustomerProfileAction,
  updateFollowupAction,
} from "@/features/crm/actions";
import {
  CUSTOMER_TYPES,
  FOLLOWUP_PRIORITIES,
  INTERACTION_TYPES,
  LIFECYCLE_STATUSES,
  PROGRAMME_STATUSES,
  RELATIONSHIP_TIERS,
  type CustomerFollowup,
  type CustomerInteraction,
  type CustomerNote,
  type CustomerSummary,
  type CustomerTimelineEvent,
} from "@/features/crm/types";

interface Props {
  customer: CustomerSummary;
  notes: CustomerNote[];
  interactions: CustomerInteraction[];
  followups: CustomerFollowup[];
  timeline: CustomerTimelineEvent[];
  enquiries: { id: string; reference: string; type: string; status: string; createdAt: string }[];
  quotations: {
    id: string;
    reference: string;
    version: number;
    status: string;
    totalAmount: number;
    createdAt: string;
  }[];
  orders: {
    id: string;
    reference: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }[];
  whatsappHref?: string | null;
}

export function CrmCustomerDetailView({
  customer,
  notes,
  interactions,
  followups,
  timeline,
  enquiries,
  quotations,
  orders,
  whatsappHref,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [intType, setIntType] = useState<(typeof INTERACTION_TYPES)[number]>("PHONE_CALL");
  const [intSummary, setIntSummary] = useState("");
  const [intNext, setIntNext] = useState("");
  const [fuTitle, setFuTitle] = useState("");
  const [fuDue, setFuDue] = useState("");
  const [fuPriority, setFuPriority] = useState<(typeof FOLLOWUP_PRIORITIES)[number]>("MEDIUM");
  const [mergeTargetId, setMergeTargetId] = useState("");

  // Editable profile fields
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email ?? "");
  const [companyName, setCompanyName] = useState(customer.companyName ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [customerType, setCustomerType] = useState(customer.customerType);
  const [relationshipTier, setRelationshipTier] = useState(customer.relationshipTier);
  const [isContractor, setIsContractor] = useState(customer.isContractor);
  const [programmeStatus, setProgrammeStatus] = useState(customer.programmeStatus);
  const [lifecycleStatus, setLifecycleStatus] = useState(customer.lifecycleStatus);

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateCustomerProfileAction(customer.id, {
        name,
        email: email.trim() || null,
        companyName: companyName.trim() || null,
        address: address.trim() || null,
        customerType,
        relationshipTier,
        isContractor,
        programmeStatus,
        lifecycleStatus,
      });
      setFeedback(res.ok ? "Customer profile saved." : res.message);
    });
  }

  function submitNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    startTransition(async () => {
      const res = await addCustomerNoteAction({ customerId: customer.id, body: noteBody });
      if (res.ok) {
        setNoteBody("");
        setFeedback("Internal note added.");
      } else {
        setFeedback(res.message);
      }
    });
  }

  function submitInteraction(e: React.FormEvent) {
    e.preventDefault();
    if (!intSummary.trim()) return;
    startTransition(async () => {
      const res = await addCustomerInteractionAction({
        customerId: customer.id,
        interactionType: intType,
        summary: intSummary,
        nextAction: intNext.trim() || null,
      });
      if (res.ok) {
        setIntSummary("");
        setIntNext("");
        setFeedback("Interaction logged.");
      } else {
        setFeedback(res.message);
      }
    });
  }

  function submitFollowup(e: React.FormEvent) {
    e.preventDefault();
    if (!fuTitle.trim() || !fuDue) return;
    startTransition(async () => {
      const res = await createFollowupAction({
        customerId: customer.id,
        title: fuTitle,
        dueAt: new Date(fuDue).toISOString(),
        priority: fuPriority,
      });
      if (res.ok) {
        setFuTitle("");
        setFuDue("");
        setFeedback("Follow-up scheduled.");
      } else {
        setFeedback(res.message);
      }
    });
  }

  function handleMerge(e: React.FormEvent) {
    e.preventDefault();
    if (!mergeTargetId.trim()) return;
    startTransition(async () => {
      const res = await mergeCustomersAction({
        sourceId: customer.id,
        targetId: mergeTargetId.trim(),
      });
      setFeedback(
        res.ok
          ? "Customer merged into target profile. History preserved."
          : res.message,
      );
    });
  }

  return (
    <div className="space-y-gutter-lg">
      <div className="flex flex-wrap items-start justify-between gap-gutter-md">
        <div>
          <Link
            href="/admin/customers"
            className="text-label-md text-primary hover:underline"
          >
            ← Back to Customers
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-gutter-xs">
            <h1 className="text-headline-lg text-primary">{customer.name}</h1>
            <Badge tone="neutral">{customer.customerType}</Badge>
            {customer.isRepeatBuyer && <Badge tone="success">Repeat Buyer</Badge>}
            {!customer.isRepeatBuyer && customer.isRepeatEnquiry && (
              <Badge tone="warning">Repeat Enquiries</Badge>
            )}
          </div>
          <p className="text-body-md text-on-surface-variant tabular-nums">
            +91 {customer.mobile}
            {customer.companyName ? ` • ${customer.companyName}` : ""}
            {customer.email ? ` • ${customer.email}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-gutter-xs">
          <ButtonLink href={`tel:+91${customer.mobile}`} variant="outline" size="sm">
            <PhoneCall aria-hidden className="size-4" />
            Call
          </ButtonLink>
          {whatsappHref && (
            <ButtonLink href={whatsappHref} target="_blank" rel="noopener noreferrer" size="sm">
              <MessageSquare aria-hidden className="size-4" />
              WhatsApp
            </ButtonLink>
          )}
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className="rounded border border-info bg-surface-muted px-4 py-2 text-body-md text-on-surface"
        >
          {feedback}
        </div>
      )}

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 gap-gutter-sm sm:grid-cols-4">
        <Card className="p-gutter-md">
          <p className="text-body-sm text-on-surface-variant">Enquiries</p>
          <p className="text-headline-lg font-bold text-primary tabular-nums">
            {customer.enquiryCount}
          </p>
        </Card>
        <Card className="p-gutter-md">
          <p className="text-body-sm text-on-surface-variant">Quotations</p>
          <p className="text-headline-lg font-bold text-primary tabular-nums">
            {customer.quotationCount}
          </p>
        </Card>
        <Card className="p-gutter-md">
          <p className="text-body-sm text-on-surface-variant">Confirmed Orders</p>
          <p className="text-headline-lg font-bold text-primary tabular-nums">
            {customer.confirmedOrderCount}
          </p>
        </Card>
        <Card className="p-gutter-md">
          <p className="text-body-sm text-on-surface-variant">First Interaction</p>
          <p className="text-title-md font-semibold text-on-surface">
            {new Date(customer.firstInteractionAt).toLocaleDateString("en-IN")}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-gutter-lg lg:grid-cols-3">
        {/* Left 2 columns: Timeline + Interactions + Follow-ups */}
        <div className="space-y-gutter-lg lg:col-span-2">
          <Card className="p-gutter-md">
            <h2 className="text-headline-sm text-primary">Log Interaction</h2>
            <form className="mt-gutter-sm space-y-gutter-sm" onSubmit={submitInteraction}>
              <div className="grid grid-cols-1 gap-gutter-sm sm:grid-cols-2">
                <Field label="Type">
                  {(props) => (
                    <Select
                      {...props}
                      value={intType}
                      onChange={(e) =>
                        setIntType(e.target.value as (typeof INTERACTION_TYPES)[number])
                      }
                    >
                      {INTERACTION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.replace("_", " ")}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Next Action (Optional)">
                  {(props) => (
                    <Input
                      {...props}
                      value={intNext}
                      onChange={(e) => setIntNext(e.target.value)}
                      placeholder="e.g. Send revised steel quote"
                    />
                  )}
                </Field>
              </div>
              <Field label="Summary">
                {(props) => (
                  <Textarea
                    {...props}
                    rows={2}
                    value={intSummary}
                    onChange={(e) => setIntSummary(e.target.value)}
                    placeholder="What was discussed with the customer?"
                  />
                )}
              </Field>
              <Button type="submit" size="sm" disabled={pending}>
                <Plus aria-hidden className="size-4" />
                Record Interaction
              </Button>
            </form>
          </Card>

          <Card className="p-gutter-md">
            <h2 className="text-headline-sm text-primary">
              Activity Timeline ({interactions.length} logged interactions)
            </h2>
            {timeline.length === 0 ? (
              <p className="mt-2 text-body-md text-on-surface-variant">
                No recorded activity yet.
              </p>
            ) : (
              <ul className="mt-gutter-sm divide-y divide-border">
                {timeline.map((ev) => (
                  <li key={ev.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-title-md font-semibold text-on-surface">
                        {ev.href ? (
                          <Link href={ev.href} className="text-primary hover:underline">
                            {ev.title}
                          </Link>
                        ) : (
                          ev.title
                        )}
                      </span>
                      <span className="text-body-sm text-on-surface-variant">
                        {new Date(ev.occurredAt).toLocaleString("en-IN")}
                      </span>
                    </div>
                    {ev.description && (
                      <p className="mt-1 text-body-md text-on-surface-variant">{ev.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-gutter-md">
            <h2 className="text-headline-sm text-primary">Follow-up Reminders</h2>
            <form className="mt-gutter-sm grid grid-cols-1 gap-gutter-sm sm:grid-cols-4" onSubmit={submitFollowup}>
              <div className="sm:col-span-2">
                <Input
                  aria-label="Follow-up title"
                  value={fuTitle}
                  onChange={(e) => setFuTitle(e.target.value)}
                  placeholder="Follow-up title..."
                />
              </div>
              <Input
                type="datetime-local"
                aria-label="Due date and time"
                value={fuDue}
                onChange={(e) => setFuDue(e.target.value)}
              />
              <div className="flex gap-gutter-xs">
                <Select
                  aria-label="Priority"
                  value={fuPriority}
                  onChange={(e) =>
                    setFuPriority(e.target.value as (typeof FOLLOWUP_PRIORITIES)[number])
                  }
                >
                  {FOLLOWUP_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                <Button type="submit" size="sm" disabled={pending}>
                  Add
                </Button>
              </div>
            </form>
            {followups.length > 0 && (
              <ul className="mt-gutter-md divide-y divide-border">
                {followups.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <p className="text-title-md text-on-surface">
                        {f.title}{" "}
                        <Badge tone={f.status === "COMPLETED" ? "success" : "warning"}>
                          {f.status}
                        </Badge>
                      </p>
                      <p className="text-body-sm text-on-surface-variant">
                        Due: {new Date(f.dueAt).toLocaleString("en-IN")} • {f.priority}
                      </p>
                    </div>
                    {f.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await updateFollowupAction({
                              followupId: f.id,
                              status: "COMPLETED",
                            });
                          })
                        }
                      >
                        Mark Done
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Linked Records */}
          <Card className="p-gutter-md">
            <h2 className="text-headline-sm text-primary">Linked Records</h2>
            <div className="mt-gutter-sm grid grid-cols-1 gap-gutter-md sm:grid-cols-3">
              <div>
                <h3 className="text-label-lg font-semibold text-on-surface">Enquiries</h3>
                <ul className="mt-1 space-y-1 text-body-sm">
                  {enquiries.map((e) => (
                    <li key={e.id}>
                      <Link href={`/admin/enquiries/${e.id}`} className="text-primary hover:underline">
                        {e.reference} ({e.status})
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-label-lg font-semibold text-on-surface">Quotations</h3>
                <ul className="mt-1 space-y-1 text-body-sm">
                  {quotations.map((q) => (
                    <li key={q.id}>
                      {q.reference} v{q.version} ({q.status})
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-label-lg font-semibold text-on-surface">Orders</h3>
                <ul className="mt-1 space-y-1 text-body-sm">
                  {orders.map((o) => (
                    <li key={o.id}>
                      <Link href={`/admin/orders/${o.id}`} className="text-primary hover:underline">
                        {o.reference} ({o.status})
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </div>

        {/* Right column: Profile Edit, Internal Notes, Merge */}
        <div className="space-y-gutter-lg">
          <Card className="p-gutter-md">
            <h2 className="text-headline-sm text-primary">Profile Details</h2>
            <form className="mt-gutter-sm space-y-gutter-sm" onSubmit={saveProfile}>
              <Field label="Name">
                {(props) => <Input {...props} value={name} onChange={(e) => setName(e.target.value)} required />}
              </Field>
              <Field label="Email">
                {(props) => <Input {...props} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Field>
              <Field label="Company / Firm">
                {(props) => <Input {...props} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />}
              </Field>
              <Field label="Address">
                {(props) => <Textarea {...props} rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />}
              </Field>
              <Field label="Customer Type">
                {(props) => (
                  <Select
                    {...props}
                    value={customerType}
                    onChange={(e) => setCustomerType(e.target.value as typeof customerType)}
                  >
                    {CUSTOMER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Relationship Tier">
                {(props) => (
                  <Select
                    {...props}
                    value={relationshipTier}
                    onChange={(e) => setRelationshipTier(e.target.value as typeof relationshipTier)}
                  >
                    {RELATIONSHIP_TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Lifecycle Status">
                {(props) => (
                  <Select
                    {...props}
                    value={lifecycleStatus}
                    onChange={(e) => setLifecycleStatus(e.target.value as typeof lifecycleStatus)}
                  >
                    {LIFECYCLE_STATUSES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="flex items-center gap-2">
                <input
                  id="is-contractor"
                  type="checkbox"
                  checked={isContractor}
                  onChange={(e) => setIsContractor(e.target.checked)}
                />
                <label htmlFor="is-contractor" className="text-body-md text-on-surface">
                  Contractor / Builder Programme Member
                </label>
              </div>
              {isContractor && (
                <Field label="Programme Status">
                  {(props) => (
                    <Select
                      {...props}
                      value={programmeStatus}
                      onChange={(e) => setProgrammeStatus(e.target.value as typeof programmeStatus)}
                    >
                      {PROGRAMME_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}
              <Button type="submit" size="sm" disabled={pending} className="w-full">
                Save Profile
              </Button>
            </form>
          </Card>

          <Card className="p-gutter-md">
            <h2 className="text-headline-sm text-primary">Internal Notes (Private)</h2>
            <p className="text-body-sm text-on-surface-variant">
              Visible only to administrators. Never shared with customers.
            </p>
            <form className="mt-gutter-sm space-y-gutter-xs" onSubmit={submitNote}>
              <Textarea
                rows={3}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Add private internal note..."
              />
              <Button type="submit" size="sm" disabled={pending}>
                Save Note
              </Button>
            </form>
            <ul className="mt-gutter-md space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded bg-surface-muted p-3 text-body-sm">
                  <p className="text-on-surface">{n.body}</p>
                  <p className="mt-1 text-on-surface-variant">
                    {new Date(n.createdAt).toLocaleString("en-IN")}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-gutter-md">
            <h2 className="text-headline-sm text-primary">Merge Duplicate Profile</h2>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Move all enquiries, quotations, notes, and interactions from this profile into
              another verified customer ID.
            </p>
            <form className="mt-gutter-sm space-y-gutter-xs" onSubmit={handleMerge}>
              <Input
                value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}
                placeholder="Target Customer UUID"
              />
              <Button type="submit" variant="outline" size="sm" disabled={pending}>
                Merge Into Target
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
