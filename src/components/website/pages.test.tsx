import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { enquiryList } from "@/features/enquiries/enquiry-list-store";
import { PRICE_DISCLAIMER } from "@/features/products/format";
import { EMPTY_SHEETS, loadFrom, realisticSheets } from "@/features/catalogue/test-catalogue";
import { BulkEnquiryContent } from "./bulk-enquiry-content";
import { ContactContent } from "./contact-content";
import { HomeContent } from "./home-content";
import { ProductDetail, productMetadata } from "./product-detail";
import { ProductListing } from "./product-listing";
import { AnnouncementSlot, FooterSlot, HeaderSlot } from "./site-chrome";

const server = vi.hoisted(() => ({ loadCatalogue: vi.fn(), loadSettings: vi.fn() }));
vi.mock("@/features/catalogue/server", () => server);
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/form", () => ({
  default: ({
    action,
    ...rest
  }: { action: string; children: ReactNode } & Record<string, unknown>) => (
    <form action={action} {...rest} />
  ),
}));
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    className,
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}));

type Sheets = Record<string, unknown[][]>;
async function serve(sheets: Sheets) {
  const load = await loadFrom(sheets);
  server.loadCatalogue.mockResolvedValue(load);
  server.loadSettings.mockResolvedValue(load.settings);
  return load;
}
function unavailable() {
  server.loadCatalogue.mockResolvedValue({ ok: false });
  server.loadSettings.mockResolvedValue({
    name: "Sagar Traders",
    tagline: null,
    phone: null,
    whatsappNumber: null,
    email: null,
    address: null,
    businessHours: null,
    gstNumber: null,
    googleMapsUrl: null,
    deliveryCoverage: null,
    announcement: null,
    social: {},
    whyChooseUs: [],
  });
}
const sheetsWithoutSettings = (): Sheets => ({
  ...realisticSheets(),
  BusinessSettings: [["setting_key", "setting_value"]],
});
const params = (p: Record<string, string | string[]> = {}) => Promise.resolve(p);
const listing = async (p: Record<string, string | string[]> = {}) =>
  render(await ProductListing({ searchParams: params(p) }));
const detail = async (slug: string) =>
  render(await ProductDetail({ params: Promise.resolve({ slug }) }));
const cards = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  server.loadCatalogue.mockReset();
  server.loadSettings.mockReset();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  enquiryList._reset();
});

