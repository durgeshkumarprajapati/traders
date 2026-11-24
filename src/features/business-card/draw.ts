import { brandColors as c } from "@/config/brand";
import type { BusinessCardData } from "./data";

/**
 * The ONE renderer of the visiting card. The on-screen preview and the downloaded PNG both call `drawBusinessCard` with the same
 * data, so they cannot drift apart. It draws onto any Canvas 2D context (browser canvas, or a Node canvas in tests) in fixed design
 * units (640 × 440, the natural width of the approved design) multiplied by `scale`.
 *
 * Layout follows the approved reference design: navy/amber strip, logo + name + tagline + GSTIN badge, category strip, contact rows
 * with icon tiles, QR card, navy footer band. Only configured values are drawn; the reference's sample texts are never used.
 */
export const CARD_WIDTH = 640;
export const CARD_HEIGHT = 440;

type Ctx = CanvasRenderingContext2D;
export type CardImage = { source: CanvasImageSource; width: number; height: number };
export type DrawOptions = {
  scale: number;
  /** Font list for the canvas, e.g. the self-hosted Inter plus fallbacks. */
  fontFamily: string;
  /** Loaded logo, or null/undefined to draw the built-in emblem. */
  logo?: CardImage | null;
};

const STRIP = 10;
const PAD = 28;
const INNER = CARD_WIDTH - PAD * 2; // 584
const FOOTER_H = 40;
const RADIUS = 12;

const font = (weight: number, size: number, family: string) => `${weight} ${size}px ${family}`;

/**
 * Breaks text into at most `maxLines` lines no wider than `maxWidth` (the caller sets `ctx.font` first). A token wider than a
 * line (a very long email or URL) is split by characters; if text remains after the last line it is ellipsised.
 */
export function wrapText(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  type Piece = { text: string; joined: boolean };
  const pieces: Piece[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (ctx.measureText(word).width <= maxWidth) {
      pieces.push({ text: word, joined: false });
      continue;
    }
    let chunk = "";
    let first = true;
    for (const ch of word) {
      if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
        pieces.push({ text: chunk, joined: !first });
        first = false;
        chunk = ch;
      } else chunk += ch;
    }
    if (chunk) pieces.push({ text: chunk, joined: !first });
  }
  const lines: string[] = [];
  let line = "";
  for (const p of pieces) {
    const candidate = line ? `${line}${p.joined ? "" : " "}${p.text}` : p.text;
    if (!line || ctx.measureText(candidate).width <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = p.text;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const out = lines.slice(0, maxLines);
  let last = out[maxLines - 1];
  while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
  out[maxLines - 1] = `${last.trimEnd()}…`;
  return out;
}

/** `text` itself when it fits, otherwise shortened with an ellipsis (the caller has set the font). */
function ellipsise(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Sets the largest font ≤ `start` (down to `min`) at which `text` fits on one line; returns the size used. */
function fitFont(
  ctx: Ctx,
  text: string,
  maxWidth: number,
  start: number,
  min: number,
  weight: number,
  family: string,
) {
  let size = start;
  ctx.font = font(weight, size, family);
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = font(weight, size, family);
  }
  return size;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.stroke();
}

function fillPath(ctx: Ctx, d: string) {
  if (typeof Path2D === "undefined") return; // very old/limited canvas: the tile is still drawn, just without the glyph
  ctx.fill(new Path2D(d));
}

// Material icon glyphs (24×24 viewBox, Apache-2.0): call, mail, location_on
const ICON_CALL =
  "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z";
const ICON_MAIL =
  "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z";
const ICON_PIN =
  "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z";

type Tone = "navy" | "amber" | "muted";
function iconTile(ctx: Ctx, x: number, y: number, tone: Tone, glyph: string) {
  const bg = tone === "navy" ? c.primary : tone === "amber" ? c.secondary : c.surfaceMuted;
  const fg = tone === "navy" ? c.onPrimary : tone === "amber" ? c.onSecondary : c.primary;
  if (tone === "muted") panel(ctx, x, y, 32, 32, 6, bg);
  else {
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, 32, 32, 6);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(x + 8, y + 8);
  ctx.scale(16 / 24, 16 / 24);
  ctx.fillStyle = fg;
  fillPath(ctx, glyph);
  ctx.restore();
}

/** The approved emblem (same artwork as public/icons/icon.svg) on a 56 px tile. */
function drawEmblem(ctx: Ctx, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 512, size / 512);
  ctx.fillStyle = c.primary;
  roundRect(ctx, 0, 0, 512, 512, 96);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = c.onPrimary;
  ctx.lineWidth = 2;
  roundRect(ctx, 20, 20, 472, 472, 80);
  ctx.stroke();
  ctx.restore();
  ctx.translate(96, 96);
  ctx.fillStyle = c.onPrimary;
  fillPath(ctx, "M160 20L44 88V152L160 84L276 152V88L160 20Z");
  ctx.fillStyle = c.secondary;
  fillPath(ctx, "M160 20L276 88V130L160 62V20Z");
  const bar = (bx: number, by: number, bw: number, bh: number, fill: string) => {
    ctx.fillStyle = fill;
    roundRect(ctx, bx, by, bw, bh, 6);
    ctx.fill();
  };
  bar(64, 168, 44, 128, c.onPrimary);
  bar(138, 132, 44, 164, c.secondary);
  bar(212, 168, 44, 128, c.onPrimary);
  bar(44, 280, 232, 24, c.onPrimary);
  bar(138, 280, 138, 24, c.secondary);
  ctx.restore();
  // hairline border like the reference tile
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, size - 1, size - 1, 8);
  ctx.stroke();
}

