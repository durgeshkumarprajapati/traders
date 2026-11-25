import { CrmCustomersView } from "@/components/admin/crm-customers-view";
import { listCustomers } from "@/features/crm/server/crm";
import type { CustomerType } from "@/features/crm/types";

export const metadata = {
  title: "Customers (CRM) | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; type?: string; repeat?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const customerType = (sp.type as CustomerType | "ALL") ?? "ALL";
  const repeatFilter =
    (sp.repeat as "ALL" | "NEW" | "REPEAT_ENQUIRY" | "REPEAT_BUYER") ?? "ALL";

  const data = await listCustomers({
    search: sp.search,
    customerType,
    repeatFilter,
    page,
    pageSize: 20,
  });

  return (
    <CrmCustomersView
      items={data.items}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
      initialSearch={sp.search}
      initialType={customerType}
      initialRepeat={repeatFilter}
    />
  );
}
