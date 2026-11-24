import { BusinessCardSection } from "@/components/business/business-card-section";
import { PageContainer } from "@/components/common/container";
import { filterAndSort, parseListingParams } from "@/features/products/query";
import { loadCatalogue } from "@/features/catalogue/server";
import { emptyBusinessSettings, hasContactData } from "@/features/settings/business-settings";
import { CatalogueEmpty, CatalogueFallbackNotice, CatalogueUnavailable } from "./catalogue-states";
import { HomeCarousel } from "./home-carousel";
import {
  BrandsSection,
  BulkEnquiryCtaSection,
  CategoriesSection,
  ContactInfoSection,
  FeaturedProductsSection,
  RatesSection,
  WhyChooseUsSection,
} from "./home-sections";

/**
 * Homepage body, driven by the cached Google Sheets snapshot (server component; render inside <Suspense>).
 * Features a high-impact professional building materials carousel, followed by focused category highlights,
 * featured materials, indicative rates, verified brands, and direct action entry points for full pages.
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
          {load.source === "STATIC" && (
            <PageContainer className="pt-gutter-md">
              <CatalogueFallbackNotice />
            </PageContainer>
          )}
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
      <HomeCarousel tagline={settings.tagline} />
      {catalogueSections}
      <BulkEnquiryCtaSection settings={settings} />
      {hasContactData(settings) && <ContactInfoSection settings={settings} />}
      <BusinessCardSection
        contained
        settings={settings}
        categoryNames={load.ok ? load.catalogue.categories.map((c) => c.name) : []}
      />
    </>
  );
}
