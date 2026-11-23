import { PageContainer, PageHeading } from "@/components/common/container";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { loadSettings } from "@/features/catalogue/server";
import { RequestCallbackButton } from "./callback-modal";
import { ContactDetails } from "./contact-details";
import { ContactForm } from "./contact-form";

/** Contact page body: details come only from configured business settings; missing items are omitted. */
export async function ContactContent() {
  const settings = await loadSettings();
  return (
    <PageContainer className="pb-section-lg">
      <div className="pt-gutter-lg">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Contact" }]} />
      </div>
      <PageHeading title="Contact" description="Reach us directly or send a general enquiry." />
      <div className="grid grid-cols-1 gap-gutter-xl lg:grid-cols-2">
        <div className="space-y-gutter-lg">
          <ContactDetails settings={settings} />
          <Card className="border-secondary/40 bg-secondary/5">
            <CardHeader>
              <CardTitle className="text-title-md">Prefer a Phone Call?</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-body-sm text-on-surface-variant">
                Request a callback from our sales desk at a date and time window that suits you
                best.
              </p>
              <RequestCallbackButton variant="primary" size="md">
                Request a Callback
              </RequestCallbackButton>
            </CardBody>
          </Card>
          {settings.googleMapsUrl && (
            <section aria-labelledby="map-heading">
              <h2 id="map-heading" className="mb-gutter-sm text-title-lg">
                Location
              </h2>
              <a
                href={settings.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Open in Google Maps<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </section>
          )}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Send a general enquiry</CardTitle>
          </CardHeader>
          <CardBody>
            <ContactForm />
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  );
}
