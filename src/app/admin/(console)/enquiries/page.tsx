import { EnquiryListView } from "@/components/admin/enquiry-list-view";
import { loadAdminEnquiries } from "@/features/admin/server/enquiries";

export const metadata = {
  title: "Customer Enquiries | Sagar Traders Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    type?: string;
    page?: string;
  }>;
}

export default async function AdminEnquiriesPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const search = typeof sp.search === "string" ? sp.search : "";
  const status = typeof sp.status === "string" ? sp.status : "ALL";
  const type = typeof sp.type === "string" ? sp.type : "ALL";
  const page = typeof sp.page === "string" ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;

  const data = await loadAdminEnquiries({
    search: search || undefined,
    status: status !== "ALL" ? status : undefined,
    type: type !== "ALL" ? type : undefined,
    page,
    pageSize: 15,
  });

  return (
    <EnquiryListView
      initialData={data}
      currentSearch={search}
      currentStatus={status}
      currentType={type}
    />
  );
}
