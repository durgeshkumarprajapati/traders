# Digital Quotation Management & PDF Generation

**Project:** Sagar Traders  
**Scope:** Admin Quotation Generation, Public Customer Quotation View & Pure TypeScript PDF 1.4 Generation  
**Routes:** `/admin/enquiries/[id]`, `/quotation/[token]`, `/api/quotation/[token]/pdf`

---

## 1. Overview & Architecture

Sagar Traders enables administrators to draft, revise, and issue formal price quotations linked directly to customer enquiries. Customers can view the responsive digital quotation online and download an authentic PDF document.

### Zero Third-Party Cloud PDF Dependencies

In strict accordance with the project architecture:

- **No external paid PDF APIs** (no DocRaptor, PDFShift, Puppeteer microservice, etc.).
- **Pure TypeScript PDF 1.4 Generator** (`src/features/quotations/server/pdf.ts`) implemented in ~400 lines of standard library code.
- Builds binary PDF document structure, catalog, info dictionary, page tree, typography font dictionary (Helvetica/Helvetica-Bold), vector graphics (ruling lines, headers, badges), and text stream objects.
- Runs natively on Edge / Node.js runtime inside Vercel without headless Chrome binaries or external OS font packages.

---

## 2. Quotation Lifecycle & Versioning

```
[Customer Enquiry]
        │
        ▼
[Admin: Create Quotation Draft] ──► (Version 1, Status: DRAFT)
        │
        ├── Add / Remove Quotation Items
        ├── Enter Quantities, Unit Prices, Discounts, Taxes (GST 18%)
        ├── Set Validity Date & Delivery Terms
        │
        ▼
[Admin: Issue Quotation] ──► (Status: ISSUED, Status History Updated)
        │
        ├── Generates / Reuses Secure Tracking Token
        ├── Customer views `/quotation/[token]`
        └── Customer downloads `/api/quotation/[token]/pdf`
        │
        ▼
[Optional: Revise Quotation] ──► (Version 2, Status: REVISED / DRAFT)
```

---

## 3. Precision Financial Calculations

Implemented in `src/features/quotations/calculations.ts`:

- **Line Total:** `round(quantity * unitPrice, 2)`
- **Subtotal:** `sum(lineTotals)`
- **Discount:** Clamped to `[0, Subtotal]`
- **Taxable Base:** `Subtotal - Discount`
- **Tax (GST):** `round(TaxableBase * (taxRate / 100), 2)`
- **Grand Total:** `TaxableBase + Tax`
- All calculations adhere to 2-decimal Indian Rupee formatting (`Intl.NumberFormat("en-IN")`).

---

## 4. Public Quotation View (`/quotation/[token]`)

Features:

- Formal Sagar Traders business identity header (GSTIN, address, contact numbers).
- Customer delivery address and quotation reference.
- Itemized materials table with quantities, canonical unit labels, unit rates, and totals.
- Tax and discount breakdown with grand total.
- Terms & conditions and quotation validity period banner.
- One-click "Download PDF" button.
- One-click "Share via WhatsApp" button with prefilled quotation summary and link.
- One-click "Track Enquiry Timeline" button linking back to `/track-enquiry`.
