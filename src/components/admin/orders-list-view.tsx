import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatRupees } from "@/features/quotations/calculations";
import { ORDER_STATUSES, type OrderRecord } from "@/features/orders/types";

export function OrdersListView({
  orders,
  activeStatus,
}: {
  orders: OrderRecord[];
  activeStatus: string;
}) {
  return (
    <div className="space-y-gutter-lg">
      <div>
        <h1 className="text-headline-lg text-primary">Orders &amp; Deliveries</h1>
        <p className="text-body-md text-on-surface-variant">
          Manage confirmed orders created from accepted quotations and track dispatch status.
        </p>
      </div>

      <div className="flex flex-wrap gap-gutter-xs">
        <ButtonLink
          href="/admin/orders"
          size="sm"
          variant={activeStatus === "ALL" ? "primary" : "outline"}
        >
          All
        </ButtonLink>
        {ORDER_STATUSES.map((st) => (
          <ButtonLink
            key={st}
            href={`/admin/orders?status=${st}`}
            size="sm"
            variant={activeStatus === st ? "primary" : "outline"}
          >
            {st.replace(/_/g, " ")}
          </ButtonLink>
        ))}
      </div>

      {orders.length === 0 ? (
        <Card className="p-gutter-xl text-center">
          <PackageCheck aria-hidden className="mx-auto size-8 text-on-surface-variant" />
          <p className="mt-2 text-title-md text-on-surface">No orders found</p>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Orders are created from accepted quotations inside an enquiry.
          </p>
        </Card>
      ) : (
        <div className="space-y-gutter-sm">
          {orders.map((o) => (
            <Card key={o.id} className="p-gutter-md">
              <div className="flex flex-wrap items-center justify-between gap-gutter-md">
                <div>
                  <div className="flex flex-wrap items-center gap-gutter-xs">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="text-title-lg font-semibold text-primary hover:underline tabular-nums"
                    >
                      {o.reference}
                    </Link>
                    <Badge tone={o.status === "DELIVERED" ? "success" : o.status === "CANCELLED" ? "error" : "info"}>
                      {o.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-body-md text-on-surface-variant">
                    {o.customerName} • +91 {o.mobile}
                    {o.deliveryAddress ? ` • ${o.deliveryAddress}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-gutter-md">
                  <div className="text-right">
                    <p className="text-title-md font-bold text-primary tabular-nums">
                      {formatRupees(o.totalAmount)}
                    </p>
                    <p className="text-body-sm text-on-surface-variant">
                      {new Date(o.createdAt).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <ButtonLink href={`/admin/orders/${o.id}`} variant="outline" size="sm">
                    Manage
                  </ButtonLink>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
