import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * Title only in development: in production this route renders a generic 404, so it must not
 * advertise a "Component showcase" title.
 */
export function generateMetadata(): Metadata {
  const robots = { index: false, follow: false };
  return process.env.NODE_ENV !== "production"
    ? { title: "Component showcase", robots }
    : { robots };
}

/**
 * Development-only component gallery.
 *
 * `process.env.NODE_ENV` is inlined at build time, so in a production build the
 * `if` below is statically false and the bundler eliminates the dynamic import —
 * the showcase code never reaches the production output. The route itself still
 * exists but always renders a 404 there.
 */
export default async function Page() {
  if (process.env.NODE_ENV !== "production") {
    const { Showcase } = await import("./showcase");
    return <Showcase />;
  }
  notFound();
}
