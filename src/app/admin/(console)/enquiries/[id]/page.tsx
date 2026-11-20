import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EnquiryDetailView } from "@/components/admin/enquiry-detail-view";
import { loadAdminEnquiryDetail } from "@/features/admin/server/enquiries";

export const metadata = {
  title: "Enquiry Details | Sagar Traders Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEnquiryDetailPage({ params }: PageProps) {
  await connection();
  const { id } = await params;

  const enquiry = await loadAdminEnquiryDetail(id);
  if (!enquiry) {
    notFound();
  }

  return <EnquiryDetailView enquiry={enquiry} />;
}
