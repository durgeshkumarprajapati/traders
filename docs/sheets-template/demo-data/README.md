# Google Sheets Demonstration Data for Sagar Traders

This directory provides complete, copy-ready CSV files containing realistic demonstration building materials data. Importing these files into your Google Spreadsheet will immediately populate the website catalogue with realistic product prices, stock availability, categories, brands, and business settings.

> **Important:** All prices, stock quantities, and brand references in these demonstration CSVs are **illustrative sample data** for evaluation and demonstration purposes. In production, actual rates and stock must be confirmed with Sagar Traders management.
>
> The website displays the mandatory public price disclaimer:  
> _"Prices are indicative and subject to change. Please confirm the final rate before placing an order."_

---

## 1. File to Worksheet Mapping

| CSV File                     | Target Worksheet (Tab) Name in Google Sheets | Order of Import | Description                                                                                                                                                    |
| ---------------------------- | -------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories-demo.csv`        | `Categories`                                 | **1st**         | 6 primary building material categories (Cement, Steel & TMT, Bricks & Blocks, Sand & Aggregates, Hardware & Plumbing, Other Materials).                        |
| `brands-demo.csv`            | `Brands`                                     | **2nd**         | 6 illustrative manufacturer brands.                                                                                                                            |
| `products-demo.csv`          | `Products`                                   | **3rd**         | 22 detailed building materials products across all 6 categories, with realistic Indian Rupee prices, canonical units, stock statuses, and JSON specifications. |
| `business-settings-demo.csv` | `BusinessSettings`                           | **4th**         | Company profile, contact phone/WhatsApp, business hours, GSTIN, announcement banner, and 6 Why Choose Us value proposition pairs.                              |

---

## 2. Step-by-Step Instructions: Adding Demo Data to Google Sheets

### Step 1: Open Your Configured Google Spreadsheet

Open the Google Spreadsheet whose ID is set in your `.env` file under `GOOGLE_SHEET_ID`. Ensure your service account (`GOOGLE_SERVICE_ACCOUNT_EMAIL`) has been granted **Editor** access.

### Step 2: Create the Worksheet Tabs

Google Spreadsheets start with a single tab named `Sheet1`. Rename or add tabs with the **exact case-sensitive names**:

1. `Categories`
2. `Brands`
3. `Products`
4. `BusinessSettings`
5. _(Optional)_ `PriceHistory`

### Step 3: Import Each CSV File

For each tab:

1. Click the worksheet tab at the bottom (e.g. `Categories`).
2. Go to **File → Import → Upload**.
3. Select or drag the corresponding demo CSV file (e.g. `categories-demo.csv`).
4. In the Import file dialog:
   - **Import location:** Select **"Replace current sheet"** (or **"Insert new sheet"** if creating tabs automatically).
   - **Separator type:** Select **"Detect automatically"** (or **"Comma"**).
   - Click **"Import data"**.
5. Repeat for:
   - `brands-demo.csv` → into `Brands` tab
   - `products-demo.csv` → into `Products` tab
   - `business-settings-demo.csv` → into `BusinessSettings` tab
6. If the original empty `Sheet1` is still present and not needed, right-click and delete it.

### Step 4: Avoid Overwriting Real Business Data

- If your spreadsheet already contains real business records, **do NOT choose "Replace current sheet"**.
- Instead, open the demo CSV files in a text editor or spreadsheet software, copy only the specific data rows (excluding the header row), and paste them below your existing rows, ensuring IDs and slugs remain unique.

---

## 3. How to Verify Live Data on the Website

1. **Wait for Cache Revalidation (or Save in Admin Console):**
   - The application caches spreadsheet reads for up to 30 minutes.
   - To trigger an immediate cache refresh, navigate to `/admin/settings` or `/admin/products` in the authenticated admin console and click **"Save"**, or restart the development server.
2. **Verify Homepage (`/`):**
   - The homepage hero carousel shows configured categories and rates.
   - Featured materials display the demonstration products marked `is_featured = TRUE` with active Indian Rupee rates (e.g. `₹385 / Bag`).
   - The 6 "Why Choose Us" cards reflect the values from `BusinessSettings`.
3. **Verify Products Listing (`/products`):**
   - All 22 demonstration products appear with their respective categories, brands, prices, and stock status badges (`In Stock`, `Limited Stock`, `Out of Stock`, `Available on Order`).
   - Filters by category, brand, and stock status correctly filter the live spreadsheet records.
4. **Verify Product Detail (`/products/[slug]`):**
   - Navigating to e.g. `/products/durasteel-fe-550d-tmt-rebars-12mm` displays the full technical specifications table, indicative price, and "Add to Enquiry" button.
5. **Verify Bulk Enquiry (`/bulk-enquiry`):**
   - The product picker dropdown populates with the 22 materials from the spreadsheet.

---

## 4. How to Remove or Archive Demonstration Records Later

When you are ready to transition from demonstration data to genuine business records:

1. **Option A: Non-Destructive Archiving (Recommended)**
   - In Google Sheets, set the `is_active` column for the demo product rows to `FALSE`.
   - The application will immediately hide them from customer-facing pages while preserving historical enquiry reference integrity.
2. **Option B: Replacement**
   - In Google Sheets, replace the demo product rows with genuine Sagar Traders inventory rows, matching the exact column headers specified in `docs/sheets-template/Products.csv`.
   - Ensure that any product IDs previously referenced in customer enquiries are archived (`is_active = FALSE`) rather than physically deleted, to avoid orphaned enquiry snapshot issues.

---

## 5. Summary of Demonstration Products Included

| Product ID                | Product Name                                      | Category            | Unit            | Price (₹)  | Stock Status         | Featured |
| ------------------------- | ------------------------------------------------- | ------------------- | --------------- | ---------- | -------------------- | -------- |
| `prod-cem-ppc-01`         | BuildPro Premium PPC Cement 50kg                  | Cement              | `BAG`           | ₹385.00    | `IN_STOCK`           | Yes      |
| `prod-cem-opc53-02`       | BuildPro High-Strength OPC 53 Grade Cement        | Cement              | `BAG`           | ₹410.00    | `IN_STOCK`           | Yes      |
| `prod-cem-opc43-03`       | Standard OPC 43 Grade Cement 50kg                 | Cement              | `BAG`           | ₹395.00    | `LIMITED_STOCK`      | No       |
| `prod-cem-white-04`       | Special White Portland Cement 25kg                | Cement              | `BAG`           | ₹540.00    | `AVAILABLE_ON_ORDER` | No       |
| `prod-stl-tmt12-05`       | DuraSteel Fe 550D TMT Rebars 12mm                 | Steel & TMT         | `TON`           | ₹64,500.00 | `IN_STOCK`           | Yes      |
| `prod-stl-tmt16-06`       | DuraSteel Fe 550D TMT Rebars 16mm                 | Steel & TMT         | `TON`           | ₹64,500.00 | `IN_STOCK`           | No       |
| `prod-stl-tmt10-07`       | DuraSteel Fe 500D TMT Rebars 10mm                 | Steel & TMT         | `TON`           | ₹63,800.00 | `LIMITED_STOCK`      | No       |
| `prod-stl-bindwire-08`    | Annealed Steel Binding Wire 18 Gauge              | Steel & TMT         | `KG`            | ₹78.00     | `IN_STOCK`           | No       |
| `prod-brk-redclay-09`     | First-Class Red Clay Kiln Bricks                  | Bricks & Blocks     | `PIECE`         | ₹9.50      | `IN_STOCK`           | Yes      |
| `prod-brk-aac8-10`        | Prime Masonry AAC Lightweight Blocks 8 Inch       | Bricks & Blocks     | `PIECE`         | ₹62.00     | `IN_STOCK`           | Yes      |
| `prod-brk-aac4-11`        | Prime Masonry AAC Lightweight Blocks 4 Inch       | Bricks & Blocks     | `PIECE`         | ₹34.00     | `LIMITED_STOCK`      | No       |
| `prod-brk-flyash-12`      | High-Strength Fly Ash Modular Bricks              | Bricks & Blocks     | `PIECE`         | ₹7.20      | `OUT_OF_STOCK`       | No       |
| `prod-snd-river-13`       | Washed Coarse River Sand for Concrete             | Sand & Aggregates   | `BRASS`         | ₹4,200.00  | `IN_STOCK`           | Yes      |
| `prod-snd-msand-14`       | Manufactured M-Sand for RCC Works                 | Sand & Aggregates   | `BRASS`         | ₹3,600.00  | `IN_STOCK`           | No       |
| `prod-agg-20mm-15`        | Crushed Blue Metal Stone Aggregate 20mm           | Sand & Aggregates   | `BRASS`         | ₹3,800.00  | `IN_STOCK`           | No       |
| `prod-agg-10mm-16`        | Crushed Blue Metal Stone Aggregate 10mm           | Sand & Aggregates   | `BRASS`         | ₹3,900.00  | `AVAILABLE_ON_ORDER` | No       |
| `prod-plm-upvc4-17`       | FlowTech Heavy-Duty UPVC Drainage Pipe 4 Inch     | Hardware & Plumbing | `PIECE`         | ₹480.00    | `IN_STOCK`           | No       |
| `prod-plm-cpvc1-18`       | FlowTech SDR 11 CPVC Hot & Cold Water Pipe 1 Inch | Hardware & Plumbing | `PIECE`         | ₹290.00    | `IN_STOCK`           | No       |
| `prod-plm-brassvalve-19`  | Standard Full-Bore Brass Ball Valve 1 Inch        | Hardware & Plumbing | `PIECE`         | ₹365.00    | `LIMITED_STOCK`      | No       |
| `prod-oth-waterproof-20`  | EcoBind Integral Liquid Waterproofing Compound 5L | Other Materials     | `PIECE`         | ₹680.00    | `IN_STOCK`           | No       |
| `prod-oth-tileadhes-21`   | EcoBind Polymer-Modified Tile Adhesive 20kg       | Other Materials     | `BAG`           | ₹340.00    | `IN_STOCK`           | No       |
| `prod-oth-customjoint-22` | Modular Expansion Joint Sealant Strip 25m         | Other Materials     | `CUSTOM` (Roll) | ₹1,250.00  | `AVAILABLE_ON_ORDER` | No       |
