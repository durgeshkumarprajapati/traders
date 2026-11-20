import { PageContainer } from "@/components/common/container";
import { filterAndSort, parseListingParams } from "@/features/products/query";
import { loadCatalogue } from "@/features/catalogue/server";
import { emptyBusinessSettings, hasContactData } from "@/features/settings/business-settings";
import { CatalogueEmpty, CatalogueUnavailable } from "./catalogue-states";
import {
  BrandsSection,
  BulkEnquiryCtaSection,
  CategoriesSection,
  ContactInfoSection,
  FeaturedProductsSection,
  HeroSection,
  RatesSection,
  WhyChooseUsSection,
} from "./home-sections";

/**
 * Homepage body, driven by the cached Google Sheets snapshot (server component; render inside <Suspense>).
 * Sections without data are HIDDEN (never filled with placeholders or sample content). If the sheet cannot
 * be read, the hero and enquiry call-to-action remain and an honest "unavailable" message replaces the catalogue sections.
 * "Why choose us" shows ONLY the owner-written statements from business settings (hidden when none are configured).
 */
export async function HomeContent() {
  const load = await loadCatalogue();
  const settings = load.ok ? load.settings : emptyBusinessSettings();

  let catalogueSections;
  if (!load.ok) {
    catalogueSections = (
      <PageContainer className="py-section-md">
        <CatalogueUnavailable />
      </PageContainer>
    );
  } else {
    const { products, categories, brands } = load.catalogue;
    if (products.length === 0 && categories.length === 0) {
      catalogueSections = (
        <PageContainer className="py-section-md">
          <CatalogueEmpty />
        </PageContainer>
      );
    } else {
      const ranked = filterAndSort(load.catalogue, parseListingParams({}));
      const featured = products.filter((p) => p.isFeatured);
      catalogueSections = (
        <>
          {categories.length > 0 && <CategoriesSection categories={categories} />}
          {featured.length > 0 && (
            <FeaturedProductsSection
              products={products}
              brands={brands}
              categories={categories}
              whatsappNumber={settings.whatsappNumber}
            />
          )}
          {products.length > 0 && (
            <RatesSection products={ranked} brands={brands} settings={settings} />
          )}
          <WhyChooseUsSection items={settings.whyChooseUs} />
          {brands.length > 0 && <BrandsSection brands={brands} />}
        </>
      );
    }
  }

  return (
    <>
      <HeroSection settings={settings} />
      {catalogueSections}
      <BulkEnquiryCtaSection settings={settings} />
      {hasContactData(settings) && <ContactInfoSection settings={settings} />}
    </>
  );
}
