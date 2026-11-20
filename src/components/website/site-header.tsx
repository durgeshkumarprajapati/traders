import Link from "next/link";
import { Suspense } from "react";
import { Building2, Clock, MapPin, ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/common/container";
import { NavLink } from "@/components/common/nav-link";
import { websiteNav } from "@/config/navigation";
import type { BusinessSettings } from "@/features/settings/business-settings";
import { generalEnquiryMessage } from "@/lib/whatsapp";
import { CallButton, WhatsAppButton } from "./contact-actions";
import { EnquiryListLink } from "./enquiry-list-link";
import { MobileNav } from "./mobile-nav";

const linkClass =
  "transition-colors hover:text-primary py-1 border-b-2 border-transparent aria-[current=page]:border-primary aria-[current=page]:text-primary aria-[current=page]:font-bold";

/**
 * Professional Sagar Traders site header featuring:
 * 1. Top utility/meta bar: Location, operating hours, quick contacts, and admin access.
 * 2. Main brand & navigation bar: Architectural brand mark, store title & tagline,
 *    primary navigation, and prominent enquiry cart and quick quote CTAs.
 */
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
      {/* Top Utility / Meta Bar */}
      <div className="hidden border-b border-border bg-surface-muted text-on-surface-variant text-body-xs sm:block">
        <PageContainer className="flex h-9 items-center justify-between gap-gutter-md">
          {/* Left: Location & Hours */}
          <div className="flex items-center gap-gutter-md truncate">
            <span className="flex items-center gap-1.5 truncate">
              <MapPin aria-hidden className="size-3.5 text-secondary shrink-0" />
              <span>{settings.deliveryCoverage || settings.address || "Raipur Chhattisgarh"}</span>
            </span>
            {settings.businessHours && (
              <span className="hidden lg:flex items-center gap-1.5 border-l border-border pl-3 truncate">
                <Clock aria-hidden className="size-3.5 text-on-surface-variant shrink-0" />
                <span>{settings.businessHours}</span>
              </span>
            )}
          </div>

          {/* Right: Direct Contacts & Admin Portal Link */}
          <div className="flex items-center gap-gutter-sm shrink-0">
            {settings.phone && (
              <CallButton
                phone={settings.phone}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-body-xs font-medium text-primary hover:text-primary hover:bg-surface"
              >
                Call: {settings.phone}
              </CallButton>
            )}
            {settings.whatsappNumber && (
              <WhatsAppButton
                number={settings.whatsappNumber}
                message={whatsappMessage}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-body-xs font-medium text-success hover:text-success hover:bg-surface"
              >
                WhatsApp
              </WhatsAppButton>
            )}
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors text-body-xs font-medium border-l border-border pl-3 ml-1"
            >
              <ShieldCheck aria-hidden className="size-3.5" />
              <span>Admin</span>
            </Link>
          </div>
        </PageContainer>
      </div>

      {/* Main Header Bar */}
      <PageContainer className="flex h-20 items-center justify-between gap-gutter-md">
        {/* Brand Identity / Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          <div className="size-11 rounded-md bg-primary text-on-primary flex items-center justify-center font-bold shadow-xs relative overflow-hidden shrink-0 border border-primary/20">
            <Building2 aria-hidden className="size-6 text-secondary" />
          </div>
          <div className="flex flex-col">
            <span className="text-headline-md font-bold tracking-tight text-primary leading-tight group-hover:text-primary/90 transition-colors">
              {settings.name}
            </span>
            <span className="text-body-xs text-on-surface-variant truncate max-w-[220px] sm:max-w-xs font-normal">
              {settings.tagline || "Building Materials & Hardware Supplier"}
            </span>
          </div>
        </Link>

        {/* Primary Desktop Navigation */}
        <nav aria-label="Main" className="hidden lg:flex items-center gap-gutter-lg text-title-md">
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

        {/* Actions & Mobile Trigger */}
        <div className="flex items-center gap-gutter-sm">
          {/* Quick Contact Buttons (Desktop) */}
          <div className="hidden xl:flex items-center gap-gutter-sm">
            <CallButton phone={settings.phone} size="sm" variant="outline" />
            {settings.whatsappNumber && (
              <WhatsAppButton
                number={settings.whatsappNumber}
                message={whatsappMessage}
                size="sm"
                variant="secondary"
              >
                WhatsApp
              </WhatsAppButton>
            )}
          </div>

          {/* Enquiry List / Cart Button */}
          <EnquiryListLink className="flex items-center gap-2 font-medium text-body-sm px-3.5 py-2">
            <span className="hidden sm:inline">Enquiry List</span>
          </EnquiryListLink>

          {/* Quick Quote Primary CTA */}
          <Link
            href="/bulk-enquiry"
            className="hidden sm:inline-flex items-center justify-center rounded-md bg-primary px-3.5 py-2 text-label-md font-semibold text-on-primary hover:bg-primary/90 transition-colors shadow-xs"
          >
            Quick Quote
          </Link>

          {/* Mobile Drawer Trigger */}
          <Suspense fallback={null}>
            <MobileNav actions={mobileActions} />
          </Suspense>
        </div>
      </PageContainer>
    </header>
  );
}
