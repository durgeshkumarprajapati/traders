import { Clock, Mail, MapPin, MessageCircle, Phone, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardBody } from "@/components/ui/card";
import type { BusinessSettings } from "@/features/settings/business-settings";
import { generalEnquiryMessage, normalizeWhatsAppNumber } from "@/lib/whatsapp";
import { BusinessCallLink } from "@/components/business/business-call-link";
import { CallButton, WhatsAppButton } from "./contact-actions";

function Item({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="transition-all duration-200 hover:border-primary hover:shadow-xs">
      <CardBody className="flex gap-gutter-md">
        <span
          aria-hidden
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary [&>svg]:size-5"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-title-md font-bold text-on-surface">{title}</h3>
          <div className="mt-1 space-y-gutter-sm text-body-md text-on-surface-variant">
            {children}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/** Contact cards built ONLY from configured business settings; missing items are omitted, never invented. */
export function ContactDetails({ settings }: { settings: BusinessSettings }) {
  const items: ReactNode[] = [];
  if (settings.phone) {
    items.push(
      <Item key="phone" icon={<Phone />} title="Phone">
        <p className="font-semibold text-on-surface">
          <BusinessCallLink
            phone={settings.phone}
            businessName={settings.name}
            className="hover:underline"
          />
        </p>
        <CallButton phone={settings.phone} businessName={settings.name} size="sm">
          Call now
        </CallButton>
      </Item>,
    );
  }
  if (normalizeWhatsAppNumber(settings.whatsappNumber)) {
    items.push(
      <Item key="wa" icon={<MessageCircle />} title="WhatsApp">
        <p>Direct desk connection for material availability and site quotations.</p>
        <WhatsAppButton
          number={settings.whatsappNumber}
          message={generalEnquiryMessage(settings.name)}
          size="sm"
        >
          Chat on WhatsApp
        </WhatsAppButton>
      </Item>,
    );
  }
  if (settings.address)
    items.push(
      <Item key="addr" icon={<MapPin />} title="Address">
        <p className="whitespace-pre-line">{settings.address}</p>
      </Item>,
    );
  if (settings.email)
    items.push(
      <Item key="mail" icon={<Mail />} title="Email">
        <p>
          <a className="font-medium text-primary hover:underline" href={`mailto:${settings.email}`}>
            {settings.email}
          </a>
        </p>
      </Item>,
    );
  if (settings.businessHours)
    items.push(
      <Item key="hours" icon={<Clock />} title="Business hours">
        <p className="whitespace-pre-line">{settings.businessHours}</p>
      </Item>,
    );
  if (settings.deliveryCoverage)
    items.push(
      <Item key="delivery" icon={<Truck />} title="Delivery coverage">
        <p>{settings.deliveryCoverage}</p>
      </Item>,
    );

  if (items.length === 0) {
    return (
      <p className="text-body-md text-on-surface-variant">
        Contact details are not available right now. You can still send us an enquiry using the
        form.
      </p>
    );
  }
  return <div className="grid grid-cols-1 gap-gutter-md sm:grid-cols-2">{items}</div>;
}
