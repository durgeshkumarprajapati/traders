import { PageContainer, PageHeading } from "@/components/common/container";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { toEnquiryItems } from "@/features/catalogue/view";
import { loadCatalogue } from "@/features/catalogue/server";
import { BulkEnquiryForm } from "./bulk-enquiry-form";
import { CatalogueEmpty, CatalogueFallbackNotice, CatalogueUnavailable } from "./catalogue-states";

/**
 * Bulk enquiry body. The picker list is built on the server from the validated public catalogue
 * (names, brands, units and availability are authoritative server data; the browser only stores
 * product ids and quantities). Enquiry persistence arrives in Phase 6.
 */
export async function BulkEnquiryContent() {
  const load = await loadCatalogue();
  let body;
  if (!load.ok) body = <CatalogueUnavailable />;
  else if (load.catalogue.products.length === 0) body = <CatalogueEmpty />;
  else
    body = (
      <BulkEnquiryForm
        catalogue={toEnquiryItems(load.catalogue)}
        whatsappNumber={load.settings.whatsappNumber}
        businessEmail={load.settings.email}
      />
    );

  return (
    <PageContainer className="pb-section-lg">
      <div className="pt-gutter-lg">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Bulk enquiry" }]} />
      </div>
      <PageHeading
        title="Bulk quotation enquiry"
        description="List the materials and quantities you need, add your details, and we will respond with a quotation. This is an enquiry, not an order."
      />
      {load.ok && load.source === "STATIC" && <CatalogueFallbackNotice />}
      {body}
    </PageContainer>
  );
}
