"use client";

import { useEffect, useRef } from "react";
import type { BusinessCardData } from "@/features/business-card/data";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  describeCard,
  drawBusinessCard,
} from "@/features/business-card/draw";
import {
  PREVIEW_MAX_SCALE,
  ensureFonts,
  loadLogo,
  resolveFontFamily,
} from "@/features/business-card/export";

/**
 * On-screen preview of the visiting card. It runs the SAME `drawBusinessCard` the PNG export uses (same data, same layout), onto a
 * canvas that scales with its container, so what the customer sees is what they download. Drawn once immediately (so it is never
 * blank) and again when the font and logo have loaded.
 */
export function BusinessVisitingCard({ data }: { data: BusinessCardData }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;
    const scale = Math.min(PREVIEW_MAX_SCALE, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(CARD_WIDTH * scale);
    canvas.height = Math.round(CARD_HEIGHT * scale);
    const draw = (family: string, logo: Awaited<ReturnType<typeof loadLogo>>) => {
      const ctx = canvas.getContext("2d");
      if (ctx && !cancelled) drawBusinessCard(ctx, data, { scale, fontFamily: family, logo });
    };
    const family = resolveFontFamily();
    draw(family, null);
    void (async () => {
      await ensureFonts(family);
      const logo = await loadLogo(data.logoUrl).catch(() => null);
      draw(family, logo);
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={describeCard(data)}
      className="block aspect-[16/11] h-auto w-full max-w-2xl rounded-md border border-border bg-surface shadow-xs"
    />
  );
}
