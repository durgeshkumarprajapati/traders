import {
  emptyBusinessSettings,
  type BusinessSettings,
} from "@/features/settings/business-settings";
import { buildBusinessCardData, type BusinessCardData } from "./data";

/** Fake, obviously-test values. Never used outside tests. */
export const TEST_SETTINGS: BusinessSettings = {
  ...emptyBusinessSettings(),
  name: "Test Hardware & Traders",
  tagline: "Test tagline for the card",
  phone: "+91 11111 22222",
  whatsappNumber: "919999900000",
  email: "desk@test-traders.example",
  address: "12 Test Street, Test Nagar, Testpur 000000",
  businessHours: "Test hours: Mon to Sat",
  gstNumber: "29ABCDE1234F1Z5",
};

export function sampleCard(
  over: Partial<BusinessSettings> = {},
  extra: { categoryNames?: string[]; siteUrl?: string | null; qr?: boolean } = {},
): BusinessCardData {
  return buildBusinessCardData({
    settings: { ...TEST_SETTINGS, ...over },
    categoryNames: extra.categoryNames ?? ["Cement", "Steel", "Bricks"],
    siteUrl: extra.siteUrl === undefined ? "https://shop.test-traders.example" : extra.siteUrl,
    makeQr:
      extra.qr === false
        ? undefined
        : (url) => {
            // tiny deterministic stand-in for unit tests that do not render pixels
            const size = 21;
            return {
              size,
              modules: (url.length % 2 ? "10" : "01")
                .repeat(Math.ceil((size * size) / 2))
                .slice(0, size * size),
            };
          },
  });
}
