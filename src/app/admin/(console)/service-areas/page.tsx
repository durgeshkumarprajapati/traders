import { ServiceAreasView } from "@/components/admin/service-areas-view";
import { listAdminServiceAreas } from "@/features/seo/service-areas";

export const metadata = {
  title: "Service Areas | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminServiceAreasPage() {
  const areas = await listAdminServiceAreas();
  return <ServiceAreasView areas={areas} />;
}