function drawLogoImage(ctx: Ctx, img: CardImage, x: number, y: number, size: number) {
  panel(ctx, x, y, size, size, 8, c.surface);
  const pad = 4;
  const k = Math.min((size - pad * 2) / img.width, (size - pad * 2) / img.height);
  const w = img.width * k;
  const h = img.height * k;
  ctx.drawImage(img.source, x + (size - w) / 2, y + (size - h) / 2, w, h);
}

function drawQr(
  ctx: Ctx,
  qr: { size: number; modules: string },
  x: number,
  y: number,
  box: number,
) {
  const quiet = 2; // white margin inside the (white) QR tile; the tile and card supply the rest of the quiet zone
  const cell = Math.floor((box * 100) / (qr.size + quiet * 2)) / 100;
  const total = cell * (qr.size + quiet * 2);
  const ox = x + (box - total) / 2;
  const oy = y + (box - total) / 2;
  ctx.fillStyle = c.surface;
  roundRect(ctx, ox, oy, total, total, 4);
  ctx.fill();
  ctx.fillStyle = c.primary;
  for (let r = 0; r < qr.size; r++)
    for (let col = 0; col < qr.size; col++)
      if (qr.modules[r * qr.size + col] === "1")
        ctx.fillRect(ox + (col + quiet) * cell, oy + (r + quiet) * cell, cell + 0.25, cell + 0.25);
}

type ContactRow = {
  label: string;
  value: string;
  tone: Tone;
  glyph: string;
  size: number;
  weight: number;
  lh: number;
  maxLines: number;
};

export function contactRows(d: BusinessCardData): ContactRow[] {
  const rows: ContactRow[] = [];
  const strong = { size: 14, weight: 600, lh: 20, maxLines: 1 };
  if (d.phone)
    rows.push({
      label: d.phoneIsWhatsapp ? "Phone & WhatsApp" : "Phone",
      value: d.phone,
      tone: "navy",
      glyph: ICON_CALL,
      ...strong,
    });
  if (d.whatsapp)
    rows.push({ label: "WhatsApp", value: d.whatsapp, tone: "navy", glyph: ICON_CALL, ...strong });
  if (d.email)
    rows.push({
      label: "Email",
      value: d.email,
      tone: "amber",
      glyph: ICON_MAIL,
      size: 14,
      weight: 400,
      lh: 20,
      maxLines: 1,
    });
  if (d.address)
    rows.push({
      label: "Address",
      value: d.address,
      tone: "muted",
      glyph: ICON_PIN,
      size: 12,
      weight: 400,
      lh: 16,
      maxLines: 2,
    });
  return rows;
}

