import { buildBusinessCardData, hasCardContent } from "@/features/business-card/data";
import { qrMatrix } from "@/features/qr/qr";
import type { BusinessSettings } from "@/features/settings/business-settings";
import { publicEnv } from "@/lib/env/public";
import { PageContainer } from "@/components/common/container";
import { BusinessCardPanel } from "./business-card-panel";

/**
 * Server component: assembles the card from Business Settings, the ACTIVE catalogue categories and the configured public site URL
 * (QR matrix generated here, server-side, so no QR library ships to the browser), then hands plain data to the client panel.
 * Renders nothing when there is not enough configured to make a useful card.
 */
export function BusinessCardSection({
  settings,
  categoryNames,
  id = "visiting-card",
  heading = "Our digital visiting card",
  contained = false,
}: {
  settings: BusinessSettings;
  categoryNames: readonly string[];
  id?: string;
  heading?: string;
  /** Wrap in the standard page container with section spacing (homepage). */
  contained?: boolean;
}) {
  const data = buildBusinessCardData({
    settings,
    categoryNames,
    siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
    makeQr: qrMatrix,
  });
  if (!hasCardContent(data)) return null;
  const section = (
    <section id={id} aria-labelledby={`${id}-heading`} className="space-y-gutter-md">
      <div>
        <h2 id={`${id}-heading`} className="text-title-lg font-bold text-primary">
          {heading}
        </h2>
        <p className="text-body-md text-on-surface-variant">
          Save our details as an image to keep, print or share.
        </p>
      </div>
      <BusinessCardPanel data={data} />
    </section>
  );
  return contained ? <PageContainer className="py-section-md">{section}</PageContainer> : section;
}
