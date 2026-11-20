"use client";

import "./globals.css";
import { Button } from "@/components/ui/button";
import { useLogBoundaryError } from "@/lib/use-log-error";

/**
 * Replaces the root layout when the root layout itself fails, so it must render
 * its own <html>/<body> and import global styles (tokens still apply).
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useLogBoundaryError("global", error);
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <title>Something went wrong | Sagar Traders</title>
        <main
          id="main-content"
          className="mx-auto w-full max-w-7xl flex-1 px-gutter-md py-section-md md:px-gutter-lg"
        >
          <h1 className="text-headline-lg-mobile md:text-headline-xl">Something went wrong</h1>
          <p className="mt-2 mb-gutter-lg text-body-lg text-on-surface-variant">
            Please try again.
          </p>
          <Button onClick={() => retry()}>Try again</Button>
        </main>
      </body>
    </html>
  );
}