describe("homepage (real data)", () => {
  it("shows configured categories, images, featured products, rates, brands and contact info", async () => {
    await serve(realisticSheets());
    render(await HomeContent());
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Test tagline for materials")).toBeInTheDocument();

    const catSection = screen.getByRole("region", { name: "Product categories" });
    expect(
      within(catSection)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href"))
        .filter((h) => h?.startsWith("/products?category=")),
    ).toEqual([
      "/products?category=cement",
      "/products?category=steel-tmt",
      "/products?category=bricks-blocks",
    ]); // inactive "Hardware" is hidden; display_order respected
    expect(
      [...catSection.querySelectorAll("img")].map((i) => i.getAttribute("src")), // decorative (alt="") so no img role
    ).toEqual(["https://res.cloudinary.com/test-cloud/image/upload/bricks.jpg"]); // image only where configured

    const featured = screen.getByRole("region", { name: "Featured products" });
    expect(
      within(featured)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent)
        .sort(),
    ).toEqual(["Cement PPC 50kg", "Pipe Set", "TMT 12mm"]);

    const rates = screen.getByRole("region", { name: "Indicative rates" });
    const row = (name: string) => within(rates).getByRole("link", { name }).closest("tr")!;
    expect(row("Cement PPC 50kg")).toHaveTextContent("₹385.00");
    expect(row("Cement PPC 50kg")).toHaveTextContent("17 Nov 2026");
    expect(row("TMT 12mm")).toHaveTextContent("Available on Order");
    expect(within(rates).getByText(PRICE_DISCLAIMER)).toBeInTheDocument();

    const brands = screen.getByRole("region", { name: "Brands" });
    expect(within(brands).getByText("Brand One")).toBeInTheDocument();
    expect(within(brands).queryByText("Brand Three")).toBeNull(); // inactive brand
    expect(brands.querySelector("img")).toHaveAttribute("src", expect.stringContaining("b1.png"));

    const contact = screen.getByRole("region", { name: "Contact" });
    expect(contact).toHaveTextContent("+1 555 010 1111");
    expect(within(contact).getByRole("link", { name: "hello@example.test" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /WhatsApp/ })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/15550109999?text="),
    );
  });

  it("contains no sample data or placeholder text", async () => {
    await serve(realisticSheets());
    render(await HomeContent());
    expect(document.body.textContent).not.toMatch(/Sample|Placeholder|owner-approved/i);
  });

  it("shows 'Why choose us' ONLY with the owner-written statements from business settings", async () => {
    await serve(realisticSheets());
    render(await HomeContent());
    const why = screen.getByRole("region", { name: "Why choose us" });
    expect(
      within(why)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(["Test advantage one", "Test advantage two"]); // the half-filled third item is ignored
    expect(why).toHaveTextContent("Owner-written description one.");
    expect(why).not.toHaveTextContent("Half-filled item");
    // Sections keep the documented order: rates → why choose us → brands.
    const order = screen
      .getAllByRole("region")
      .map((r) => r.getAttribute("aria-label") ?? r.getAttribute("aria-labelledby"));
    expect(order.indexOf("rates-heading")).toBeLessThan(order.indexOf("why-heading"));
    expect(order.indexOf("why-heading")).toBeLessThan(order.indexOf("brands-heading"));
  });

  it("hides 'Why choose us' when no statements are configured (no placeholder, no invented claims)", async () => {
    await serve(sheetsWithoutSettings());
    render(await HomeContent());
    expect(screen.queryByRole("region", { name: "Why choose us" })).toBeNull();
    cleanup();
    unavailable();
    render(await HomeContent());
    expect(screen.queryByRole("region", { name: "Why choose us" })).toBeNull();
  });

  it("hides contact information when no contact settings are configured (and keeps the default tagline copy)", async () => {
    await serve(sheetsWithoutSettings());
    render(await HomeContent());
    expect(screen.queryByRole("region", { name: "Contact" })).toBeNull();
    expect(screen.queryByText("Test tagline for materials")).toBeNull();
    expect(screen.getByRole("region", { name: "Product categories" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /WhatsApp/ })).toBeNull(); // no number → no WhatsApp action at all
  });

  it("hides empty optional sections (no categories image/brands → section omitted, not a placeholder)", async () => {
    const s = realisticSheets();
    s.Brands = [s.Brands[0]]; // header only
    await serve(s);
    render(await HomeContent());
    expect(screen.queryByRole("region", { name: "Brands" })).toBeNull();
  });

  it("shows an honest unavailable state (no sample products) when the sheet cannot be read", async () => {
    unavailable();
    render(await HomeContent());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Product information is temporarily unavailable",
    );
    expect(screen.queryByRole("region", { name: "Featured products" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Indicative rates" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(); // hero stays
    expect(screen.getByRole("link", { name: "Request bulk quotation" })).toBeInTheDocument(); // enquiry path stays
    expect(document.body.textContent).not.toMatch(/Sample/);
  });

  it("an empty catalogue is explained differently from a failure", async () => {
    await serve(EMPTY_SHEETS());
    render(await HomeContent());
    expect(screen.getByText("No products are listed yet")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("product listing (real data)", () => {
  it("shows only active products, 8 per page, with accurate counts and page links", async () => {
    await serve(realisticSheets());
    await listing();
    expect(cards()).toHaveLength(8);
    expect(screen.getByText("Showing 1–8 of 17 products")).toBeInTheDocument();
    expect(screen.queryByText("Retired Item")).toBeNull(); // inactive
    expect(screen.queryByText("In Inactive Category")).toBeNull();
    expect(screen.queryByText("Inactive Brand Item")).toBeNull();
    const pager = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(pager).getByRole("link", { name: "Page 2" })).toHaveAttribute(
      "href",
      "/products?page=2",
    );
    expect(within(pager).getByRole("link", { name: "Page 3" })).toHaveAttribute(
      "href",
      "/products?page=3",
    );
    cleanup();
    await listing({ page: "3" });
    expect(screen.getByText("Showing 17–17 of 17 products")).toBeInTheDocument();
    expect(cards()).toHaveLength(1);
  });

  it("searches case-insensitively and shows an empty-result state with a way back", async () => {
    await serve(realisticSheets());
    await listing({ q: "TMT" });
    expect(cards().sort()).toEqual(["TMT 10mm", "TMT 12mm"]);
    cleanup();
    await listing({ q: "zzz-no-such-thing" });
    expect(screen.getByText("No products match your filters")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear all filters" })).toHaveAttribute(
      "href",
      "/products",
    );
  });

  it("filters by category, brand and availability (incl. AVAILABLE_ON_ORDER) and combinations", async () => {
    await serve(realisticSheets());
    await listing({ category: "steel-tmt" });
    expect(cards().sort()).toEqual(["TMT 10mm", "TMT 12mm"]);
    cleanup();
    await listing({ brand: "brand-two" });
    expect(cards().sort()).toEqual(["Cement OPC 53", "Red Bricks", "TMT 10mm"]);
    cleanup();
    await listing({ stock: "AVAILABLE_ON_ORDER" });
    expect(cards()).toEqual(["TMT 12mm"]);
    cleanup();
    await listing({ category: "steel-tmt", brand: "brand-two", stock: "OUT_OF_STOCK" });
    expect(cards()).toEqual(["TMT 10mm"]);
  });

  it("does not offer inactive categories or brands as filters, and reflects the current selection", async () => {
    await serve(realisticSheets());
    await listing({
      category: "steel-tmt",
      brand: "brand-one",
      stock: "LIMITED_STOCK",
      q: "x",
      sort: "price-asc",
    });
    const form = screen.getAllByRole("form", { name: "Filter products" })[0];
    expect(within(form).queryByRole("radio", { name: "Hardware" })).toBeNull();
    expect(within(form).queryByRole("checkbox", { name: "Brand Three" })).toBeNull();
    expect(within(form).getByRole("radio", { name: "Steel & TMT" })).toBeChecked();
    expect(within(form).getByRole("checkbox", { name: "Brand One" })).toBeChecked();
    expect(within(form).getByRole("checkbox", { name: "Limited Stock" })).toBeChecked();
    expect(within(form).getByRole("combobox", { name: "Sort by" })).toHaveValue("price-asc");
  });

  it("sorts by price with unpriced products last (never as zero)", async () => {
    await serve(realisticSheets());
    await listing({ sort: "price-asc", category: "cement" });
    expect(cards()[0]).toBe("Extra Cement 10"); // 100: cheapest first
    cleanup();
    await listing({ sort: "price-asc", category: "cement", page: "2" });
    expect(cards().at(-1)).toBe("Cement OPC 53"); // no price → always last (across pages), never treated as 0
    cleanup();
    await listing({ sort: "price-desc", category: "cement" });
    expect(cards()[0]).toBe("Cement PPC 50kg"); // 385 is the highest cement price
  });

  it("keeps filter state in pagination links", async () => {
    await serve(realisticSheets());
    await listing({ category: "cement", sort: "price-desc", brand: "brand-one" });
    const next = screen.getByRole("link", { name: /Next/ });
    expect(next).toHaveAttribute(
      "href",
      "/products?category=cement&brand=brand-one&sort=price-desc&page=2",
    );
  });

  it("ignores hostile query parameters instead of failing", async () => {
    await serve(realisticSheets());
    await listing({
      category: "../../etc",
      sort: "DROP",
      page: "-5",
      stock: "HACK",
      brand: "<script>",
      q: "x".repeat(500),
    });
    expect(screen.getByText("No products match your filters")).toBeInTheDocument(); // long q matches nothing; no crash
  });

  it("shows prices only when valid, and the exact disclaimer", async () => {
    await serve(realisticSheets());
    await listing({ q: "cement" });
    expect(
      screen.getByRole("heading", { level: 3, name: "Cement PPC 50kg" }).closest("li"),
    ).toHaveTextContent("₹385.00 / Bag");
    expect(
      screen.getByRole("heading", { level: 3, name: "Cement OPC 53" }).closest("li"),
    ).toHaveTextContent("Rate on request");
    expect(screen.getByText(PRICE_DISCLAIMER)).toBeInTheDocument();
  });

  it("shows an unavailable state when the sheet cannot be read, and a distinct empty-catalogue state", async () => {
    unavailable();
    await listing();
    expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(cards()).toEqual(["Product information is temporarily unavailable"]); // no product cards at all
    cleanup();
    await serve(EMPTY_SHEETS());
    await listing();
    expect(screen.getByText("No products are listed yet")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("product detail (real data)", () => {
  it("shows the configured product with real price, unit, date, SKU, availability and disclaimer", async () => {
    await serve(realisticSheets());
    await detail("cement-ppc-50kg");
    expect(screen.getByRole("heading", { level: 1, name: "Cement PPC 50kg" })).toBeInTheDocument();
    expect(screen.getByText("₹385.00 / Bag")).toBeInTheDocument();
    expect(screen.getByText("Updated: 17 Nov 2026")).toBeInTheDocument();
    expect(screen.getByText("SKU: C-1")).toBeInTheDocument();
    expect(screen.getAllByText("In Stock").length).toBeGreaterThan(0);
    expect(screen.getByText("Pack: 50 kg bag")).toBeInTheDocument(); // pack description lives in the description, not the unit
    expect(screen.getByText(PRICE_DISCLAIMER)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /WhatsApp enquiry/ })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("wa.me/15550109999"),
    );
    expect(screen.getByRole("link", { name: "Cement" })).toHaveAttribute(
      "href",
      "/products?category=cement",
    ); // breadcrumb
    expect(screen.getByRole("region", { name: "Related products" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Specifications" })).toBeNull(); // none configured → section omitted
  });

  it("does not invent images: a placeholder is shown when no image is configured", async () => {
    await serve(realisticSheets());
    await detail("cement-ppc-50kg");
    expect(
      screen.getByRole("img", { name: "No image available for Cement PPC 50kg" }),
    ).toBeInTheDocument();
    cleanup();
    await detail("pipe-set");
    expect(screen.getByRole("img", { name: "Pipe Set" })).toHaveAttribute(
      "src",
      expect.stringContaining("pipe.jpg"),
    );
  });

  it("shows specifications, METRIC_TON label and AVAILABLE_ON_ORDER", async () => {
    await serve(realisticSheets());
    await detail("tmt-12mm");
    expect(screen.getAllByText("Available on Order").length).toBeGreaterThan(0);
    expect(screen.getByText("₹62,500.00 / Metric Ton")).toBeInTheDocument();
    const specs = screen.getByRole("region", { name: "Specifications" });
    expect(within(specs).getByRole("rowheader", { name: "Size" })).toBeInTheDocument();
    expect(within(specs).getByText("12 mm")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Quantity in Metric Ton" })).toBeInTheDocument();
  });

  it.each([
    ["tmt-10mm", "Out of Stock", "Ton"], // TON is not METRIC_TON; invalid price "abc" → no price
    ["cement-opc-53", "Limited Stock", "Bag"], // blank price
  ])(
    "%s: %s, unit %s, 'Rate on request' for a missing or invalid price",
    async (slug, status, unit) => {
      await serve(realisticSheets());
      await detail(slug);
      expect(screen.getAllByText(status).length).toBeGreaterThan(0);
      const mainRate = document.querySelector("p.text-headline-md"); // the product's own rate (related cards may show prices)
      expect(mainRate).toHaveTextContent("Rate on request");
      expect(mainRate).not.toHaveTextContent("₹");
      expect(screen.getByRole("group", { name: `Quantity in ${unit}` })).toBeInTheDocument();
    },
  );

  it("shows the custom unit label and piece pricing", async () => {
    await serve(realisticSheets());
    await detail("pipe-set");
    expect(screen.getByText("₹120.00 / Set")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Quantity in Set" })).toBeInTheDocument();
    cleanup();
    await detail("red-bricks");
    expect(screen.getByText("₹9.50 / Piece")).toBeInTheDocument();
  });

  it("returns not-found for inactive, excluded, unknown and malformed slugs", async () => {
    await serve(realisticSheets());
    for (const slug of [
      "retired-item",
      "in-inactive-category",
      "inactive-brand-item",
      "no-such-product",
      "../etc/passwd",
      "UPPER",
      "",
    ]) {
      await expect(ProductDetail({ params: Promise.resolve({ slug }) }), slug).rejects.toThrow(
        "NEXT_NOT_FOUND",
      );
    }
  });

  it("shows an unavailable state (not a not-found, not sample data) when the sheet cannot be read", async () => {
    unavailable();
    await detail("cement-ppc-50kg");
    expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("builds metadata from the real product, and a generic title otherwise", async () => {
    await serve(realisticSheets());
    expect((await productMetadata(Promise.resolve({ slug: "tmt-12mm" }))).title).toBe("TMT 12mm");
    expect((await productMetadata(Promise.resolve({ slug: "retired-item" }))).title).toBe(
      "Product",
    );
    unavailable();
    expect((await productMetadata(Promise.resolve({ slug: "tmt-12mm" }))).title).toBe("Product");
  });
});

describe("bulk enquiry (real data)", () => {
  const search = (q: string) =>
    fireEvent.change(screen.getByLabelText(/Add a product/), { target: { value: q } });

  it("lets customers pick active products, including AVAILABLE_ON_ORDER, with real units and availability", async () => {
    await serve(realisticSheets());
    render(await BulkEnquiryContent());
    search("tmt 12");
    fireEvent.click(screen.getByRole("button", { name: /Add TMT 12mm/ }));
    expect(screen.getByText("Available on Order")).toBeInTheDocument(); // availability shown on the item
    expect(screen.getByText("Metric Ton")).toBeInTheDocument(); // the product's real unit
    expect(screen.getByText(/Indicative rate ₹62,500\.00 \/ Metric Ton/)).toBeInTheDocument();
    search("pipe");
    fireEvent.click(screen.getByRole("button", { name: /Add Pipe Set/ }));
    expect(screen.getByText("Set")).toBeInTheDocument(); // custom display label
  });

  it("cannot select inactive or excluded products, and flags stale ids as unavailable", async () => {
    await serve(realisticSheets());
    act(() => void enquiryList.add("off", 2)); // an id from an earlier session for a now-inactive product
    render(await BulkEnquiryContent());
    expect(screen.getByText(/no longer available/)).toBeInTheDocument();
    search("retired");
    expect(screen.getByText(/No matching products/)).toBeInTheDocument();
    search("inactive category");
    expect(screen.getByText(/No matching products/)).toBeInTheDocument();
  });

  it("shows an unavailable state or an empty-catalogue message instead of a broken form", async () => {
    unavailable();
    render(await BulkEnquiryContent());
    expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.queryByRole("form", { name: "Bulk quotation enquiry" })).toBeNull();
    cleanup();
    await serve(EMPTY_SHEETS());
    render(await BulkEnquiryContent());
    expect(screen.getByText("No products are listed yet")).toBeInTheDocument();
  });
});

describe("contact page (real data)", () => {
  it("shows configured details, map link and the form", async () => {
    await serve(realisticSheets());
    render(await ContactContent());
    expect(screen.getByText("+1 555 010 1111")).toBeInTheDocument();
    expect(screen.getByText("1 Test Street, Testville")).toBeInTheDocument();
    expect(screen.getByText("Mon–Sat 9–6")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open in Google Maps/ })).toHaveAttribute(
      "href",
      "https://maps.example.test/place",
    );
    expect(screen.getByRole("form", { name: "General enquiry" })).toBeInTheDocument();
  });
  it("omits everything unconfigured and never invents details", async () => {
    unavailable();
    render(await ContactContent());
    expect(screen.getByText(/Contact details are not available right now/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Google Maps/ })).toBeNull();
    expect(screen.getByRole("form", { name: "General enquiry" })).toBeInTheDocument(); // enquiry form still works
  });
});

describe("layout slots (business settings)", () => {
  it("header, footer and announcement use configured settings and categories", async () => {
    await serve(realisticSheets());
    render(await AnnouncementSlot());
    expect(screen.getByRole("region", { name: "Announcement" })).toHaveTextContent(
      "Test announcement",
    );
    cleanup();
    render(await HeaderSlot());
    expect(screen.getAllByText("Test Traders").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Call/ })[0]).toHaveAttribute(
      "href",
      "tel:+15550101111",
    );
    expect(screen.getAllByRole("link", { name: /WhatsApp/ })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("wa.me/15550109999"),
    );
    cleanup();
    render(await FooterSlot());
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Cement" })).toHaveAttribute(
      "href",
      "/products?category=cement",
    );
    expect(within(footer).queryByRole("link", { name: "Hardware" })).toBeNull(); // inactive category
    expect(within(footer).getByRole("link", { name: /Instagram/ })).toHaveAttribute(
      "href",
      "https://social.example.test/test",
    );
    expect(footer).toHaveTextContent("1 Test Street, Testville");
    expect(footer).toHaveTextContent(PRICE_DISCLAIMER);
  });
  it("degrade to minimal chrome (brand name + navigation only) when the sheet is unavailable", async () => {
    unavailable();
    render(await AnnouncementSlot());
    expect(screen.queryByRole("region", { name: "Announcement" })).toBeNull();
    cleanup();
    render(await HeaderSlot());
    expect(screen.getAllByText("Sagar Traders").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Call|WhatsApp/ })).toBeNull();
    cleanup();
    render(await FooterSlot());
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).queryByRole("link", { name: "Cement" })).toBeNull();
    expect(footer).not.toHaveTextContent(/Testville|555/);
  });
});
