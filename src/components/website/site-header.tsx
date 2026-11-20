import Link from "next/link";
import { Suspense } from "react";
import { Building2, ClipboardList, Clock, Lock, Phone } from "lucide-react";
import { PageContainer } from "@/components/common/container";
import { NavLink } from "@/components/common/nav-link";
import { websiteNav } from "@/config/navigation";
import type { BusinessSettings } from "@/features/settings/business-settings";
import { generalEnquiryMessage } from "@/lib/whatsapp";
import { CallButton, WhatsAppButton } from "./contact-actions";
import { EnquiryListLink } from "./enquiry-list-link";
import { MobileNav } from "./mobile-nav";

const linkClass =
  "transition-colors hover:text-primary py-2 font-label text-label-lg border-b-2 border-transparent aria-[current=page]:border-primary aria-[current=page]:text-primary aria-[current=page]:font-bold";

/**
 * Professional Sagar Traders site header featuring:
 * 1. Slim Top Utility Bar (Navy with Secondary Amber accents): Location, operating hours, quick contacts, and admin access.
 * 2. Clean Sticky Main Navigation: Architectural brand mark, store title & tagline,
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
    <header className="sticky top-0 z-40 bg-surface border-b border-border shadow-xs">
      {/* Slim Top Utility Bar */}
      <div className="hidden border-b border-primary bg-primary text-on-primary text-body-sm sm:block">
        <PageContainer className="flex h-9 items-center justify-between gap-gutter-md">
          {/* Left: Location & Hours */}
          <div className="flex items-center gap-3 text-body-sm truncate">
            <span className="inline-flex items-center gap-1.5 truncate">
              <span className="size-2 rounded-full bg-secondary shrink-0" aria-hidden="true" />
              <span className="font-label text-label-md text-secondary font-semibold">
                {settings.deliveryCoverage || settings.address || "Raipur Depot"}
              </span>
            </span>
            <span className="text-on-primary/60">|</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-on-primary/95 truncate">
              <Clock aria-hidden="true" className="size-3.5 text-secondary shrink-0" />
              <span>{settings.businessHours || "Mon–Sat: 8:00 AM – 7:00 PM (Sunday Closed)"}</span>
            </span>
            <span className="hidden lg:inline text-on-primary/60">|</span>
            <span className="hidden lg:inline text-on-primary/90 text-body-xs">
              Wholesale &amp; Retail Supply • Direct Site Supplies
            </span>
          </div>

          {/* Right: Direct Contacts & Admin Portal Link */}
          <div className="flex items-center gap-3 shrink-0 text-body-sm">
            {settings.phone && (
              <a
                href={`tel:${settings.phone.replace(/[^0-9+]/g, "")}`}
                className="inline-flex items-center gap-1.5 text-on-primary hover:text-secondary transition-colors font-label text-label-md tabular-nums"
              >
                <Phone aria-hidden="true" className="size-3.5 text-secondary" />
                <span>Call {settings.phone}</span>
              </a>
            )}
            {settings.whatsappNumber && (
              <>
                <span className="text-on-primary/60">|</span>
                <WhatsAppButton
                  number={settings.whatsappNumber}
                  message={whatsappMessage}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1 text-label-md font-medium text-secondary hover:text-secondary hover:bg-primary/50"
                >
                  WhatsApp
                </WhatsAppButton>
              </>
            )}
            <span className="text-on-primary/60">|</span>
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1 text-on-primary/95 hover:text-secondary transition-colors font-label text-label-md"
            >
              <Lock aria-hidden="true" className="size-3.5" />
              <span>Admin</span>
            </Link>
          </div>
        </PageContainer>
      </div>

      {/* Main Header Bar */}
      <PageContainer className="flex h-16 items-center justify-between gap-gutter-sm sm:h-20 sm:gap-gutter-md">
        {/* Brand Identity / Logo */}
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-3 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="size-10 rounded-DEFAULT bg-primary text-secondary flex items-center justify-center font-bold shadow-xs relative overflow-hidden shrink-0 border border-primary/20">
            <Building2 aria-hidden className="size-6 text-secondary" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-title-lg font-bold tracking-tight text-primary leading-tight transition-colors group-hover:text-primary/90 sm:text-headline-sm">
              {settings.name}
            </span>
            <span className="hidden truncate text-label-sm font-normal text-on-surface-variant sm:block sm:max-w-xs">
              {settings.tagline || "Building Materials & Hardware Supplier"}
            </span>
          </div>
        </Link>

        {/* Primary Desktop Navigation */}
        <nav
          aria-label="Main"
          className="hidden md:flex items-center gap-6 lg:gap-8 font-label text-label-lg"
        >
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

        {/* Streamlined Header Actions */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Enquiry List / Cart Button */}
          <EnquiryListLink className="flex items-center gap-1.5 font-medium text-body-sm px-3 py-2 border border-border rounded-DEFAULT hover:bg-surface-muted transition-colors">
            <span className="hidden sm:inline font-label text-label-md">Enquiry List</span>
          </EnquiryListLink>

          {/* Direct WhatsApp CTA Button */}
          {settings.whatsappNumber && (
            <WhatsAppButton
              number={settings.whatsappNumber}
              message={whatsappMessage}
              size="md"
              variant="secondary"
              className="hidden lg:inline-flex h-10 px-4 font-label text-label-md font-semibold rounded-DEFAULT hover:opacity-90 transition-opacity shadow-xs"
            >
              WhatsApp
            </WhatsAppButton>
          )}

          {/* Quick Quote Primary CTA Button */}
          <Link
            href="/bulk-enquiry"
            className="hidden items-center justify-center gap-2 h-10 px-4 sm:inline-flex sm:px-5 pointer-coarse:h-11 bg-primary text-on-primary font-label text-label-md font-semibold rounded-DEFAULT hover:bg-primary/90 transition-colors shadow-xs"
          >
            <ClipboardList aria-hidden className="size-4 text-secondary" />
            <span>Quick Quote</span>
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
