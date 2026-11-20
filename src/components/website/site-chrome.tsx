import { loadCatalogue, loadSettings } from "@/features/catalogue/server";
import { emptyBusinessSettings } from "@/features/settings/business-settings";
import { AnnouncementBanner } from "./announcement-banner";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * Layout slots that read business settings / categories from the cached catalogue snapshot.
 * They render inside <Suspense>, with fallbacks built from `emptyBusinessSettings()` — i.e. the
 * static shell contains no business data, and a failing spreadsheet degrades to the same minimal chrome.
 */
export async function AnnouncementSlot() {
  return <AnnouncementBanner text={(await loadSettings()).announcement} />;
}

export async function HeaderSlot() {
  return <SiteHeader settings={await loadSettings()} />;
}

export async function FooterSlot() {
  const r = await loadCatalogue();
  return (
    <SiteFooter
      settings={r.ok ? r.settings : emptyBusinessSettings()}
      categories={r.ok ? r.catalogue.categories : []}
    />
  );
}
