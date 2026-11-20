"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Package, Search, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface CarouselSlide {
  id: string;
  badge: string;
  title: string;
  description: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  imageSrc?: string;
  altText: string;
  price?: string;
  unit?: string;
}

export const DEFAULT_CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    id: "slide-cement",
    badge: "Cement & Foundation Materials",
    title: "Premium Cement & Construction Supplies Direct to Site",
    description:
      "Reliable dispatch of OPC 43, OPC 53, and PPC cement grades from leading manufacturers for residential and commercial projects.",
    primaryCta: { label: "Explore Products", href: "/products" },
    secondaryCta: { label: "Get a Bulk Quote", href: "/bulk-enquiry" },
    imageSrc: "/images/carousel/cement-materials.jpeg",
    altText: "Warehouse and site delivery of premium cement bags and construction materials",
    price: "₹385",
    unit: "/ 50 kg Bag",
  },
  {
    id: "slide-steel",
    badge: "Structural Steel & TMT",
    title: "High-Strength Fe 500D & Fe 550D TMT Rebars",
    description:
      "Verified quality reinforcement steel, structural beams, and binding wire with weight precision and manufacturer test certificates.",
    primaryCta: { label: "Request Steel Quotation", href: "/bulk-enquiry" },
    secondaryCta: { label: "View Specifications", href: "/products" },
    imageSrc: "/images/carousel/tmt-steel.jpeg",
    altText: "Bundles of ribbed TMT steel reinforcement rebars ready for site delivery",
    price: "₹62,500",
    unit: "/ MT",
  },
  {
    id: "slide-bricks",
    badge: "Masonry & Aggregates",
    title: "Quality Red Bricks, Solid Blocks & Graded Aggregates",
    description:
      "Standard and fly ash bricks, AAC blocks, blue metal, and river sand supplied with prompt transport logistics.",
    primaryCta: { label: "Browse Masonry Supplies", href: "/products" },
    secondaryCta: { label: "Contact Our Desk", href: "/contact" },
    imageSrc: "/images/carousel/bricks-blocks.jpeg",
    altText: "Uniform construction bricks and masonry building materials neatly stacked",
    price: "₹68",
    unit: "/ Block",
  },
  {
    id: "slide-plumbing",
    badge: "Site Infrastructure",
    title: "Plumbing, Sanitary & Construction Hardware",
    description:
      "Heavy-duty pipes, fittings, water tanks, and essential site hardware to ensure project durability from foundation to finishing.",
    primaryCta: { label: "Send An Enquiry", href: "/bulk-enquiry" },
    secondaryCta: { label: "Contact Us", href: "/contact" },
    imageSrc: "/images/carousel/hardware-supplies.jpeg",
    altText: "Comprehensive construction hardware, pipes, and plumbing supplies",
    price: "₹340",
    unit: "/ Length",
  },
];

interface HomeCarouselProps {
  slides?: CarouselSlide[];
  tagline?: string | null;
  autoPlayIntervalMs?: number;
  className?: string;
}

