import { NextResponse } from "next/server";
import { loadCatalogue } from "@/features/catalogue/server";
import { findProductBySlug } from "@/features/catalogue/view";

const noStore = { "cache-control": "no-store" };

/**
 * Internal existence check used by `src/proxy.ts` to return a genuine HTTP 404 for unknown/inactive
 * product slugs (a `notFound()` inside a streamed page cannot change the status code).
 * Reveals only whether an ACTIVE product with this slug exists — information the public product page
 * already exposes. 200 = exists, 404 = does not exist, 503 = catalogue unavailable (the proxy then fails open).
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const load = await loadCatalogue();
  if (!load.ok) return NextResponse.json({ available: false }, { status: 503, headers: noStore });
  const exists = Boolean(findProductBySlug(load.catalogue, slug));
  return NextResponse.json({ exists }, { status: exists ? 200 : 404, headers: noStore });
}
