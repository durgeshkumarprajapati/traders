import Link from "next/link";
import { Suspense } from "react";
import { PageContainer } from "@/components/common/container";
import { NavLink } from "@/components/common/nav-link";
import { websiteNav } from "@/config/navigation";
import type { BusinessSettings } from "@/features/settings/business-settings";
import { generalEnquiryMessage } from "@/lib/whatsapp";
import { CallButton, WhatsAppButton } from "./contact-actions";
import { EnquiryListLink } from "./enquiry-list-link";
import { MobileNav } from "./mobile-nav";

const linkClass = "transition-colors hover:text-primary";

/** Call/WhatsApp actions render only when the numbers are configured in business settings. */
export function SiteHeader({ settings }: { settings: BusinessSettings }) {
  const whatsappMessage = generalEnquiryMessage(settings.name);
  const mobileActions = (
    <>
      <CallButton phone={settings.phone} size="lg">
        Call us
      </CallButton>
      {settings.whatsappNumber && (
        <WhatsAppButton number={settings.whatsappNumber} message={whatsappMessage} size="lg">
          WhatsApp enquiry
        </WhatsAppButton>
      )}
    </>
  );
  return (
    <header className="border-b border-border bg-surface">
      <PageContainer className="flex h-16 items-center justify-between gap-gutter-md">
        <Link href="/" className="text-title-lg text-primary">
          {settings.name}
        </Link>
        <nav aria-label="Main" className="hidden gap-gutter-lg text-label-lg md:flex">
          {/* usePathname suspends on dynamic-param routes: render plain links until it resolves. */}
          <Suspense
            fallback={websiteNav.map((i) => (
              <Link key={i.href} href={i.href} className={linkClass}>
                {i.label}
              </Link>
            ))}
          >
            {websiteNav.map((i) => (
              <NavLink key={i.href} href={i.href} exact={i.href === "/"} className={linkClass}>
                {i.label}
              </NavLink>
            ))}
          </Suspense>
        </nav>
        <div className="flex items-center gap-gutter-sm">
          <div className="hidden items-center gap-gutter-sm sm:flex">
            <CallButton phone={settings.phone} size="sm" />
            {settings.whatsappNumber && (
              <WhatsAppButton number={settings.whatsappNumber} message={whatsappMessage} size="sm">
                WhatsApp
              </WhatsAppButton>
            )}
          </div>
          <EnquiryListLink />
          <Suspense fallback={null}>
            <MobileNav actions={mobileActions} />
          </Suspense>
        </div>
      </PageContainer>
    </header>
  );
}
