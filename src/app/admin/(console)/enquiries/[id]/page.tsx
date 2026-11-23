import { notFound } from "next/navigation";
import { EnquiryDetailView } from "@/components/admin/enquiry-detail-view";
import { loadAdminEnquiryDetail } from "@/features/admin/server/enquiries";
import { getAdminQuotationsForEnquiry } from "@/features/quotations/server/quotations";

export const metadata = {
  title: "Enquiry Details | Sagar Traders Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEnquiryDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [enquiry, quotations] = await Promise.all([
    loadAdminEnquiryDetail(id),
    getAdminQuotationsForEnquiry(id),
  ]);
  if (!enquiry) {
    notFound();
  }

  return <EnquiryDetailView enquiry={enquiry} quotations={quotations} />;
}
