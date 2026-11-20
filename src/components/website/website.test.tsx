import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { NavLink } from "@/components/common/nav-link";
import { QuantityInput } from "@/components/common/quantity-input";
import { StockBadge } from "@/components/ui/status-badge";
import {
  FIXTURE_BRANDS,
  FIXTURE_CATEGORIES,
  FIXTURE_PRODUCTS,
} from "@/features/products/test-fixtures";
import { parseListingParams } from "@/features/products/query";
import { ENQUIRY_LIST_KEY, enquiryList } from "@/features/enquiries/enquiry-list-store";
import type { BusinessSettings } from "@/features/settings/business-settings";
import { emptyBusinessSettings } from "@/features/settings/business-settings";
import { BulkEnquiryForm, type EnquiryCatalogueItem } from "./bulk-enquiry-form";
import { CallButton, WhatsAppButton } from "./contact-actions";
import { ContactDetails } from "./contact-details";
import { ContactForm } from "./contact-form";
import { ProductCard } from "./product-card";
import { ProductFilters } from "./product-filters";
import { RateDisplay } from "./rate-display";
import { EnquiryListLink } from "./enquiry-list-link";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
// next/form needs the app-router context; a plain form is equivalent for these tests.
vi.mock("next/form", () => ({
  default: ({
    action,
    ...rest
  }: { action: string; children: ReactNode } & Record<string, unknown>) => (
    <form action={action} {...rest} />
  ),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  enquiryList._reset();
});

const product = FIXTURE_PRODUCTS[0];
const brand = FIXTURE_BRANDS[0];

describe("contact actions", () => {
  it("renders a visibly disabled WhatsApp button when no number is configured", () => {
    render(<WhatsAppButton number={null} message="hi" />);
    const btn = screen.getByRole("button", { name: /WhatsApp/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("not configured");
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("renders a safe external link when configured, and never claims a message was sent", () => {
    render(<WhatsAppButton number="+91 98765 43210" message="Rate for A&B" />);
    const link = screen.getByRole("link", { name: /WhatsApp/ });
    expect(link).toHaveAttribute(
      "href",
      `https://wa.me/919876543210?text=${encodeURIComponent("Rate for A&B")}`,
    );
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveTextContent("opens WhatsApp");
    expect(link.textContent).not.toMatch(/sent/i);
  });
  it("renders nothing for the call button without a phone number", () => {
    const { container } = render(<CallButton phone={null} />);
    expect(container).toBeEmptyDOMElement();
    render(<CallButton phone="+91 98765 43210" />);
    expect(screen.getByRole("link", { name: /Call/ })).toHaveAttribute("href", "tel:+919876543210");
  });
});

describe("badges and rates", () => {
  it("shows AVAILABLE_ON_ORDER as an info badge", () => {
    render(<StockBadge status="AVAILABLE_ON_ORDER" />);
    expect(screen.getByText("Available on Order")).toHaveClass("bg-info", "text-on-info");
  });
  it("shows 'Rate on request' for missing prices and never 0", () => {
    render(<RateDisplay product={{ price: null, unit: { code: "BAG" }, updatedAt: null }} />);
    expect(screen.getByText("Rate on request")).toBeInTheDocument();
    expect(screen.queryByText(/₹/)).toBeNull();
    expect(screen.queryByText(/Updated/)).toBeNull();
  });
  it("shows a formatted rate, unit and last-updated date when available", () => {
    render(
      <RateDisplay
        product={{
          price: 500,
          unit: { code: "CUSTOM", customLabel: "Set" },
          updatedAt: "2026-11-18T10:00:00Z",
        }}
      />,
    );
    expect(screen.getByText(/₹500\.00 \/ Set/)).toBeInTheDocument();
    expect(screen.getByText("Updated: 18 Nov 2026")).toBeInTheDocument();
  });
});

describe("ProductCard", () => {
  it("links to the product, shows availability and omits WhatsApp when not configured", () => {
    render(
      <ProductCard
        product={product}
        brand={brand}
        category={FIXTURE_CATEGORIES[0]}
        whatsappNumber={null}
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: product.name })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: product.name })).toHaveAttribute(
      "href",
      `/products/${product.slug}`,
    );
    expect(screen.getByText("In Stock")).toBeInTheDocument();
    expect(screen.getByText("SKU: SAMPLE-001")).toBeInTheDocument();
    expect(screen.queryByText(/WhatsApp/)).toBeNull();
  });
  it("shows a WhatsApp action when a number is configured", () => {
    render(<ProductCard product={product} brand={brand} whatsappNumber="919876543210" />);
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/919876543210?text="),
    );
  });
  it("adds to the enquiry list and announces it", () => {
    render(<ProductCard product={product} brand={brand} whatsappNumber={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Add to enquiry list/ }));
    expect(JSON.parse(localStorage.getItem(ENQUIRY_LIST_KEY)!)).toEqual([
      { productId: product.id, quantity: 1 },
    ]);
    expect(
      screen
        .getAllByRole("status")
        .some((s) => /added to your enquiry list/i.test(s.textContent ?? "")),
    ).toBe(true);
  });
});

