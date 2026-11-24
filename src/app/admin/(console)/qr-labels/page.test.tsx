import { cleanup, render, screen } from "@testing-library/react";
import { loadFrom, realisticSheets } from "@/features/catalogue/test-catalogue";

const state = vi.hoisted(() => ({ load: null as unknown }));
vi.mock("@/features/catalogue/server", () => ({ loadCatalogue: async () => state.load }));
vi.mock("@/lib/env/public", () => ({
  publicEnv: { NEXT_PUBLIC_SITE_URL: "https://shop.example.test" },
}));
vi.mock("@/components/admin/print-button", () => ({
  PrintButton: ({ label }: { label: string }) => <button>{label}</button>,
}));

import QrLabelsPage from "./page";

const page = async (ids?: string) =>
  render(await QrLabelsPage({ searchParams: Promise.resolve({ ids }) }));
afterEach(cleanup);
beforeEach(async () => {
  state.load = await loadFrom(realisticSheets());
});

describe("admin QR labels page", () => {
  it("prints a label (QR, name, SKU/unit, URL) for each selected active product", async () => {
    const products = (
      state.load as { catalogue: { products: { id: string; name: string; slug: string }[] } }
    ).catalogue.products;
    await page(`${products[0].id},${products[1].id}`);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByAltText(`QR code for ${products[0].name}`)).toHaveAttribute(
      "src",
      `/api/qr/product/${products[0].slug}?format=svg`,
    );
    expect(
      screen.getByText(`https://shop.example.test/products/${products[0].slug}`),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print 2 labels" })).toBeInTheDocument();
  });

  it("says plainly when a selected product is inactive / not public (no QR is made for it)", async () => {
    const id = (state.load as { catalogue: { products: { id: string }[] } }).catalogue.products[0]
      .id;
    await page(`${id},no-such-product`);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByText(/1 selected product\(s\) are not active/)).toBeInTheDocument();
  });

  it("ignores malformed ids and never throws on hostile input", async () => {
    await page("../x,<script>,%00,a b");
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(screen.getByText(/No products selected/)).toBeInTheDocument();
  });

  it("no ids → guidance, not an error", async () => {
    await page(undefined);
    expect(screen.getByText(/No products selected/)).toBeInTheDocument();
  });

  it("caps one print run at 48 labels", async () => {
    const products = (state.load as { catalogue: { products: { id: string }[] } }).catalogue
      .products;
    await page(
      [...products.map((p) => p.id), ...Array.from({ length: 80 }, (_, i) => `x${i}`)].join(","),
    );
    expect(screen.getAllByRole("img").length).toBeLessThanOrEqual(48);
  });

  it("explains a catalogue outage instead of showing blank labels", async () => {
    state.load = { ok: false };
    await page("a");
    expect(screen.getByText(/catalogue could not be read/)).toBeInTheDocument();
  });
});
