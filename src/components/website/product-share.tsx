"use client";

import { useState } from "react";
import { Check, Copy, Download, Share2 } from "lucide-react";
import { Button, ButtonAnchor } from "@/components/ui/button";

/**
 * "Share this product": QR code (generated on the server, encodes only the public product URL), download as PNG or SVG, copy
 * link, and the device's share sheet where available.
 */
export function ProductShare({ slug, name, url }: { slug: string; name: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const base = `/api/qr/product/${slug}`;
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: name, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      /* the customer closed the share sheet */
    }
  }
  return (
    <section
      aria-labelledby="share-heading"
      className="rounded-md border border-border p-gutter-md"
    >
      <h2 id="share-heading" className="text-title-lg font-bold text-primary">
        Share this product
      </h2>
      <div className="mt-gutter-sm flex flex-col gap-gutter-md sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small generated SVG; next/image adds nothing here */}
        <img
          src={`${base}?format=svg`}
          alt={`QR code that opens the ${name} page`}
          width={160}
          height={160}
          className="size-40 shrink-0 rounded border border-border bg-surface p-1"
        />
        <div className="space-y-2">
          <p className="text-body-md text-on-surface-variant">
            Scan with a phone camera to open this product page.
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonAnchor
              href={`${base}?format=png&size=768&download=1`}
              size="sm"
              variant="outline"
              download
            >
              <Download aria-hidden className="mr-1.5 size-4" />
              Download PNG
            </ButtonAnchor>
            <ButtonAnchor
              href={`${base}?format=svg&download=1`}
              size="sm"
              variant="outline"
              download
            >
              <Download aria-hidden className="mr-1.5 size-4" />
              Download SVG
            </ButtonAnchor>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}
            >
              {copied ? (
                <Check aria-hidden className="mr-1.5 size-4" />
              ) : (
                <Copy aria-hidden className="mr-1.5 size-4" />
              )}
              {copied ? "Link copied" : "Copy link"}
            </Button>
            <Button size="sm" variant="outline" onClick={share}>
              <Share2 aria-hidden className="mr-1.5 size-4" />
              Share
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
