"use client";

import { Compass, Eye, Globe } from "lucide-react";
import { t } from "@/features/i18n/dictionary";
import { setEasyMode, setLocale, useEasyMode, useLocale } from "@/features/i18n/store";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/features/i18n/types";
import { tourStore } from "@/features/tours/store";

export function ExperienceControls() {
  const locale = useLocale();
  const easyMode = useEasyMode();

  return (
    <div className="flex flex-wrap items-center gap-2 text-body-sm">
      <div className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-1">
        <Globe aria-hidden className="size-3.5 text-primary" />
        <label htmlFor="site-language-select" className="sr-only">
          Language
        </label>
        <select
          id="site-language-select"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="bg-transparent text-label-md font-medium text-on-surface focus:outline-none"
        >
          {SUPPORTED_LOCALES.map((loc) => (
            <option key={loc} value={loc}>
              {LOCALE_LABELS[loc]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => setEasyMode(!easyMode)}
        aria-pressed={easyMode}
        title={t(locale, "controls.easyModeTitle")}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded border px-2.5 py-1 text-label-md font-medium transition-colors ${
          easyMode
            ? "border-primary bg-primary text-on-primary"
            : "border-border bg-surface text-on-surface hover:bg-surface-muted"
        }`}
      >
        <Eye aria-hidden className="size-3.5" />
        <span>{t(locale, "controls.easyMode")}</span>
      </button>

      <button
        type="button"
        onClick={() => tourStore.start("welcome-overview")}
        className="inline-flex min-h-9 items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1 text-label-md font-medium text-primary hover:bg-surface-muted transition-colors"
      >
        <Compass aria-hidden className="size-3.5" />
        <span>{t(locale, "controls.takeTour")}</span>
      </button>
    </div>
  );
}
