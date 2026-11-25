"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { t } from "@/features/i18n/dictionary";
import { useLocale } from "@/features/i18n/store";
import { pickText, TOUR_DEFINITIONS } from "@/features/tours/config";
import { tourStore, useTourState } from "@/features/tours/store";

export function GuidedTourProvider() {
  const locale = useLocale();
  const tour = useTourState();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const activeDef = TOUR_DEFINITIONS.find((d) => d.id === tour.activeTourId) ?? null;
  const activeStep = activeDef?.steps[tour.stepIndex] ?? null;

  // Navigate if step specifies a route and we are not on it
  useEffect(() => {
    if (!activeStep?.route) return;
    if (pathname !== activeStep.route) {
      router.push(activeStep.route);
    }
  }, [activeStep, pathname, router]);

  // Scroll target element into view when step changes
  useEffect(() => {
    if (!activeStep) return;
    const timer = setTimeout(() => {
      const el = document.querySelector(activeStep.target);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.setAttribute("data-tour-active", "true");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      document
        .querySelectorAll('[data-tour-active="true"]')
        .forEach((n) => n.removeAttribute("data-tour-active"));
    };
  }, [activeStep, pathname]);

  // Escape closes active tour
  useEffect(() => {
    if (!activeStep) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tourStore.skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeStep]);

  if (!mounted) return null;

  // 1. Active guided tour floating card (non-blocking bottom-right / bottom-center on mobile)
  if (activeDef && activeStep) {
    const isLast = tour.stepIndex + 1 >= activeDef.steps.length;
    return (
      <div
        role="dialog"
        aria-label={pickText(activeStep.title, locale)}
        className="fixed bottom-4 right-4 left-4 z-50 mx-auto max-w-md sm:left-auto"
      >
        <Card className="border-2 border-primary bg-surface p-gutter-md shadow-overlay space-y-gutter-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-label-sm font-semibold text-primary">
                Step {tour.stepIndex + 1} of {activeDef.steps.length} •{" "}
                {pickText(activeDef.name, locale)}
              </p>
              <h2 className="text-title-lg font-bold text-on-surface">
                {pickText(activeStep.title, locale)}
              </h2>
            </div>
            <button
              type="button"
              aria-label={t(locale, "tour.skip")}
              onClick={() => tourStore.skip()}
              className="rounded p-1 text-on-surface-variant hover:bg-surface-muted"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <p className="text-body-md text-on-surface">{pickText(activeStep.description, locale)}</p>
          <p className="rounded bg-surface-muted p-2 text-body-sm text-on-surface-variant">
            <strong>{t(locale, "tour.purposeLabel")} </strong>
            {pickText(activeStep.purpose, locale)}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={tour.stepIndex === 0}
                onClick={() => tourStore.prev()}
              >
                {t(locale, "tour.previous")}
              </Button>
              <Button type="button" size="sm" variant="primary" onClick={() => tourStore.next()}>
                {isLast ? t(locale, "tour.finish") : t(locale, "tour.next")}
              </Button>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => tourStore.skip()}>
              {t(locale, "tour.skip")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 2. First-time visitor non-blocking welcome banner (only on homepage)
  if (!tour.welcomeDismissed && pathname === "/") {
    return (
      <div
        role="region"
        aria-label={t(locale, "welcome.title")}
        className="fixed bottom-4 right-4 left-4 z-40 mx-auto max-w-lg sm:left-auto"
      >
        <Card className="border-2 border-secondary bg-surface p-gutter-md shadow-overlay space-y-gutter-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-primary">
              <Compass aria-hidden className="size-5 text-secondary shrink-0" />
              <h2 className="text-title-lg font-bold">{t(locale, "welcome.title")}</h2>
            </div>
            <button
              type="button"
              aria-label={t(locale, "welcome.skipTour")}
              onClick={() => tourStore.dismissWelcome()}
              className="rounded p-1 text-on-surface-variant hover:bg-surface-muted"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
          <p className="text-body-md text-on-surface-variant">{t(locale, "welcome.body")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => tourStore.start("welcome-overview")}
            >
              {t(locale, "welcome.startTour")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => tourStore.dismissWelcome()}
            >
              {t(locale, "welcome.explore")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => tourStore.dismissWelcome()}
            >
              {t(locale, "welcome.skipTour")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}
