import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  Layers,
  Mail,
  Plus,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EnquiryStatusBadge, StockBadge } from "@/components/ui/status-badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import type { AdminDashboardData } from "@/features/admin/server/dashboard";
import { formatUpdated } from "@/features/products/format";

export function DashboardView({ data }: { data: AdminDashboardData }) {
  const { catalogue, enquiries, fetchedAt } = data;

  return (
    <div className="space-y-gutter-lg pb-section-md">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-gutter-md">
        <div>
          <h1 className="text-display-sm font-bold text-on-surface">Dashboard</h1>
          <p className="text-body-md text-on-surface-variant">
            Operational overview and live status for Sagar Traders.
          </p>
        </div>
        <div className="flex items-center gap-gutter-sm">
          <ButtonLink href="/admin/products/new" size="sm" variant="primary">
            <Plus aria-hidden className="size-4" /> Add Product
          </ButtonLink>
          <ButtonLink href="/admin/categories" size="sm" variant="outline">
            <Layers aria-hidden className="size-4" /> Categories & Brands
          </ButtonLink>
        </div>
      </div>

      {/* Connectivity Notices */}
      {!catalogue && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-4 text-warning">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-5 shrink-0" />
            <span>Google Sheets Catalogue Unreachable</span>
          </div>
          <p className="mt-1 text-body-sm">
            Product, category, and brand data could not be loaded from Google Sheets. Check your
            service account credentials and spreadsheet ID.
          </p>
        </div>
      )}

      {!enquiries && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-4 text-warning">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-5 shrink-0" />
            <span>Enquiry Database Connection Unavailable</span>
          </div>
          <p className="mt-1 text-body-sm">
            Supabase enquiries could not be queried. Ensure your database is active and
            authentication tokens are valid.
          </p>
        </div>
      )}

      {/* Key Metric Statistic Cards */}
      <div className="grid gap-gutter-md sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Products */}
        <Card className="border border-border bg-surface">
          <CardBody className="p-5">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-label-md font-medium">Active Products</span>
              <Boxes className="size-5 text-primary" aria-hidden />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-on-surface">
                {catalogue ? catalogue.activeProducts : "—"}
              </span>
              {catalogue && (
                <span className="text-body-sm text-on-surface-variant">
                  / {catalogue.totalProducts} total
                </span>
              )}
            </div>
            <p className="mt-1 text-body-sm text-on-surface-variant">Visible on customer website</p>
            <div className="mt-4 border-t border-border/60 pt-3">
              <Link
                href="/admin/products"
                className="inline-flex items-center gap-1 text-label-sm font-medium text-primary hover:underline"
              >
                Manage products <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </CardBody>
        </Card>

        {/* Categories & Brands */}
        <Card className="border border-border bg-surface">
          <CardBody className="p-5">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-label-md font-medium">Taxonomy</span>
              <Layers className="size-5 text-primary" aria-hidden />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-on-surface">
                {catalogue ? catalogue.activeCategories : "—"}
              </span>
              <span className="text-body-sm text-on-surface-variant">Categories</span>
            </div>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              {catalogue ? `${catalogue.activeBrands} Active Brands` : "—"}
            </p>
            <div className="mt-4 border-t border-border/60 pt-3">
              <Link
                href="/admin/categories"
                className="inline-flex items-center gap-1 text-label-sm font-medium text-primary hover:underline"
              >
                View categories & brands <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </CardBody>
        </Card>

        {/* New Enquiries */}
        <Card className="border border-border bg-surface">
          <CardBody className="p-5">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-label-md font-medium">New Enquiries</span>
              <Mail className="size-5 text-secondary" aria-hidden />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-on-surface">
                {enquiries ? enquiries.newCount : "—"}
              </span>
              {enquiries && enquiries.newCount > 0 && (
                <Badge tone="warning" appearance="solid" className="text-xs">
                  Action needed
                </Badge>
              )}
            </div>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Awaiting first customer contact
            </p>
            <div className="mt-4 border-t border-border/60 pt-3">
              <Link
                href="/admin/enquiries"
                className="inline-flex items-center gap-1 text-label-sm font-medium text-primary hover:underline"
              >
                Review new enquiries <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </CardBody>
        </Card>

        {/* Pending Enquiries */}
        <Card className="border border-border bg-surface">
          <CardBody className="p-5">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-label-md font-medium">Active Pipeline</span>
              <Clock className="size-5 text-primary" aria-hidden />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-on-surface">
                {enquiries ? enquiries.pendingCount : "—"}
              </span>
              {enquiries && (
                <span className="text-body-sm text-on-surface-variant">
                  / {enquiries.totalCount} total
                </span>
              )}
            </div>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              In contact or quotation stage
            </p>
            <div className="mt-4 border-t border-border/60 pt-3">
              <Link
                href="/admin/enquiries"
                className="inline-flex items-center gap-1 text-label-sm font-medium text-primary hover:underline"
              >
                All enquiries inbox <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid gap-gutter-lg lg:grid-cols-3">
        {/* Recent Enquiries (2 Cols) */}
        <div className="lg:col-span-2 space-y-gutter-md">
          <Card className="border border-border bg-surface">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4">
              <div>
                <CardTitle className="text-title-lg">Recent Customer Enquiries</CardTitle>
                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  Latest leads submitted via website and bulk enquiry builder.
                </p>
              </div>
              <ButtonLink href="/admin/enquiries" size="sm" variant="ghost">
                View all <ArrowRight className="size-3.5 ml-1" aria-hidden />
              </ButtonLink>
            </CardHeader>
            <CardBody className="p-0">
              {enquiries && enquiries.recent.length > 0 ? (
                <Table>
                  <THead>
                    <Tr>
                      <Th>Ref</Th>
                      <Th>Customer</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                      <Th>Received</Th>
                      <Th>Action</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {enquiries.recent.map((e) => (
                      <Tr key={e.id}>
                        <Td className="font-mono text-body-xs font-semibold">{e.reference}</Td>
                        <Td>
                          <div className="font-medium text-on-surface">{e.customerName}</div>
                          <div className="text-body-xs text-on-surface-variant">{e.mobile}</div>
                        </Td>
                        <Td>
                          <Badge
                            tone={e.type === "BULK" ? "primary" : "neutral"}
                            appearance="outline"
                            className="text-xs"
                          >
                            {e.type}
                          </Badge>
                        </Td>
                        <Td>
                          <EnquiryStatusBadge status={e.status} />
                        </Td>
                        <Td className="text-body-xs text-on-surface-variant">
                          {formatUpdated(e.createdAt) ?? "Recent"}
                        </Td>
                        <Td>
                          <Link
                            href={`/admin/enquiries/${e.id}`}
                            className="text-label-sm font-medium text-primary hover:underline"
                          >
                            Details
                          </Link>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-on-surface-variant">
                  <Mail className="mx-auto size-8 text-on-surface-variant/40 mb-2" aria-hidden />
                  <p className="text-body-md font-medium">No enquiries recorded yet.</p>
                  <p className="text-body-sm text-on-surface-variant/80 mt-1">
                    When customers submit general or bulk enquiries, they will appear here.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Inventory Breakdown & Quick Links */}
        <div className="space-y-gutter-md">
          {/* Product Availability Overview */}
          <Card className="border border-border bg-surface">
            <CardHeader className="border-b border-border px-5 py-4">
              <CardTitle className="text-title-lg">Product Stock Overview</CardTitle>
              <p className="text-body-sm text-on-surface-variant mt-0.5">
                Breakdown of active materials in the catalogue.
              </p>
            </CardHeader>
            <CardBody className="p-5 space-y-3">
              {catalogue ? (
                <>
                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <StockBadge status="IN_STOCK" />
                    <span className="font-semibold text-on-surface">
                      {catalogue.availability.IN_STOCK}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <StockBadge status="LIMITED_STOCK" />
                    <span className="font-semibold text-on-surface">
                      {catalogue.availability.LIMITED_STOCK}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <StockBadge status="AVAILABLE_ON_ORDER" />
                    <span className="font-semibold text-on-surface">
                      {catalogue.availability.AVAILABLE_ON_ORDER}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <StockBadge status="OUT_OF_STOCK" />
                    <span className="font-semibold text-on-surface">
                      {catalogue.availability.OUT_OF_STOCK}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-body-sm text-on-surface-variant">Data unavailable.</p>
              )}
            </CardBody>
          </Card>

          {/* Quick Shortcuts */}
          <Card className="border border-border bg-surface">
            <CardHeader className="border-b border-border px-5 py-4">
              <CardTitle className="text-title-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardBody className="p-4 space-y-2">
              <ButtonLink
                href="/admin/products/new"
                variant="outline"
                size="md"
                className="w-full justify-start"
              >
                <Plus className="size-4 mr-2" aria-hidden /> Add New Material
              </ButtonLink>
              <ButtonLink
                href="/admin/categories"
                variant="outline"
                size="md"
                className="w-full justify-start"
              >
                <Layers className="size-4 mr-2" aria-hidden /> Categories & Brands
              </ButtonLink>
              <ButtonLink
                href="/admin/settings"
                variant="outline"
                size="md"
                className="w-full justify-start"
              >
                <Settings className="size-4 mr-2" aria-hidden /> Business Settings
              </ButtonLink>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Catalogue Data Issues / Quality Health */}
      {catalogue && (
        <Card className="border border-border bg-surface">
          <CardHeader className="border-b border-border px-5 py-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              {catalogue.issues.length > 0 ? (
                <AlertTriangle className="size-5 text-warning" aria-hidden />
              ) : (
                <CheckCircle2 className="size-5 text-success" aria-hidden />
              )}
              <CardTitle className="text-title-md">
                {catalogue.issues.length > 0
                  ? `Google Sheets Data Warnings (${catalogue.issues.length})`
                  : "Google Sheets Data Synchronized"}
              </CardTitle>
            </div>
            <span className="text-body-xs text-on-surface-variant">
              Snapshot fetched: {formatUpdated(fetchedAt) ?? "Just now"}
            </span>
          </CardHeader>
          <CardBody className="p-5">
            {catalogue.issues.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {catalogue.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-body-xs p-2 rounded bg-surface-muted border border-border"
                  >
                    <Badge tone="warning" appearance="outline" className="text-xs uppercase">
                      {issue.code}
                    </Badge>
                    <span className="font-mono text-on-surface font-semibold">
                      [{issue.worksheet} row {issue.row ?? "—"}: {issue.column ?? "all"}]
                    </span>
                    <span className="text-on-surface-variant">{issue.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-body-sm text-on-surface-variant">
                All worksheets (Products, Categories, Brands, BusinessSettings) pass structural and
                referential validation. No missing references or format errors detected.
              </p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
