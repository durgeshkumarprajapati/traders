# Request a Callback Workflow

**Project:** Sagar Traders  
**Scope:** Quick Lead Capture & Scheduled Assistance  
**Components:** `src/features/enquiries/callback-actions.ts`, `src/components/website/callback-modal.tsx`, `src/features/enquiries/server/submit.ts`

---

## 1. Overview

Customers on construction sites often require immediate verbal pricing, bulk load scheduling, or technical guidance but may not have time to fill a detailed bill of materials.

"Request a Callback" provides a fast, frictionless modal and form across:

- Site Header ("Request Callback" action)
- Contact Page
- Product Detail Pages ("Ask for Callback on this Material")

---

## 2. Reusing Enquiry Architecture

Rather than creating a disjoint lead system, callback requests reuse the proven `type = 'GENERAL'` enquiry pipeline:

1. An enquiry record is inserted into `public.enquiries`:
   - `type = 'GENERAL'`
   - `customer_name`, `mobile`, `notes` (callback topic or question)
   - Tracking token generated for immediate status tracking.
2. Structured callback metadata is inserted into `public.enquiry_callbacks`:
   - `preferred_date`: Optional selected date.
   - `preferred_time_window`: `'MORNING'` (9am–12pm), `'AFTERNOON'` (12pm–4pm), `'EVENING'` (4pm–7pm), or `'ANYTIME'`.
   - `reason`: Specific material or enquiry topic.
3. Notification dispatched to admin via Web3Forms with high-priority "CALLBACK REQUEST" subject and timing preferences.

---

## 3. Anti-Spam & Rate Limiting

- **Honeypot Protection:** Hidden input fields catch automated scrapers without user disruption.
- **Sliding-Window Rate Limiting:** Max 5 callback requests per IP per hour.
- **Indian Mobile Validation:** Strict 10-digit mobile validation (`^[6-9][0-9]{9}$`).
