import { notFound } from "next/navigation";
import { CrmCustomerDetailView } from "@/components/admin/crm-customer-detail-view";
import { loadSettings } from "@/features/catalogue/server";
import { getCustomerDetail } from "@/features/crm/server/crm";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export const metadata = {
  title: "Customer Profile | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, settings] = await Promise.all([getCustomerDetail(id), loadSettings()]);
  if (!detail) notFound();

  const wa = buildWhatsAppUrl(
    `91${detail.customer.mobile}`,
    `Hello ${detail.customer.name}, following up from ${settings.name}.`,
  );

  return (
    <CrmCustomerDetailView
      customer={detail.customer}
      notes={detail.notes}
      interactions={detail.interactions}
      followups={detail.followups}
      timeline={detail.timeline}
      enquiries={detail.enquiries}
      quotations={detail.quotations}
      orders={detail.orders}
      whatsappHref={wa}
    />
  );
}
