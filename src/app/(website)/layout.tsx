import { Suspense } from "react";
import { AnnouncementSlot, FooterSlot, HeaderSlot } from "@/components/website/site-chrome";
import { SiteFooter } from "@/components/website/site-footer";
import { SiteHeader } from "@/components/website/site-header";
import { OfflineBanner, PwaInstallPrompt, PwaRegister } from "@/components/website/pwa-components";
import { GuidedTourProvider } from "@/components/website/guided-tour-provider";
import { emptyBusinessSettings } from "@/features/settings/business-settings";

/**
 * Static shell + streamed data slots. Header, footer and banner read the cached Google Sheets snapshot
 * inside <Suspense>; their fallbacks use empty settings (name + navigation only), so the prerendered
 * shell never contains business data and a failing spreadsheet degrades to the same minimal chrome.
 */
export default function WebsiteLayout({ children }: LayoutProps<"/">) {
  const empty = emptyBusinessSettings();
  return (
    <>
      <PwaRegister />
      <OfflineBanner />
      <Suspense fallback={null}>
        <AnnouncementSlot />
      </Suspense>
      <Suspense fallback={<SiteHeader settings={empty} />}>
        <HeaderSlot />
      </Suspense>
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <Suspense fallback={<SiteFooter settings={empty} categories={[]} />}>
        <FooterSlot />
      </Suspense>
      <GuidedTourProvider />
      <PwaInstallPrompt />
    </>
  );
}
