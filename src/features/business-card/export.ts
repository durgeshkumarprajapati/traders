import type { BusinessCardData } from "./data";
import { CARD_HEIGHT, CARD_WIDTH, drawBusinessCard, type CardImage } from "./draw";

/** Export size: 3× the 640×440 design = 1920×1320 px: sharp on phones, in messaging apps and in print. */
export const EXPORT_SCALE = 3;
export const PREVIEW_MAX_SCALE = 2;

const FONT_TIMEOUT_MS = 3000;
const IMAGE_TIMEOUT_MS = 5000;
const FALLBACK_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const timeout = (ms: number) => new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms));

/** The page's own body font (the self-hosted Inter that next/font registers), with a safe fallback list. */
export function resolveFontFamily(doc: Document = document): string {
  const fam = doc.defaultView?.getComputedStyle(doc.body).fontFamily?.trim();
  return fam ? `${fam}, ${FALLBACK_FONT}` : FALLBACK_FONT;
}

/**
 * Waits (bounded) until the weights the card uses are loaded, so the first draw never uses a fallback by accident. Never throws:
 * `false` means the font could not be confirmed and the card will be drawn with the fallback list (still readable).
 */
export async function ensureFonts(family: string, doc: Document = document): Promise<boolean> {
  const fonts = doc.fonts;
  if (!fonts?.load) return false;
  try {
    const loads = Promise.all(
      [400, 500, 600, 700, 800].map((w) => fonts.load(`${w} 24px ${family}`)),
    );
    const r = await Promise.race([loads.then(() => "ok" as const), timeout(FONT_TIMEOUT_MS)]);
    return r === "ok";
  } catch {
    return false;
  }
}

/** Loads the configured logo for canvas use. CORS-enabled (otherwise the canvas would be tainted and unexportable); `null` on any failure → built-in mark. */
export function loadLogo(url: string | null): Promise<CardImage | null> {
  if (!url || !/^https:\/\//i.test(url) || typeof Image === "undefined")
    return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const t = setTimeout(() => resolve(null), IMAGE_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(t);
      resolve(
        img.naturalWidth > 0
          ? { source: img, width: img.naturalWidth, height: img.naturalHeight }
          : null,
      );
    };
    img.onerror = () => {
      clearTimeout(t);
      resolve(null);
    };
    img.src = url;
  });
}

export type RenderDeps = {
  createCanvas?: (w: number, h: number) => HTMLCanvasElement;
  doc?: Document;
};

function makeCanvas(w: number, h: number, deps: RenderDeps): HTMLCanvasElement {
  if (deps.createCanvas) return deps.createCanvas(w, h);
  const c = (deps.doc ?? document).createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export class CardExportError extends Error {
  constructor(
    readonly code: "NO_CANVAS" | "ENCODE_FAILED",
    message: string,
  ) {
    super(message);
  }
}

/** Draws the card at export resolution and encodes it as a real PNG. Always includes the logo when it loads; falls back otherwise. */
export async function renderCardPng(data: BusinessCardData, deps: RenderDeps = {}): Promise<Blob> {
  const doc = deps.doc ?? document;
  const family = resolveFontFamily(doc);
  await ensureFonts(family, doc); // a failure only means the fallback font is used
  const logo = await loadLogo(data.logoUrl).catch(() => null);
  const canvas = makeCanvas(CARD_WIDTH * EXPORT_SCALE, CARD_HEIGHT * EXPORT_SCALE, deps);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CardExportError("NO_CANVAS", "This browser cannot create images.");
  drawBusinessCard(ctx, data, { scale: EXPORT_SCALE, fontFamily: family, logo });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob || blob.size === 0 || (blob.type && blob.type !== "image/png"))
    throw new CardExportError("ENCODE_FAILED", "The image could not be created.");
  return blob;
}

/** Starts a browser download of `blob`. The object URL is released shortly after (long enough for mobile browsers to start saving). */
export function downloadBlob(blob: Blob, filename: string, doc: Document = document): string {
  const url = URL.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  doc.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}

/** True when this browser can share an image FILE through the native share sheet. */
export function canShareImageFiles(
  nav: Navigator | undefined = typeof navigator === "undefined" ? undefined : navigator,
): boolean {
  if (!nav || typeof nav.share !== "function" || typeof nav.canShare !== "function") return false;
  try {
    return nav.canShare({
      files: [new File([new Blob(["x"], { type: "image/png" })], "x.png", { type: "image/png" })],
    });
  } catch {
    return false;
  }
}

export type ShareOutcome = "shared" | "cancelled" | "unsupported" | "failed";

export async function shareCardFile(
  blob: Blob,
  filename: string,
  title: string,
  nav: Navigator = navigator,
): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: "image/png" });
  if (
    typeof nav.share !== "function" ||
    typeof nav.canShare !== "function" ||
    !nav.canShare({ files: [file] })
  )
    return "unsupported";
  try {
    await nav.share({ files: [file], title });
    return "shared";
  } catch (error) {
    return error instanceof DOMException && error.name === "AbortError" ? "cancelled" : "failed";
  }
}