export function drawBusinessCard(ctx: Ctx, d: BusinessCardData, opts: DrawOptions): void {
  const f = opts.fontFamily;
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;
  ctx.save();
  ctx.setTransform(opts.scale, 0, 0, opts.scale, 0, 0);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // White everywhere (so the PNG has no transparent corners), then the rounded card.
  ctx.fillStyle = c.surface;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  roundRect(ctx, 0, 0, W, H, RADIUS);
  ctx.clip();

  // Accent strip: navy 4/5, amber 1/5
  ctx.fillStyle = c.primary;
  ctx.fillRect(0, 0, W * 0.8, STRIP);
  ctx.fillStyle = c.secondary;
  ctx.fillRect(W * 0.8, 0, W * 0.2, STRIP);

  // ---- Header: emblem/logo, name, tagline, GSTIN badge
  let y = STRIP + PAD;
  const textX = PAD + 56 + 16;
  let badgeW = 0;
  if (d.gstin) {
    ctx.font = font(500, 11, f);
    badgeW = ctx.measureText(`GSTIN: ${d.gstin}`).width + 22;
    panel(ctx, W - PAD - badgeW, y, badgeW, 24, 6, c.surfaceMuted);
    ctx.fillStyle = c.onSurfaceVariant;
    ctx.fillText(`GSTIN: ${d.gstin}`, W - PAD - badgeW + 11, y + 16);
  }
  const textW = W - PAD - (badgeW ? badgeW + 16 : 0) - textX;
  ctx.font = font(400, 14, f);
  const taglineLines = d.tagline ? wrapText(ctx, d.tagline, textW, 2) : [];
  const blockH = 32 + (taglineLines.length ? 2 + taglineLines.length * 20 : 0);
  const headerH = Math.max(56, blockH);
  const logoY = y + (headerH - 56) / 2;
  if (opts.logo) drawLogoImage(ctx, opts.logo, PAD, logoY, 56);
  else drawEmblem(ctx, PAD, logoY, 56);
  const blockTop = y + (headerH - blockH) / 2;
  ctx.fillStyle = c.primary;
  fitFont(ctx, d.name, textW, 24, 16, 700, f);
  ctx.fillText(ellipsise(ctx, d.name, textW), textX, blockTop + 24);
  ctx.fillStyle = c.onSurfaceVariant;
  ctx.font = font(400, 14, f);
  taglineLines.forEach((line, i) => ctx.fillText(line, textX, blockTop + 32 + 2 + 15 + i * 20));
  y += headerH;

  // ---- Measure the remaining sections so everything fits above the footer without overlap
  ctx.font = font(600, 12, f);
  const catItems = d.categories;
  const flowCategories = (maxRows: number) => {
    const rows: string[][] = [[]];
    let x = 0;
    const room = INNER - 32;
    for (const item of catItems) {
      const w = ctx.measureText(item).width;
      const need = (rows[rows.length - 1].length ? 8 + ctx.measureText("•").width + 8 : 0) + w;
      if (rows[rows.length - 1].length && x + need > room) {
        if (rows.length === maxRows) break;
        rows.push([]);
        x = 0;
      }
      const sep = rows[rows.length - 1].length ? 8 + ctx.measureText("•").width + 8 : 0;
      rows[rows.length - 1].push(item);
      x += sep + w;
    }
    return rows;
  };
  const hasQr = Boolean(d.qr && d.website);
  const qrW = 181;
  const leftW = hasQr ? 383 : INNER;
  const textColW = leftW - 44;
  const rows = contactRows(d).map((r) => {
    ctx.font = font(r.weight, r.size, f);
    const size =
      r.maxLines === 1 ? fitFont(ctx, r.value, textColW, r.size, 10, r.weight, f) : r.size;
    ctx.font = font(r.weight, size, f);
    const lines = wrapText(ctx, r.value, textColW, r.maxLines);
    const textH = 14 + lines.length * r.lh;
    return { r, size, lines, h: Math.max(r.tone === "muted" ? 34 : 32, textH) };
  });
  const qrH = 12 + 88 + 8 + 14 + 12;
  const available = H - FOOTER_H - 20 - y;
  const layout = (gap: number, catRows: number) => {
    const cats = catItems.length ? flowCategories(catRows) : [];
    const catsH = cats.length ? 24 + cats.length * 16 + (cats.length - 1) * 8 : 0;
    const rowsH =
      rows.reduce((s, r) => s + r.h, 0) + Math.max(rows.length - 1, 0) * (gap === 24 ? 12 : 8);
    const blockH2 = Math.max(rowsH, hasQr ? qrH : 0);
    const total = (catsH ? gap + catsH : 0) + (blockH2 ? gap + blockH2 : 0);
    return { cats, catsH, rowsH, blockH2, total, gap, rowGap: gap === 24 ? 12 : 8 };
  };
  let L = layout(24, 2);
  if (L.total > available) L = layout(14, 2);
  if (L.total > available) L = layout(14, 1);

  // ---- Categories strip
  if (L.cats.length) {
    y += L.gap;
    panel(ctx, PAD, y, INNER, L.catsH, 6, c.surfaceMuted);
    ctx.font = font(600, 12, f);
    L.cats.forEach((row, ri) => {
      let x = PAD + 16;
      const base = y + 12 + ri * 24 + 12;
      row.forEach((item, i) => {
        if (i > 0) {
          x += 8;
          ctx.fillStyle = c.onSurfaceVariant;
          ctx.fillText("•", x, base);
          x += ctx.measureText("•").width + 8;
        }
        ctx.fillStyle = c.primary;
        ctx.fillText(item, x, base);
        x += ctx.measureText(item).width;
      });
    });
    y += L.catsH;
  }

  // ---- Contact rows (left) and QR card (right), vertically centred against each other
  if (L.blockH2) {
    y += L.gap;
    let ry = y + (L.blockH2 - L.rowsH) / 2;
    for (const { r, size, lines, h } of rows) {
      iconTile(ctx, PAD, ry + (r.tone === "muted" ? 2 : 0), r.tone, r.glyph);
      ctx.fillStyle = c.onSurfaceVariant;
      ctx.font = font(500, 11, f);
      ctx.fillText(r.label, PAD + 44, ry + 11);
      ctx.fillStyle = c.onSurface;
      ctx.font = font(r.weight, size, f);
      lines.forEach((line, i) =>
        ctx.fillText(line, PAD + 44, ry + 14 + (r.lh === 20 ? 15 : 12) + i * r.lh),
      );
      ry += h + L.rowGap;
    }
    if (hasQr && d.qr) {
      const qx = W - PAD - qrW;
      const qy = y + (L.blockH2 - qrH) / 2;
      panel(ctx, qx, qy, qrW, qrH, 8, c.surfaceMuted);
      drawQr(ctx, d.qr, qx + (qrW - 88) / 2, qy + 12, 88);
      ctx.fillStyle = c.primary;
      const cap = "Scan to visit our website";
      fitFont(ctx, cap, qrW - 20, 11, 9, 500, f);
      ctx.textAlign = "center";
      ctx.fillText(cap, qx + qrW / 2, qy + 12 + 88 + 8 + 11);
      ctx.textAlign = "left";
    }
  }

  // ---- Footer band: opening hours (or the website), and the card label
  ctx.fillStyle = c.primary;
  ctx.fillRect(0, H - FOOTER_H, W, FOOTER_H);
  ctx.font = font(500, 11, f);
  const label = "Digital Visiting Card";
  const labelW = ctx.measureText(label).width;
  ctx.fillStyle = c.secondary;
  ctx.fillText(label, W - PAD - labelW, H - FOOTER_H + 24);
  const left = d.hours ?? d.website?.host ?? "";
  if (left) {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = c.onPrimary;
    ctx.fillText(ellipsise(ctx, left, W - PAD * 2 - labelW - 16), PAD, H - FOOTER_H + 24);
    ctx.globalAlpha = 1;
  }
  ctx.restore(); // clip

  // Card border
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, W - 1, H - 1, RADIUS);
  ctx.stroke();
  ctx.restore();
}

/** A short plain-text description of what the card shows (for the preview's accessible name). */
export function describeCard(d: BusinessCardData): string {
  const parts = [`Visiting card for ${d.name}`];
  if (d.tagline) parts.push(d.tagline);
  if (d.gstin) parts.push(`GSTIN: ${d.gstin}`);
  for (const r of contactRows(d)) parts.push(`${r.label.toLowerCase()}: ${r.value}`);
  if (d.categories.length) parts.push(`categories: ${d.categories.join(", ")}`);
  if (d.hours) parts.push(`hours: ${d.hours}`);
  if (d.website) parts.push(`website: ${d.website.host}`);
  return parts.join(". ");
}
