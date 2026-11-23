import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/common/container";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { QuotationView } from "@/components/website/quotation-view";
import { loadSettings } from "@/features/catalogue/server";
import { getTrackedQuotation } from "@/features/quotations/server/quotations";

interface QuotationPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: QuotationPageProps): Promise<Metadata> {
  const { token } = await params;
  try {
    const quo = await getTrackedQuotation(token);
    if (!quo) return { title: "Quotation" };
    return {
      title: `Quotation ${quo.reference} (v${quo.version}) — Sagar Traders`,
      description: `Formal quotation ${quo.reference} for ${quo.customerName}. Download PDF and review commercial supply details.`,
    };
  } catch {
    return { title: "Quotation — Sagar Traders" };
  }
}

export default async function QuotationPage({ params }: QuotationPageProps) {
  const { token } = await params;
  if (!token || token.length < 32) {
    notFound();
  }

  const [quotation, settings] = await Promise.all([getTrackedQuotation(token), loadSettings()]);

  if (!quotation) {
    notFound();
  }

  return (
    <PageContainer className="pb-section-lg">
      <div className="pt-gutter-lg pb-gutter-md">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Track Enquiry", href: "/track-enquiry" },
            { label: `Quotation ${quotation.reference}` },
          ]}
        />
      </div>

      <QuotationView
        quotation={quotation}
        token={token}
        whatsappNumber={settings.whatsappNumber ?? undefined}
        businessPhone={settings.phone ?? undefined}
      />
    </PageContainer>
  );
}
