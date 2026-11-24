import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeading } from "@/components/common/container";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { ExpertForm } from "@/components/website/expert-form";
import { WhatsAppButton } from "@/components/website/contact-actions";
import { loadCatalogue } from "@/features/catalogue/server";
import { EXPERT_DISCLAIMER } from "@/features/expert/schemas";

export const metadata: Metadata = {
  title: "Ask a Materials Expert",
  description:
    "Send a building-material question to the Sagar Traders team. A person replies; there is no automated answer.",
  alternates: { canonical: "/ask-expert" },
};

/** Reads the WhatsApp number from the cached catalogue; inside <Suspense> so the rest of the page prerenders. */
async function PhotoSection() {
  const load = await loadCatalogue();
  const whatsapp = load.ok && load.source === "LIVE" ? load.settings.whatsappNumber : null;
  return (
    <section
      aria-labelledby="photos-heading"
      className="mt-gutter-lg space-y-2 rounded border border-border bg-surface-muted p-gutter-md"
    >
      <h2 id="photos-heading" className="text-title-md font-semibold">
        Want to share a photo?
      </h2>
      <p className="text-body-md text-on-surface-variant">
        Photos cannot be uploaded on this page. Send them to us on WhatsApp and mention your enquiry
        reference.
      </p>
      <WhatsAppButton
        hideIfUnavailable
        number={whatsapp}
        message="Hello, I would like to share a photo for my materials question."
        variant="outline"
        size="sm"
      >
        Send photos on WhatsApp
      </WhatsAppButton>
    </section>
  );
}

export default function AskExpertPage() {
  return (
    <PageContainer className="max-w-2xl pb-section-lg">
      <div className="pt-gutter-lg">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Ask an expert" }]} />
      </div>
      <PageHeading
        title="Ask a materials expert"
        description="Describe what you need. Our team answers personally — nothing here is answered automatically."
      />
      <p className="mb-gutter-md text-body-sm text-on-surface-variant">{EXPERT_DISCLAIMER}</p>
      <ExpertForm />
      <Suspense fallback={null}>
        <PhotoSection />
      </Suspense>
    </PageContainer>
  );
}
