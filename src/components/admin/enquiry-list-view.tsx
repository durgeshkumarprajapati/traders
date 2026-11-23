"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, MessageSquare, Phone, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { EnquiryStatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { ENQUIRY_STATUSES, type AdminEnquiryListResult } from "@/features/admin/types";

interface EnquiryListViewProps {
  initialData: AdminEnquiryListResult;
  currentSearch?: string;
  currentStatus?: string;
  currentType?: string;
}

export function EnquiryListView({
  initialData,
  currentSearch = "",
  currentStatus = "ALL",
  currentType = "ALL",
}: EnquiryListViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(currentSearch);
  const [status, setStatus] = useState(currentStatus);
  const [type, setType] = useState(currentType);

  const applyFilters = (newSearch: string, newStatus: string, newType: string, page = 1) => {
    const params = new URLSearchParams();
    if (newSearch.trim()) params.set("search", newSearch.trim());
    if (newStatus && newStatus !== "ALL") params.set("status", newStatus);
    if (newType && newType !== "ALL") params.set("type", newType);
    if (page > 1) params.set("page", String(page));

    startTransition(() => {
      const q = params.toString();
      router.push(`/admin/enquiries${q ? `?${q}` : ""}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(search, status, type, 1);
  };

  const handleReset = () => {
    setSearch("");
    setStatus("ALL");
    setType("ALL");
    startTransition(() => {
      router.push("/admin/enquiries");
    });
  };

  const { enquiries, totalCount, page, pageSize, totalPages } = initialData;
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-headline-lg-mobile font-bold md:text-headline-xl text-on-surface">
            Customer Enquiries
          </h1>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Review commercial quotation requests and general customer enquiries submitted through
            the website.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardBody className="p-4 sm:p-6">
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Field
                  label="Search Enquiries"
                  helper="Filter by reference, customer name, or phone number"
                >
                  {(p) => (
                    <div className="relative">
                      <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
                      />
                      <Input
                        {...p}
                        className="pl-9"
                        placeholder="e.g. ENQ-2026-001001, Sharma, 9123456789"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  )}
                </Field>
              </div>

              <div>
                <Field label="Enquiry Status">
                  {(p) => (
                    <Select
                      {...p}
                      value={status}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStatus(val);
                        applyFilters(search, val, type, 1);
                      }}
                    >
                      <option value="ALL">All Statuses</option>
                      {ENQUIRY_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s === "QUOTATION_SENT" ? "Quotation Sent" : s}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>

              <div>
                <Field label="Enquiry Type">
                  {(p) => (
                    <Select
                      {...p}
                      value={type}
                      onChange={(e) => {
                        const val = e.target.value;
                        setType(val);
                        applyFilters(search, status, val, 1);
                      }}
                    >
                      <option value="ALL">All Types</option>
                      <option value="BULK">Bulk Quotation</option>
                      <option value="GENERAL">General Enquiry</option>
                    </Select>
                  )}
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-body-sm text-on-surface-variant">
                Showing <span className="font-semibold text-on-surface">{startItem}</span> to{" "}
                <span className="font-semibold text-on-surface">{endItem}</span> of{" "}
                <span className="font-semibold text-on-surface">{totalCount}</span> enquiries
              </div>

              <div className="flex items-center gap-2">
                {(search || status !== "ALL" || type !== "ALL") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={isPending}
                  >
                    <X aria-hidden="true" className="size-4 mr-1" />
                    Reset
                  </Button>
                )}
                <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* Enquiries Table */}
      <Card>
        <CardBody className="p-0">
          <div>
            <Table stacked>
              <THead>
                <Tr>
                  <Th>Reference</Th>
                  <Th>Customer</Th>
                  <Th>Type</Th>
                  <Th>Materials</Th>
                  <Th>Date & Time</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Action</Th>
                </Tr>
              </THead>
              <TBody>
                {enquiries.length === 0 ? (
                  <Tr>
                    <Td colSpan={7} className="py-12 text-center text-on-surface-variant">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <MessageSquare
                          aria-hidden="true"
                          className="size-8 text-on-surface-variant/50"
                        />
                        <p className="font-medium text-on-surface">No enquiries found</p>
                        <p className="text-body-sm max-w-sm">
                          {search || status !== "ALL" || type !== "ALL"
                            ? "No enquiries match your current search or filter criteria. Try adjusting your filters."
                            : "Customer enquiries submitted via the website will appear here in real-time."}
                        </p>
                        {(search || status !== "ALL" || type !== "ALL") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={handleReset}
                          >
                            Clear all filters
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ) : (
                  enquiries.map((enquiry) => (
                    <Tr key={enquiry.id} className="hover:bg-surface-muted/50 transition-colors">
                      <Td label="Reference" className="font-mono font-medium text-primary">
                        <Link
                          href={`/admin/enquiries/${enquiry.id}`}
                          className="hover:underline focus-visible:outline-2 focus-visible:outline-secondary"
                        >
                          {enquiry.reference}
                        </Link>
                      </Td>
                      <Td label="Customer">
                        <div className="font-medium text-on-surface">{enquiry.customerName}</div>
                        <div className="flex items-center gap-1 text-body-md text-on-surface-variant">
                          <Phone aria-hidden="true" className="size-3" />
                          <a
                            href={`tel:${enquiry.mobile}`}
                            className="inline-flex min-h-8 items-center hover:text-primary hover:underline pointer-coarse:min-h-11"
                          >
                            {enquiry.mobile}
                          </a>
                        </div>
                      </Td>
                      <Td label="Type">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge
                            tone={enquiry.type === "BULK" ? "primary" : "neutral"}
                            appearance="outline"
                          >
                            {enquiry.type === "BULK" ? "Bulk Order" : "General"}
                          </Badge>
                          {enquiry.isCallback && (
                            <Badge tone="warning" appearance="solid">
                              Callback
                            </Badge>
                          )}
                        </div>
                      </Td>
                      <Td label="Materials" className="text-body-sm text-on-surface">
                        {enquiry.type === "BULK" ? (
                          <span className="font-medium">{enquiry.itemCount} items</span>
                        ) : (
                          <span className="text-on-surface-variant italic">Direct message</span>
                        )}
                      </Td>
                      <Td
                        label="Date & time"
                        className="text-body-sm text-on-surface-variant md:whitespace-nowrap"
                      >
                        {new Date(enquiry.createdAt).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </Td>
                      <Td label="Status">
                        <EnquiryStatusBadge status={enquiry.status} />
                      </Td>
                      <Td className="md:text-right">
                        <ButtonLink
                          size="sm"
                          variant="outline"
                          href={`/admin/enquiries/${enquiry.id}`}
                        >
                          <Eye aria-hidden="true" className="size-3.5 mr-1" />
                          View
                        </ButtonLink>
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-6">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || isPending}
                onClick={() => applyFilters(search, status, type, page - 1)}
              >
                <ArrowLeft aria-hidden="true" className="size-4 mr-1" />
                Previous
              </Button>
              <div className="text-body-sm text-on-surface-variant">
                Page <span className="font-semibold text-on-surface">{page}</span> of{" "}
                <span className="font-semibold text-on-surface">{totalPages}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || isPending}
                onClick={() => applyFilters(search, status, type, page + 1)}
              >
                Next
                <ArrowRight aria-hidden="true" className="size-4 ml-1" />
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
