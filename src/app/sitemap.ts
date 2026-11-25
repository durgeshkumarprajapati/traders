import type { MetadataRoute } from "next";
import { loadCatalogue } from "@/features/catalogue/server";
import { listPublicProjects } from "@/features/projects/server/projects";
import { listPublicServiceAreas } from "@/features/seo/service-areas";
import { publicEnv } from "@/lib/env/public";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/bulk-enquiry`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...[
      "/tools",
      "/tools/material-calculator",
      "/tools/project-planner",
      "/compare",
      "/delivery-check",
      "/ask-expert",
      "/rate-alerts",
      "/projects",
    ].map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  try {
    const [load, projects, areas] = await Promise.all([
      loadCatalogue(),
      listPublicProjects(),
      listPublicServiceAreas(),
    ]);
    const dynamicRoutes: MetadataRoute.Sitemap = [
      ...projects.map((p) => ({
        url: `${baseUrl}/projects/${p.slug}`,
        lastModified: new Date(p.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
      ...areas.map((a) => ({
        url: `${baseUrl}/areas/${a.slug}`,
        lastModified: new Date(a.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ];
    if (load.ok) {
      const productRoutes: MetadataRoute.Sitemap = load.catalogue.products.map((p) => ({
        url: `${baseUrl}/products/${p.slug}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
        changeFrequency: "weekly",
        priority: p.isFeatured ? 0.8 : 0.6,
      }));
      return [...staticRoutes, ...productRoutes, ...dynamicRoutes];
    }
    return [...staticRoutes, ...dynamicRoutes];
  } catch {
    // If catalogue loading fails during sitemap generation, return base static routes
  }

  return staticRoutes;
}
