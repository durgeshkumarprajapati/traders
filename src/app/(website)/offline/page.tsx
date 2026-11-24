import type { Metadata } from "next";
import { WifiOff, RefreshCw } from "lucide-react";
import { PageContainer } from "@/components/common/container";
import { ButtonLink } from "@/components/ui/button";
import { CallButton } from "@/components/website/contact-actions";
import { parsePhone } from "@/lib/phone";
import { Card } from "@/components/ui/card";
import { loadSettings } from "@/features/catalogue/server";

export const metadata: Metadata = {
  title: "Offline — Sagar Traders",
  description: "You are currently browsing Sagar Traders in offline mode.",
};

export default async function OfflinePage() {
  const settings = await loadSettings();

  return (
    <PageContainer className="py-section-lg text-center">
      <Card className="mx-auto max-w-lg p-gutter-xl border-border">
        <div className="flex justify-center mb-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-warning">
            <WifiOff className="size-8" />
          </div>
        </div>

        <h1 className="text-headline-sm font-bold text-primary">You are currently offline</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          It looks like your internet connection is unavailable. You can still browse previously
          cached products or call our sales desk directly.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <CallButton
            phone={settings.phone}
            businessName={settings.name}
            variant="primary"
            size="lg"
            className="w-full sm:w-auto"
          >
            Call Desk: {parsePhone(settings.phone)?.display}
          </CallButton>

          <ButtonLink href="/products" variant="outline" size="lg" className="w-full sm:w-auto">
            Browse Catalogue
          </ButtonLink>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <ButtonLink href="/" variant="ghost" size="sm">
            <RefreshCw className="size-3.5 mr-1.5" />
            Try Reconnecting
          </ButtonLink>
        </div>
      </Card>
    </PageContainer>
  );
}
