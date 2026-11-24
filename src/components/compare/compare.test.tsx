import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { COMPARE_KEY, compareStore } from "@/features/compare/store";
import { buildComparison } from "@/features/compare/compare";
import type { ViewCatalogue } from "@/features/catalogue/view";
import {
  FIXTURE_BRANDS,
  FIXTURE_CATEGORIES,
  FIXTURE_PRODUCTS,
} from "@/features/products/test-fixtures";
import { PRICE_DISCLAIMER } from "@/features/products/format";
import type { Product } from "@/features/products/types";
import { AddToCompareButton } from "./add-to-compare-button";
import { CompareView } from "./compare-view";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => "/compare" }));

const mk = (id: string, over: Partial<Product> = {}): Product => ({
  ...FIXTURE_PRODUCTS[0],
  id,
  slug: id,
  name: `Product ${id}`,
  sku: null,
  brandId: null,
  price: null,
  stockStatus: null,
  updatedAt: null,
  imageUrl: null,
  specifications: [],
  unit: { code: "BAG" },
  ...over,
});
const catalogue = (products: Product[]): ViewCatalogue => ({
  products,
  categories: FIXTURE_CATEGORIES,
  brands: FIXTURE_BRANDS,
});
const picker = (c: ViewCatalogue) =>
  c.products.map((p) => ({ id: p.id, name: p.name, brandName: null, unitLabel: "Bag" }));

function view(
  ids: string[],
  products: Product[],
  extra: Partial<React.ComponentProps<typeof CompareView>> = {},
) {
  const c = catalogue(products);
  return render(
    <CompareView
      comparison={buildComparison(c, ids)}
      requestedIds={ids}
      picker={picker(c)}
      whatsappNumber={null}
      source="LIVE"
      {...extra}
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
  nav.push.mockReset();
  nav.replace.mockReset();
  act(() => compareStore._reset());
});
afterEach(cleanup);

describe("compareStore", () => {
  it("holds at most three products; a fourth is refused, duplicates are not added twice", () => {
    expect(compareStore.add("a")).toBe("added");
    expect(compareStore.add("a")).toBe("exists");
    compareStore.add("b");
    compareStore.add("c");
    expect(compareStore.add("d")).toBe("full");
    expect(JSON.parse(localStorage.getItem(COMPARE_KEY)!)).toEqual(["a", "b", "c"]);
  });

  it("refuses malformed ids, toggles, removes, clears and survives a reload", () => {
    expect(compareStore.add("bad id")).toBe("invalid");
    expect(compareStore.toggle("a")).toBe("added");
    expect(compareStore.toggle("a")).toBe("removed");
    compareStore.add("a");
    compareStore.add("b");
    act(() => compareStore._reset()); // reload
    compareStore.remove("a");
    expect(JSON.parse(localStorage.getItem(COMPARE_KEY)!)).toEqual(["b"]);
    compareStore.clear();
    expect(JSON.parse(localStorage.getItem(COMPARE_KEY)!)).toEqual([]);
  });

  it("recovers from corrupt or oversized stored data", () => {
    localStorage.setItem(COMPARE_KEY, "{broken");
    act(() => compareStore._reset());
    expect(compareStore.add("a")).toBe("added");
    localStorage.setItem(COMPARE_KEY, JSON.stringify(["a", "b", "c", "d", "e", 5, "bad id", "a"]));
    act(() => compareStore._reset());
    expect(compareStore.add("z")).toBe("full");
    compareStore.set(["a", "b", "c", "d"]);
    compareStore.remove("a"); // forces a write: only the clean, capped list is ever saved
    expect(JSON.parse(localStorage.getItem(COMPARE_KEY)!)).toEqual(["b", "c"]);
  });
});

describe("AddToCompareButton", () => {
  it("toggles the product in the list and reports state to assistive technology", () => {
    render(<AddToCompareButton productId="a" productName="Cement" />);
    const btn = screen.getByRole("button", { name: /Compare/ });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Cement added to comparison.");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent("removed from comparison");
  });

  it("explains when the list is full and does not add a fourth product", () => {
    ["a", "b", "c"].forEach((i) => compareStore.add(i));
    render(<AddToCompareButton productId="d" productName="Sand" />);
    fireEvent.click(screen.getByRole("button", { name: /Compare/ }));
    expect(screen.getByRole("status")).toHaveTextContent(/up to 3 products/);
    expect(JSON.parse(localStorage.getItem(COMPARE_KEY)!)).toEqual(["a", "b", "c"]);
  });

  it("links to the comparison once two or more products are chosen", () => {
    compareStore.add("a");
    compareStore.add("b");
    render(<AddToCompareButton productId="a" productName="X" />);
    expect(screen.getByRole("link", { name: /View comparison \(2\)/ })).toHaveAttribute(
      "href",
      "/compare?ids=a,b",
    );
  });
});

