import type { MetadataRoute } from "next";
import { brandColors } from "@/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sagar Traders",
    short_name: "Sagar Traders",
    description: "Quality Building Materials & Direct Site Supplies",
    start_url: "/",
    display: "standalone",
    background_color: brandColors.surface,
    theme_color: brandColors.primary,
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
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
