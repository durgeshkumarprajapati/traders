import type { Metadata } from "next";
import { PageContainer, PageHeading } from "@/components/common/container";
import { TokenAction } from "@/components/rate-alerts/token-action";

// Private, token-bearing page: never indexed, and the referrer is not sent anywhere.
export const metadata: Metadata = {
  title: "Unsubscribe from Rate Alerts",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return (
    <PageContainer className="max-w-xl py-section-lg">
      <PageHeading
        title="Unsubscribe from Rate Alerts"
        description="Use the button below to finish."
      />
      <TokenAction mode="unsubscribe" />
    </PageContainer>
  );
}
