import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { BusinessSettings } from "@/features/settings/business-settings";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const mockSettings: BusinessSettings = {
  name: "Sagar Traders",
  tagline: "Quality Construction Materials Supplier",
  phone: "+91 98765 43210",
  whatsappNumber: "+91 98765 43210",
  email: "info@sagartraders.in",
  address: "NH-7 Rewa Road, Rewa, MP",
  businessHours: "Mon - Sat: 8:00 AM - 8:00 PM",
  gstNumber: "23AABCU9603R1ZX",
  googleMapsUrl: null,
  deliveryCoverage: "Serving Rewa, Satna & Vindhya Region",
  announcement: null,
  social: {},
  whyChooseUs: [],
};

describe("SiteHeader (Redesigned)", () => {
  it("renders brand name, building materials mark, and custom tagline", () => {
    render(<SiteHeader settings={mockSettings} />);
    expect(screen.getByText("Sagar Traders")).toBeInTheDocument();
    expect(screen.getByText("Quality Construction Materials Supplier")).toBeInTheDocument();
  });

  it("renders all four primary navigation links", () => {
    render(<SiteHeader settings={mockSettings} />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav).toHaveTextContent("Home");
    expect(nav).toHaveTextContent("Products");
    expect(nav).toHaveTextContent("Contact");
    expect(nav).toHaveTextContent("Bulk Enquiry");
  });

  it("renders top utility bar location, hours, and admin link", () => {
    render(<SiteHeader settings={mockSettings} />);
    expect(screen.getByText("Serving Rewa, Satna & Vindhya Region")).toBeInTheDocument();
    expect(screen.getByText("Mon - Sat: 8:00 AM - 8:00 PM")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Admin/i })).toHaveAttribute("href", "/admin/login");
  });

  it("renders enquiry list and quick quote action buttons", () => {
    render(<SiteHeader settings={mockSettings} />);
    expect(screen.getByRole("link", { name: /Enquiry list/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quick Quote" })).toHaveAttribute(
      "href",
      "/bulk-enquiry",
    );
  });

  it("safely handles empty/unavailable settings with default tagline and no broken contacts", () => {
    const emptySettings: BusinessSettings = {
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
    };

    render(<SiteHeader settings={emptySettings} />);
    expect(screen.getByText("Sagar Traders")).toBeInTheDocument();
    expect(screen.getByText("Building Materials & Hardware Supplier")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Call|WhatsApp/ })).toBeNull();
  });
});
