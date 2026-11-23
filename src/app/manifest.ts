import type { MetadataRoute } from "next";
import { brandColors } from "@/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sagar Traders",
    short_name: "Sagar Traders",
    description: "Quality Building Materials & Direct Site Supplies",
    id: "/",
    start_url: "/",
    scope: "/",
    lang: "en-IN",
    dir: "ltr",
    categories: ["business", "shopping"],
    display: "standalone",
    background_color: brandColors.surface,
    theme_color: brandColors.primary,
    // No orientation lock: users on tablets / with rotated screens must not be forced into portrait (WCAG 1.3.4).
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
