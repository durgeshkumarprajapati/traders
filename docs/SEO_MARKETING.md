# Local SEO & Marketing Guide

## 1. Implemented Features
- **Service-Area Landing Pages (`/areas/[slug]`):** Admin-managed at `/admin/service-areas`. Only `PUBLISHED` areas are publicly accessible and included in `/sitemap.xml`.
- **Project Showcase (`/projects`, `/projects/[slug]`):** Includes `Article` JSON-LD structured data and Open Graph metadata.
- **Product SEO (`/products/[slug]`):** Canonical URLs, Open Graph, Twitter cards, and `Product` JSON-LD using real Google Sheets data only.
- **Private Routes Protection:** `/admin`, `/api`, `/track-enquiry`, `/quotation`, `/order`, and `/my-material-lists` are disallowed in `/robots.txt` and served with `noindex, nofollow`, `no-store`, and `no-referrer`.

## 2. Google Search Console & Business Profile Setup
1. **Google Search Console:** Verify the production domain via DNS TXT record, then submit `https://<domain>/sitemap.xml` once `SITE_INDEXING=enabled`.
2. **Google Business Profile:** Keep business name, phone, address, and opening hours synchronized with Google Sheets `BusinessSettings` so structured data matches your public listing.