describe("enquiry list link", () => {
  it("shows a live count with an accessible name", () => {
    render(<EnquiryListLink />);
    expect(screen.getByRole("link", { name: "Enquiry list, 0 items" })).toHaveAttribute(
      "href",
      "/bulk-enquiry",
    );
    act(() => {
      enquiryList.add("a");
      enquiryList.add("b");
    });
    expect(screen.getByRole("link", { name: "Enquiry list, 2 items" })).toBeInTheDocument();
  });
});

describe("QuantityInput", () => {
  it("steps, accepts decimals, ignores invalid input and restores on blur", () => {
    const onChange = vi.fn();
    render(<QuantityInput value={2} onChange={onChange} label="Quantity in Bag" />);
    fireEvent.click(screen.getByRole("button", { name: "Increase Quantity in Bag" }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    const input = screen.getByRole("spinbutton", { name: "Quantity in Bag" });
    fireEvent.change(input, { target: { value: "2.5" } });
    expect(onChange).toHaveBeenLastCalledWith(2.5);
    onChange.mockClear();
    fireEvent.change(input, { target: { value: "-4" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(input).toHaveValue(2);
  });
  it("disables decrease at 1", () => {
    render(<QuantityInput value={1} onChange={() => {}} label="Quantity" />);
    expect(screen.getByRole("button", { name: "Decrease Quantity" })).toBeDisabled();
  });
});

describe("NavLink", () => {
  it("sets aria-current only on the active route", () => {
    pathname = "/products/sample-product-1";
    render(
      <>
        <NavLink href="/" exact>
          Home
        </NavLink>
        <NavLink href="/products">Products</NavLink>
        <NavLink href="/contact">Contact</NavLink>
      </>,
    );
    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Contact" })).not.toHaveAttribute("aria-current");
    pathname = "/";
  });
});

describe("ContactDetails", () => {
  it("shows a neutral customer message (and no invented details) when settings are empty", () => {
    render(<ContactDetails settings={emptyBusinessSettings()} />);
    expect(screen.getByText(/Contact details are not available right now/)).toBeInTheDocument();
    expect(screen.queryByText(/Placeholder|Business Settings/)).toBeNull(); // no admin wording for customers
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("renders only the configured items", () => {
    const s: BusinessSettings = {
      ...emptyBusinessSettings(),
      phone: "+91 11111 22222",
      email: "a@example.test",
      businessHours: "Mon-Sat",
    };
    render(<ContactDetails settings={s} />);
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "a@example.test" })).toHaveAttribute(
      "href",
      "mailto:a@example.test",
    );
    expect(screen.getByText("Business hours")).toBeInTheDocument();
    expect(screen.queryByText("Address")).toBeNull();
    expect(screen.queryByText("WhatsApp")).toBeNull();
  });
});

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("ContactForm", () => {
  it("shows field errors in an alert summary that receives focus, and links errors to fields", () => {
    render(<ContactForm />);
    fireEvent.submit(screen.getByRole("form", { name: "General enquiry" }));
    const summary = screen.getByRole("alert");
    expect(summary).toHaveTextContent(/Name is required/);
    expect(summary).toHaveTextContent(/Mobile number is required/);
    expect(document.activeElement).toBe(summary);
    const name = screen.getByLabelText(/Your name/);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription(/Name is required/);
  });
});

const catalogue: EnquiryCatalogueItem[] = [
  {
    id: "p1",
    slug: "one",
    name: "Item One",
    brandName: "Brand X",
    sku: "S-1",
    unitLabel: "Bag",
    stockStatus: "AVAILABLE_ON_ORDER",
    rate: null,
  },
  {
    id: "p2",
    slug: "two",
    name: "Item Two",
    brandName: null,
    sku: null,
    unitLabel: "Ton",
    stockStatus: "IN_STOCK",
    rate: "₹10.00 / Ton",
  },
];

describe("BulkEnquiryForm", () => {
  it("starts empty, finds products, adds and removes them, and shows availability clearly", () => {
    render(<BulkEnquiryForm catalogue={catalogue} whatsappNumber={null} />);
    expect(screen.getByText("Your enquiry list is empty")).toBeInTheDocument();
    fill(/Add a product/, "item o");
    fireEvent.click(screen.getByRole("button", { name: /Add Item One/ }));
    const list = screen.getByRole("list", { name: "" });
    expect(within(list).getByText("Available on Order")).toBeInTheDocument(); // availability shown for the enquiry item
    expect(screen.getByText(/Rate on request/)).toBeInTheDocument();
    expect(screen.getByText("Enquiry list (1)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Item One" }));
    expect(screen.getByText("Your enquiry list is empty")).toBeInTheDocument();
  });
  it("rejects an empty list and invalid details with a focused alert summary", () => {
    render(<BulkEnquiryForm catalogue={catalogue} whatsappNumber={null} />);
    fireEvent.submit(screen.getByRole("form", { name: "Bulk quotation enquiry" }));
    const summary = screen.getByRole("alert");
    expect(summary).toHaveTextContent(/Add at least one product/);
    expect(summary).toHaveTextContent(/Delivery location is required/);
    expect(document.activeElement).toBe(summary);
  });
  it("flags products that are no longer available and blocks submission", () => {
    act(() => void enquiryList.add("gone", 2));
    render(<BulkEnquiryForm catalogue={catalogue} whatsappNumber={null} />);
    expect(screen.getByText(/no longer available/)).toBeInTheDocument();
    fill(/Full name/, "Asha Rao");
    fill(/Mobile number/, "9876543210");
    fill(/Delivery location/, "Pune site");
    fireEvent.submit(screen.getByRole("form", { name: "Bulk quotation enquiry" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/no longer available/);
    expect(screen.queryByText(/not connected yet/)).toBeNull();
  });
  it("hides the WhatsApp option without a number and shows a real link with one", () => {
    const { unmount } = render(<BulkEnquiryForm catalogue={catalogue} whatsappNumber={null} />);
    expect(screen.queryByText(/Send list on WhatsApp/)).toBeNull(); // no dead control for customers
    unmount();
    act(() => void enquiryList.add("p2", 3));
    render(<BulkEnquiryForm catalogue={catalogue} whatsappNumber="919876543210" />);
    const link = screen.getByRole("link", { name: /Send list on WhatsApp/ });
    expect(decodeURIComponent(link.getAttribute("href")!)).toContain("- Item Two: 3 Ton");
  });
});

describe("ProductFilters", () => {
  const params = parseListingParams({
    q: "cement",
    category: "steel-tmt",
    brand: "sample-brand-a",
    stock: "AVAILABLE_ON_ORDER",
    sort: "price-asc",
  });
  it("renders every filter group with the current selection (desktop form)", () => {
    render(
      <ProductFilters
        categories={FIXTURE_CATEGORIES}
        brands={FIXTURE_BRANDS}
        params={params}
        activeCount={4}
      />,
    );
    const form = screen.getAllByRole("form", { name: "Filter products" })[0];
    expect(form).toHaveAttribute("action", "/products");
    expect(within(form).getByLabelText("Search products")).toHaveValue("cement");
    expect(within(form).getByRole("radio", { name: "Steel & TMT" })).toBeChecked();
    expect(within(form).getByRole("radio", { name: "All categories" })).not.toBeChecked();
    expect(within(form).getByRole("checkbox", { name: "Sample Brand A" })).toBeChecked();
    expect(within(form).getByRole("checkbox", { name: "Available on Order" })).toBeChecked();
    expect(within(form).getByRole("combobox", { name: "Sort by" })).toHaveValue("price-asc");
    expect(within(form).getByRole("link", { name: "Reset" })).toHaveAttribute("href", "/products");
  });
  it("shows the active-filter count on the mobile Filters button and opens a drawer dialog", () => {
    render(
      <ProductFilters
        categories={FIXTURE_CATEGORIES}
        brands={FIXTURE_BRANDS}
        params={params}
        activeCount={4}
      />,
    );
    const btn = screen.getByRole("button", { name: /Filters \(4\)/ });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelector("dialog")).toHaveAttribute("open");
  });
});
