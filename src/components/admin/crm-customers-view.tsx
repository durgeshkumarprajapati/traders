"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form-controls";
import { CUSTOMER_TYPES, type CustomerSummary } from "@/features/crm/types";

interface Props {
  items: CustomerSummary[];
  total: number;
  page: number;
  pageSize: number;
  initialSearch?: string;
  initialType?: string;
  initialRepeat?: string;
}

export function CrmCustomersView({
  items,
  total,
  page,
  pageSize,
  initialSearch = "",
  initialType = "ALL",
  initialRepeat = "ALL",
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [customerType, setCustomerType] = useState(initialType);
  const [repeatFilter, setRepeatFilter] = useState(initialRepeat);

  function applyFilters(nextPage = 1) {
    const sp = new URLSearchParams();
    if (search.trim()) sp.set("search", search.trim());
    if (customerType !== "ALL") sp.set("type", customerType);
    if (repeatFilter !== "ALL") sp.set("repeat", repeatFilter);
    if (nextPage > 1) sp.set("page", String(nextPage));
    router.push(`/admin/customers${sp.toString() ? `?${sp.toString()}` : ""}`);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-gutter-lg">
      <div className="flex flex-wrap items-center justify-between gap-gutter-md">
        <div>
          <h1 className="text-headline-lg text-primary">Customers (CRM)</h1>
          <p className="text-body-md text-on-surface-variant">
            Automatically organized from enquiries, quotations, and orders ({total} total).
          </p>
        </div>
        <ButtonLink href="/admin/follow-ups" variant="outline">
          Manage Follow-ups
        </ButtonLink>
      </div>

      <Card className="p-gutter-md">
        <form
          className="grid grid-cols-1 gap-gutter-sm sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters(1);
          }}
        >
          <div className="sm:col-span-2">
            <Input
              aria-label="Search customers"
              placeholder="Search name, phone, email, or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            aria-label="Filter by customer type"
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value)}
          >
            <option value="ALL">All Types</option>
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <div className="flex gap-gutter-xs">
            <Select
              aria-label="Filter by repeat activity"
              value={repeatFilter}
              onChange={(e) => setRepeatFilter(e.target.value)}
            >
              <option value="ALL">All Activity</option>
              <option value="NEW">New (Single)</option>
              <option value="REPEAT_ENQUIRY">Repeat Enquiries</option>
              <option value="REPEAT_BUYER">Repeat Buyers</option>
            </Select>
            <Button type="submit" size="md">
              <Search aria-hidden className="size-4" />
              Filter
            </Button>
          </div>
        </form>
      </Card>

      {items.length === 0 ? (
        <Card className="p-gutter-xl text-center">
          <Users aria-hidden className="mx-auto size-8 text-on-surface-variant" />
          <p className="mt-2 text-title-md text-on-surface">No customers found</p>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Try clearing your search or filters.
          </p>
        </Card>
      ) : (
        <div className="space-y-gutter-sm">
          {items.map((c) => (
            <Card key={c.id} className="p-gutter-md">
              <div className="flex flex-wrap items-start justify-between gap-gutter-md">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-gutter-xs">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="text-title-lg font-semibold text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                    <Badge tone="neutral">{c.customerType}</Badge>
                    {c.isContractor && <Badge tone="info">{c.relationshipTier}</Badge>}
                    {c.isRepeatBuyer && <Badge tone="success">Repeat Buyer</Badge>}
                    {!c.isRepeatBuyer && c.isRepeatEnquiry && (
                      <Badge tone="warning">Repeat Enquiries</Badge>
                    )}
                  </div>
                  <p className="text-body-md text-on-surface-variant tabular-nums">
                    +91 {c.mobile}
                    {c.companyName ? ` • ${c.companyName}` : ""}
                    {c.email ? ` • ${c.email}` : ""}
                  </p>
                  <p className="text-body-sm text-on-surface-variant">
                    Last activity: {new Date(c.lastInteractionAt).toLocaleDateString("en-IN")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-gutter-md text-body-sm">
                  <div className="text-center">
                    <p className="font-semibold text-on-surface tabular-nums">{c.enquiryCount}</p>
                    <p className="text-on-surface-variant">Enquiries</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-on-surface tabular-nums">{c.quotationCount}</p>
                    <p className="text-on-surface-variant">Quotations</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-on-surface tabular-nums">{c.orderCount}</p>
                    <p className="text-on-surface-variant">Orders</p>
                  </div>
                  <ButtonLink href={`/admin/customers/${c.id}`} variant="outline" size="sm">
                    Open Profile
                  </ButtonLink>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-gutter-md">
          <p className="text-body-sm text-on-surface-variant">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-gutter-xs">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => applyFilters(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => applyFilters(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
