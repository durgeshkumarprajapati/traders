import type { MetadataRoute } from "next";
import { isIndexingEnabled } from "@/config/indexing";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexingEnabled()) {
    // Pre-launch: ask crawlers to stay away from everything.
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/dev",
        "/track-enquiry",
        "/quotation",
        "/my-material-lists",
        "/rate-alerts/confirm",
        "/rate-alerts/unsubscribe",
      ],
    },
  };
}
