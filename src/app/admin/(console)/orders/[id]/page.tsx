import { notFound } from "next/navigation";
import { OrderDetailView } from "@/components/admin/order-detail-view";
import { getOrderDetail } from "@/features/orders/server/orders";

export const metadata = {
  title: "Order Detail | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();

  return (
    <OrderDetailView
      order={detail.order}
      items={detail.items}
      history={detail.history}
      delivery={detail.delivery}
      notes={detail.notes}
    />
  );
}
