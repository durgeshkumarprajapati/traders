import { OrdersListView } from "@/components/admin/orders-list-view";
import { listOrders } from "@/features/orders/server/orders";
import type { OrderStatus } from "@/features/orders/types";

export const metadata = {
  title: "Orders | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const status = (sp.status as OrderStatus | "ALL") ?? "ALL";
  const orders = await listOrders({ status, search: sp.search });

  return <OrdersListView orders={orders} activeStatus={status} />;
}
