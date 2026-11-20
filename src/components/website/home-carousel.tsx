"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ShieldCheck, ChevronRight } from "lucide-react";
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

  const effectiveSlides = useMemo(() => {
    if (!tagline) return slides;
    return slides.map((s, idx) => (idx === 0 ? { ...s, description: tagline } : s));
  }, [slides, tagline]);

  const total = effectiveSlides.length;
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
    // Check user preference for reduced motion
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

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="Homepage Building Materials Highlights"
      className={cn(
        "relative overflow-hidden bg-primary text-on-primary select-none",
        "min-h-[440px] md:min-h-[500px] lg:min-h-[540px]",
        className,
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
    >
      {/* Slide rendering */}
      {effectiveSlides.map((slide, index) => {
        const isActive = index === current;
        const hasImage = slide.imageSrc && !failedImages[slide.id];

        return (
          <div
            key={slide.id}
            role="tabpanel"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${total}: ${slide.title}`}
            aria-hidden={!isActive}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-in-out",
              isActive
                ? "opacity-100 z-10 pointer-events-auto"
                : "opacity-0 z-0 pointer-events-none",
            )}
          >
            {/* Background Image / Architectural Fallback */}
            {hasImage ? (
              <div className="absolute inset-0 overflow-hidden">
                <Image
                  src={slide.imageSrc!}
                  alt={slide.altText}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 1024px) 100vw, 1440px"
                  className="object-cover"
                  onError={() => {
                    setFailedImages((prevMap) => ({ ...prevMap, [slide.id]: true }));
                  }}
                />
                {/* High contrast gradient overlay for text readability */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/80 to-primary/40"
                  aria-hidden="true"
                />
              </div>
            ) : (
              <div className="absolute inset-0 bg-primary" aria-hidden="true">
                {/* Subtle architectural geometric grid pattern */}
                <svg
                  className="absolute inset-0 h-full w-full text-secondary/15"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <pattern
                      id="architectural-grid"
                      width="40"
                      height="40"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 40 0 L 0 0 0 40"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                      />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#architectural-grid)" />
                </svg>
              </div>
            )}

            {/* Slide Content */}
            <div className="relative z-10 flex h-full items-center">
              <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-16">
                <div className="max-w-2xl lg:max-w-3xl">
                  {/* Badge */}
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary/20 px-3 py-1 text-label-sm font-medium text-secondary border border-secondary/40 backdrop-blur-sm">
                    <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
                    <span>{slide.badge}</span>
                  </div>

                  {/* Headline */}
                  <h1 className="mt-3 text-display-lg-mobile md:text-display-lg font-bold tracking-tight text-on-primary leading-tight">
                    {slide.title}
                  </h1>

                  {/* Description */}
                  <p className="mt-4 text-body-lg text-on-primary/85 line-clamp-3 md:line-clamp-none max-w-xl">
                    {slide.description}
                  </p>

                  {/* Actions */}
                  <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
                    <ButtonLink
                      href={slide.primaryCta.href}
                      size="lg"
                      variant="secondary"
                      className="font-semibold shadow-md hover:shadow-lg"
                    >
                      {slide.primaryCta.label}
                      <ChevronRight aria-hidden="true" className="size-4 ml-1" />
                    </ButtonLink>

                    {slide.secondaryCta && (
                      <ButtonLink
                        href={slide.secondaryCta.href}
                        size="lg"
                        variant="outline"
                        className="bg-on-primary/10 text-on-primary border-on-primary/30 hover:bg-on-primary/20 backdrop-blur-sm"
                      >
                        {slide.secondaryCta.label}
                      </ButtonLink>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Navigation Controls */}
      {total > 1 && (
        <>
          {/* Previous / Next Arrow Buttons */}
          <div className="absolute inset-y-0 left-0 right-0 z-20 pointer-events-none flex items-center justify-between px-3 sm:px-6">
            <button
              type="button"
              onClick={prev}
              aria-label="Previous slide"
              className={cn(
                "pointer-events-auto rounded-full p-2.5 sm:p-3 text-on-primary/80 hover:text-on-primary",
                "bg-primary/70 hover:bg-primary border border-on-primary/20 backdrop-blur-sm",
                "transition-all duration-200 focus-visible:outline-2 focus-visible:outline-secondary",
              )}
            >
              <ArrowLeft aria-hidden="true" className="size-5 sm:size-6" />
            </button>

            <button
              type="button"
              onClick={next}
              aria-label="Next slide"
              className={cn(
                "pointer-events-auto rounded-full p-2.5 sm:p-3 text-on-primary/80 hover:text-on-primary",
                "bg-primary/70 hover:bg-primary border border-on-primary/20 backdrop-blur-sm",
                "transition-all duration-200 focus-visible:outline-2 focus-visible:outline-secondary",
              )}
            >
              <ArrowRight aria-hidden="true" className="size-5 sm:size-6" />
            </button>
          </div>

          {/* Pagination Indicators (Dots) */}
          <div
            role="tablist"
            aria-label="Carousel pagination"
            className="absolute bottom-4 sm:bottom-6 left-0 right-0 z-20 flex justify-center items-center gap-2 pointer-events-auto"
          >
            {effectiveSlides.map((slide, idx) => {
              const isSelected = idx === current;
              return (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-label={`Go to slide ${idx + 1} of ${total}: ${slide.badge}`}
                  onClick={() => goTo(idx)}
                  className={cn(
                    "h-2.5 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-secondary",
                    isSelected
                      ? "w-8 bg-secondary"
                      : "w-2.5 bg-on-primary/40 hover:bg-on-primary/70",
                  )}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
