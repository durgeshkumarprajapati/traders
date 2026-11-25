"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { updateFollowupAction } from "@/features/crm/actions";
import { FOLLOWUP_PRIORITIES, type CustomerFollowup } from "@/features/crm/types";

interface Props {
  items: CustomerFollowup[];
  bucket: string;
  priority: string;
  search: string;
  nowIso: string;
}

export function CrmFollowupsView({ items, bucket, priority, search, nowIso }: Props) {
  const nowMs = new Date(nowIso).getTime();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(search);
  const [prio, setPrio] = useState(priority);

  function go(nextBucket: string, nextPrio = prio, nextQ = q) {
    const sp = new URLSearchParams();
    if (nextBucket !== "ALL") sp.set("bucket", nextBucket);
    if (nextPrio !== "ALL") sp.set("priority", nextPrio);
    if (nextQ.trim()) sp.set("search", nextQ.trim());
    router.push(`/admin/follow-ups${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  const buckets = [
    { key: "ALL", label: "All Pending" },
    { key: "OVERDUE", label: "Overdue" },
    { key: "TODAY", label: "Today" },
    { key: "UPCOMING", label: "Upcoming" },
    { key: "COMPLETED", label: "Completed" },
  ];

  return (
    <div className="space-y-gutter-lg">
      <div>
        <h1 className="text-headline-lg text-primary">Follow-up Reminders</h1>
        <p className="text-body-md text-on-surface-variant">
          Track scheduled customer callbacks, quotation follow-ups, and site visits.
        </p>
      </div>

      <div className="flex flex-wrap gap-gutter-xs">
        {buckets.map((b) => (
          <Button
            key={b.key}
            size="sm"
            variant={bucket === b.key ? "primary" : "outline"}
            onClick={() => go(b.key)}
          >
            {b.label}
          </Button>
        ))}
      </div>

      <Card className="p-gutter-md">
        <form
          className="flex flex-wrap gap-gutter-sm"
          onSubmit={(e) => {
            e.preventDefault();
            go(bucket);
          }}
        >
          <Input
            className="max-w-xs"
            placeholder="Search customer or title..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select value={prio} onChange={(e) => setPrio(e.target.value)}>
            <option value="ALL">All Priorities</option>
            {FOLLOWUP_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Button type="submit" size="sm">
            Apply
          </Button>
        </form>
      </Card>

      {items.length === 0 ? (
        <Card className="p-gutter-xl text-center">
          <Clock aria-hidden className="mx-auto size-8 text-on-surface-variant" />
          <p className="mt-2 text-title-md text-on-surface">No follow-ups in this view</p>
        </Card>
      ) : (
        <div className="space-y-gutter-sm">
          {items.map((f) => {
            const isOverdue = f.status === "PENDING" && new Date(f.dueAt).getTime() < nowMs;
            return (
              <Card key={f.id} className="p-gutter-md">
                <div className="flex flex-wrap items-center justify-between gap-gutter-md">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-gutter-xs">
                      <span className="text-title-md font-semibold text-on-surface">{f.title}</span>
                      <Badge
                        tone={
                          f.priority === "URGENT" || f.priority === "HIGH" ? "error" : "neutral"
                        }
                      >
                        {f.priority}
                      </Badge>
                      {isOverdue && <Badge tone="error">Overdue</Badge>}
                      {f.status === "COMPLETED" && <Badge tone="success">Completed</Badge>}
                    </div>
                    <p className="text-body-sm text-on-surface-variant">
                      Customer:{" "}
                      <Link
                        href={`/admin/customers/${f.customerId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {f.customerName ?? "Customer"}
                      </Link>
                      {f.customerMobile ? ` (+91 ${f.customerMobile})` : ""} • Due{" "}
                      {new Date(f.dueAt).toLocaleString("en-IN")}
                    </p>
                    {f.description && (
                      <p className="text-body-sm text-on-surface-variant">{f.description}</p>
                    )}
                  </div>

                  {f.status === "PENDING" && (
                    <div className="flex gap-gutter-xs">
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
                        <CheckCircle2 aria-hidden className="size-4" />
                        Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await updateFollowupAction({
                              followupId: f.id,
                              status: "CANCELLED",
                            });
                          })
                        }
                      >
                        <XCircle aria-hidden className="size-4" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