describe("CompareView", () => {
  const two = [
    mk("a", {
      name: "Cement A",
      price: 385,
      stockStatus: "IN_STOCK",
      specifications: [{ label: "Grade", value: "53" }],
    }),
    mk("b", { name: "Cement B", unit: { code: "KG" }, specifications: [] }),
  ];

  it("shows each product, 'Not specified' for anything missing, and the indicative-rate disclaimer", () => {
    view(["a", "b"], two);
    const table = screen.getByRole("table");
    expect(within(table).getByRole("link", { name: "Cement A" })).toHaveAttribute(
      "href",
      "/products/a",
    );
    expect(within(table).getAllByText("Not specified").length).toBeGreaterThan(3);
    const grade = within(table).getByText("Grade").closest("tr")!;
    expect(grade.textContent).toContain("53");
    expect(grade.textContent).toContain("Not specified");
    expect(screen.getByText(PRICE_DISCLAIMER, { exact: false })).toBeInTheDocument();
  });

  it("scrolls sideways inside its own focusable region (no page-level overflow) and labels it", () => {
    view(["a", "b"], two);
    const region = screen.getByRole("region", { name: /Product comparison/ });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region.className).toMatch(/overflow-x-auto/);
  });

  it("explains different units and never ranks products", () => {
    view(["a", "b"], two);
    expect(screen.getByText(/different units/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /\b(best|cheapest|strongest|recommended|winner|most suitable)\b/i,
    );
  });

  it("removing a product navigates to the comparison without it", () => {
    view(["a", "b"], two);
    fireEvent.click(screen.getByRole("button", { name: "Remove Cement A from comparison" }));
    expect(nav.push).toHaveBeenCalledWith("/compare?ids=b");
  });

  it("clearing goes to an empty comparison", () => {
    view(["a", "b"], two);
    fireEvent.click(screen.getByRole("button", { name: "Clear comparison" }));
    expect(nav.push).toHaveBeenCalledWith("/compare");
  });

  it("adds a product from the picker while there is room, excluding ones already shown", () => {
    view(["a"], [...two, mk("c", { name: "Cement C" })]);
    const select = screen.getByLabelText("Product") as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).not.toContain("Cement A (per Bag)");
    fireEvent.change(select, { target: { value: "c" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(nav.push).toHaveBeenCalledWith("/compare?ids=a,c");
  });

  it("at three products the picker is replaced by an explanation (remove one to replace it)", () => {
    const three = [mk("a"), mk("b"), mk("c"), mk("d")];
    view(["a", "b", "c"], three);
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.getByText(/maximum of 3 products/)).toBeInTheDocument();
  });

  it("tells the customer when a product is no longer available, and shows the rest", () => {
    view(["a", "gone"], two);
    expect(
      screen.getByText(/1 product\(s\) are no longer available and were removed/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cement A" })).toBeInTheDocument();
  });

  it("an empty comparison offers a way to start, not an error", () => {
    view([], two);
    expect(screen.getByText("Nothing to compare yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" })).toBeInTheDocument();
  });

  it("warns that static fallback rates are not live", () => {
    view(["a", "b"], two, { source: "STATIC" });
    expect(screen.getByText(/Live prices are not available at the moment/)).toBeInTheDocument();
  });

  it("syncs: URL products are saved to the list, with removed/unavailable ids dropped", () => {
    view(["a", "gone", "b"], two);
    expect(JSON.parse(localStorage.getItem(COMPARE_KEY)!)).toEqual(["a", "b"]);
  });

  it("a list saved earlier opens in the comparison when the URL has no products", () => {
    compareStore.add("a");
    compareStore.add("b");
    view([], two);
    expect(nav.replace).toHaveBeenCalledWith("/compare?ids=a,b");
  });

  it("copies a shareable link containing only the product ids", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: write },
      configurable: true,
    });
    view(["a", "b"], two);
    fireEvent.click(screen.getByRole("button", { name: /Copy comparison link/ }));
    expect(write.mock.calls[0][0]).toMatch(/\/compare\?ids=a,b$/);
    await screen.findByText("Link copied");
  });

  it("offers WhatsApp only when a number is configured", () => {
    const { unmount } = view(["a", "b"], two);
    expect(screen.queryByRole("link", { name: /WhatsApp enquiry/ })).toBeNull();
    unmount();
    view(["a", "b"], two, { whatsappNumber: "919999900000" });
    expect(screen.getAllByRole("link", { name: /WhatsApp enquiry/ })).toHaveLength(2);
  });
});
