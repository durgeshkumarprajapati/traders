import { notFound } from "next/navigation";
import { ContractorDetailView } from "@/components/admin/contractor-detail-view";
import { getContractorExtras } from "@/features/contractors/server/contractors";
import { getCustomerDetail } from "@/features/crm/server/crm";

export const metadata = {
  title: "Contractor Detail | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminContractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, extras] = await Promise.all([
    getCustomerDetail(id),
    getContractorExtras(id),
  ]);
  if (!detail) notFound();

  return (
    <ContractorDetailView
      customer={detail.customer}
      lists={extras.lists}
      offers={extras.offers}
    />
  );
}
