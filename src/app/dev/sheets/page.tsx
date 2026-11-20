import type { Metadata } from "next";
import { notFound } from "next/navigation";

export function generateMetadata(): Metadata {
  const robots = { index: false, follow: false };
  return process.env.NODE_ENV !== "production"
    ? { title: "Sheets diagnostics", robots }
    : { robots };
}

/**
 * Development-only Google Sheets connectivity check (404 in production; the diagnostics code is
 * eliminated from production builds like the component showcase). Shows configuration status,
 * record counts and data issues — never credentials.
 */
export default async function Page() {
  if (process.env.NODE_ENV !== "production") {
    const { SheetsDiagnostics } = await import("./diagnostics");
    return <SheetsDiagnostics />;
  }
  notFound();
}
