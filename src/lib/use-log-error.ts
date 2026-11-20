"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

/** Log an error caught by an error boundary (redaction applied by the logger). `digest` matches server logs. */
export function useLogBoundaryError(scope: string, error: unknown) {
  useEffect(() => {
    const digest =
      error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
    logger.error("error_boundary", { scope, digest, error });
  }, [scope, error]);
}