export function HomeCarousel({
  slides = DEFAULT_CAROUSEL_SLIDES,
  tagline,
  autoPlayIntervalMs = 6000,
  className,
}: HomeCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const effectiveSlides = slides;

  const total = effectiveSlides.length;
  const currentSlide = effectiveSlides[current] ?? effectiveSlides[0];
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const goTo = useCallback(
    (index: number) => {
      setCurrent((index + total) % total);
    },
    [total],
  );

  const next = useCallback(() => goTo(current + 1), [goTo, current]);
  const prev = useCallback(() => goTo(current - 1), [goTo, current]);

  // Autoplay management
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (isPaused || prefersReducedMotion || total <= 1) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      goTo(current + 1);
    }, autoPlayIntervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [current, isPaused, autoPlayIntervalMs, goTo, total]);

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    }
  };

  // Touch swipe handling for mobile
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) next();
      else prev();
    }
    setTouchStartX(null);
  };

  const hasImage = Boolean(currentSlide.imageSrc && !failedImages[currentSlide.id]);

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="Homepage Building Materials Highlights"
      className={cn("relative border-b border-border bg-surface select-none", className)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          {/* Left Column: Value Proposition, Search & Primary CTAs */}
          <div className="flex flex-col gap-6 lg:col-span-7">
            <div className="inline-flex items-center gap-2 self-start rounded-md border border-border bg-surface-muted px-3 py-1">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              <span className="font-label text-label-md font-medium text-primary">
                Wholesale &amp; Retail Supply • Direct Freight Dispatch
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <h1 className="text-display-lg-mobile font-bold text-on-surface text-balance lg:text-display-lg">
                Your Trusted Partner for Quality Building Materials
              </h1>
              <p className="max-w-prose text-body-lg text-on-surface-variant">
                {tagline ?? currentSlide.description}
              </p>
            </div>

            {/* Instant Material Search Bar */}
            <form
              action="/products"
              method="get"
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted p-2 shadow-xs sm:flex-row sm:items-center"
            >
              <div className="relative flex flex-1 items-center">
                <Search
                  className="pointer-events-none absolute left-3 size-5 text-on-surface-variant"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  name="q"
                  placeholder="Search cement, 12mm TMT steel, AAC blocks, sand, or brand..."
                  className="w-full border-0 bg-transparent py-2 pl-10 pr-3 text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-0"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 font-label text-label-lg text-on-primary shadow-xs transition-colors hover:bg-primary/90"
              >
                <span>Find Materials</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </form>

            {/* Quick Filter Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-sm font-medium text-on-surface-variant">Popular:</span>
              <Link
                href="/products?category=steel-tmt"
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-label-sm text-on-surface transition-colors hover:border-primary hover:text-primary"
              >
                Fe 550D TMT Bars
              </Link>
              <Link
                href="/products?category=cement"
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-label-sm text-on-surface transition-colors hover:border-primary hover:text-primary"
              >
                PPC Grade Cement
              </Link>
              <Link
                href="/products?category=bricks-blocks"
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-label-sm text-on-surface transition-colors hover:border-primary hover:text-primary"
              >
                AAC Blocks
              </Link>
              <Link
                href="/products?category=sand"
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-label-sm text-on-surface transition-colors hover:border-primary hover:text-primary"
              >
                River Sand
              </Link>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <ButtonLink
                href="/bulk-enquiry"
                size="lg"
                variant="secondary"
                className="font-semibold shadow-xs"
              >
                Get a Bulk Quote <ChevronRight className="ml-1 size-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink
                href="/products"
                size="lg"
                variant="outline"
                className="border-border hover:bg-surface-muted"
              >
                Explore Full Catalog
              </ButtonLink>
            </div>

            {/* Trust Metrics Strip */}
            <div className="grid grid-cols-3 gap-4 border-t border-border pt-6">
              <div>
                <p className="text-headline-md font-bold text-primary">Direct Yard</p>
                <p className="text-body-sm text-on-surface-variant">Commercial Loading</p>
              </div>
              <div>
                <p className="text-headline-md font-bold text-primary">Quality Tested</p>
                <p className="text-body-sm text-on-surface-variant">Standard Stock</p>
              </div>
              <div>
                <p className="text-headline-md font-bold text-primary">Direct Freight</p>
                <p className="text-body-sm text-on-surface-variant">Site Truck Dispatch</p>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Material Spotlight Showcase */}
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
              {/* Spotlight Header Tabs (only if multiple slides) */}
              {total > 1 && (
                <div
                  role="tablist"
                  aria-label="Carousel pagination"
                  className="grid grid-flow-col auto-cols-fr border-b border-border bg-surface-muted"
                >
                  {effectiveSlides.map((s, idx) => {
                    const isSelected = idx === current;
                    const tabLabel = s.badge.includes("&") ? s.badge.split("&")[0].trim() : s.badge;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        aria-label={`Go to slide ${idx + 1} of ${total}: ${s.badge}`}
                        onClick={() => goTo(idx)}
                        className={cn(
                          "truncate px-2 py-2.5 text-center text-label-sm font-medium transition-colors",
                          isSelected
                            ? "border-b-2 border-primary bg-surface font-semibold text-primary"
                            : "text-on-surface-variant hover:text-on-surface",
                        )}
                      >
                        {tabLabel}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Spotlight Slide Container */}
              <div className="relative flex h-72 items-center justify-center overflow-hidden bg-surface-muted">
                {hasImage ? (
                  <Image
                    src={currentSlide.imageSrc!}
                    alt={currentSlide.altText}
                    fill
                    priority={current === 0}
                    className="object-cover"
                    onError={() => {
                      setFailedImages((prev) => ({ ...prev, [currentSlide.id]: true }));
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-on-surface-variant">
                    <Package className="size-16 text-primary/40" />
                  </div>
                )}
                <span className="absolute top-3 left-3 rounded-md border border-border bg-surface px-2.5 py-1 text-label-sm font-medium text-primary shadow-xs">
                  {currentSlide.badge}
                </span>
                <span className="absolute top-3 right-3 rounded-md border border-success/30 bg-surface px-2.5 py-1 text-label-sm font-medium text-success shadow-xs">
                  In Stock
                </span>
              </div>

              {/* Spotlight Info & Controls */}
              <div className="flex flex-col gap-4 bg-surface p-5">
                <div>
                  <h2 className="text-title-lg font-bold text-on-surface">{currentSlide.title}</h2>
                  <p className="mt-1 line-clamp-2 text-body-sm text-on-surface-variant">
                    {currentSlide.description}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div>
                    <span className="block text-label-sm text-on-surface-variant">
                      Indicative Rate
                    </span>
                    <span className="text-headline-sm font-bold tabular-nums text-primary">
                      {currentSlide.price ?? "Benchmark Quote"}{" "}
                      {currentSlide.unit && (
                        <span className="text-body-sm font-normal text-on-surface-variant">
                          {currentSlide.unit}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={prev}
                      aria-label="Previous slide"
                      className="flex size-9 items-center justify-center rounded-md border border-border text-on-surface transition-colors hover:bg-surface-muted"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={next}
                      aria-label="Next slide"
                      className="flex size-9 items-center justify-center rounded-md border border-border text-on-surface transition-colors hover:bg-surface-muted"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                    <ButtonLink
                      href={currentSlide.primaryCta.href}
                      size="sm"
                      variant="primary"
                      className="h-9 px-3.5"
                    >
                      {currentSlide.primaryCta.label}
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
