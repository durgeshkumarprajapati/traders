// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DashboardView } from "./dashboard-view";
import { ProductListView } from "./product-list-view";
import { ProductForm } from "./product-form";
import { CategoriesBrandsView } from "./categories-brands-view";
import { SettingsForm } from "./settings-form";
import type {
  CatalogueBrand,
  CatalogueCategory,
  CatalogueProduct,
  BusinessSettingsRecord,
} from "@/features/admin/types";
import type { AdminDashboardData } from "@/features/admin/server/dashboard";

const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    refresh: mockRouterRefresh,
  }),
}));

const sampleCategories: CatalogueCategory[] = [
  {
    id: "cat-1",
    slug: "cement",
    name: "Cement",
    description: "Cement products",
    imageUrl: null,
    displayOrder: 1,
    isActive: true,
  },
  {
    id: "cat-2",
    slug: "steel",
    name: "Steel & TMT",
    description: null,
    imageUrl: null,
    displayOrder: 2,
    isActive: true,
  },
];

const sampleBrands: CatalogueBrand[] = [
  {
    id: "brand-1",
    slug: "ultratech",
    name: "UltraTech Cement",
    logoUrl: null,
    description: null,
    isActive: true,
  },
  {
    id: "brand-2",
    slug: "tata",
    name: "Tata Tiscon",
    logoUrl: null,
    description: null,
    isActive: true,
  },
];

const sampleProducts: CatalogueProduct[] = [
  {
    id: "prod-1",
    slug: "ultratech-super",
    name: "UltraTech Super Cement",
    sku: "UT-SUP-50",
    categoryId: "cat-1",
    brandId: "brand-1",
    description: "High performance PPC",
    specifications: [],
    imageUrl: null,
    price: 385,
    unit: { code: "BAG" },
    stockStatus: "IN_STOCK",
    isFeatured: true,
    isActive: true,
    createdAt: "2026-11-20T10:00:00Z",
    updatedAt: "2026-11-20T10:00:00Z",
  },
  {
    id: "prod-2",
    slug: "tata-tiscon-500d",
    name: "Tata Tiscon 500D 12mm",
    sku: "TATA-500D-12",
    categoryId: "cat-2",
    brandId: "brand-2",
    description: "12mm TMT rebar",
    specifications: [],
    imageUrl: null,
    price: 68000,
    unit: { code: "TON" },
    stockStatus: "AVAILABLE_ON_ORDER",
    isFeatured: false,
    isActive: false, // Inactive
    createdAt: "2026-11-20T10:00:00Z",
    updatedAt: "2026-11-20T10:00:00Z",
  },
];

const sampleSettings: BusinessSettingsRecord = {
  businessName: "Sagar Traders",
  tagline: "Quality Materials Direct to Site",
  logoUrl: null,
  phone: "+91 98765 43210",
  whatsappNumber: "919876543210",
  email: "contact@sagartraders.com",
  address: "Plot 12, Industrial Area, Varanasi",
  businessHours: "Mon-Sat 8AM-8PM",
  gstNumber: "09ABCDE1234F1Z5",
  googleMapsUrl: "https://maps.google.com/test",
  deliveryCoverage: "Varanasi and adjacent districts",
  social: { facebook: "https://facebook.com/sagar", instagram: "", youtube: "" },
  announcement: { enabled: true, text: "Special discounts on bulk cement." },
  whyChooseUs: [
    { title: "Direct Mill Supply", description: "Fresh factory stock without moisture damage." },
  ],
};

describe("Admin Views & UI Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DashboardView", () => {
    it("renders metrics, stock breakdown, and recent enquiries", () => {
      const mockData: AdminDashboardData = {
        catalogue: {
          totalProducts: 2,
          activeProducts: 1,
          totalCategories: 2,
          activeCategories: 2,
          totalBrands: 2,
          activeBrands: 2,
          availability: {
            IN_STOCK: 1,
            LIMITED_STOCK: 0,
            OUT_OF_STOCK: 0,
            AVAILABLE_ON_ORDER: 0,
          },
          issues: [],
        },
        enquiries: {
          totalCount: 5,
          newCount: 2,
          pendingCount: 3,
          recent: [
            {
              id: "enq-1",
              reference: "ENQ-1001",
              type: "BULK",
              status: "NEW",
              customerName: "Ramesh Sharma",
              mobile: "9876543210",
              deliveryLocation: "Site 1",
              createdAt: "2026-11-20T10:00:00Z",
            },
          ],
        },
        fetchedAt: "2026-11-20T10:00:00Z",
      };

      render(<DashboardView data={mockData} />);

      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
      expect(screen.getByText("Active Products")).toBeInTheDocument();
      expect(screen.getByText("Ramesh Sharma")).toBeInTheDocument();
      expect(screen.getByText("ENQ-1001")).toBeInTheDocument();
      expect(screen.getByText(/Google Sheets Data Synchronized/i)).toBeInTheDocument();
    });

    it("displays offline warning when Google Sheets is unreachable", () => {
      const mockData: AdminDashboardData = {
        catalogue: null,
        enquiries: {
          totalCount: 0,
          newCount: 0,
          pendingCount: 0,
          recent: [],
        },
        fetchedAt: "2026-11-20T10:00:00Z",
      };

      render(<DashboardView data={mockData} />);
      expect(screen.getByText(/Google Sheets Catalogue Unreachable/i)).toBeInTheDocument();
    });
  });

  describe("ProductListView", () => {
    it("renders products table with filters and search", () => {
      render(
        <ProductListView
          products={sampleProducts}
          categories={sampleCategories}
          brands={sampleBrands}
        />,
      );

      expect(screen.getByText("UltraTech Super Cement")).toBeInTheDocument();
      expect(screen.getByText("Tata Tiscon 500D 12mm")).toBeInTheDocument();
      expect(screen.getByText("SKU: UT-SUP-50")).toBeInTheDocument();

      // Search filter
      const searchInput = screen.getByPlaceholderText(/search by name/i);
      fireEvent.change(searchInput, { target: { value: "UltraTech" } });

      expect(screen.getByText("UltraTech Super Cement")).toBeInTheDocument();
      expect(screen.queryByText("Tata Tiscon 500D 12mm")).not.toBeInTheDocument();
    });
  });

  describe("ProductForm", () => {
    it("validates required fields before submitting", async () => {
      render(<ProductForm categories={sampleCategories} brands={sampleBrands} />);

      const submitBtn = screen.getByRole("button", { name: /create product/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("Material name is required.")).toBeInTheDocument();
      });
    });

    it("validates custom unit label requirement when CUSTOM unit is selected", async () => {
      render(<ProductForm categories={sampleCategories} brands={sampleBrands} />);

      // Fill name
      fireEvent.change(screen.getByLabelText(/Material Name/i), {
        target: { value: "Custom Paver Blocks" },
      });

      // Change unit to CUSTOM
      fireEvent.change(screen.getByLabelText(/Unit Code/i), { target: { value: "CUSTOM" } });

      // Submit without custom unit label
      const submitBtn = screen.getByRole("button", { name: /create product/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText("Display label is required when unit code is CUSTOM."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("CategoriesBrandsView", () => {
    it("renders tabs and allows switching between Categories and Brands", () => {
      render(
        <CategoriesBrandsView
          categories={sampleCategories}
          brands={sampleBrands}
          products={sampleProducts}
        />,
      );

      expect(screen.getByRole("tab", { name: /categories/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /brands/i })).toBeInTheDocument();

      // Default tab: Categories
      expect(screen.getByText("Cement")).toBeInTheDocument();

      // Switch to Brands
      fireEvent.click(screen.getByRole("tab", { name: /brands/i }));
      expect(screen.getByText("UltraTech Cement")).toBeInTheDocument();
      expect(screen.getByText("Tata Tiscon")).toBeInTheDocument();
    });
  });

  describe("SettingsForm", () => {
    it("renders prefilled settings and validates GSTIN format", async () => {
      render(<SettingsForm initialSettings={sampleSettings} />);

      expect(screen.getByDisplayValue("Sagar Traders")).toBeInTheDocument();
      expect(screen.getByDisplayValue("09ABCDE1234F1Z5")).toBeInTheDocument();

      // Enter invalid GSTIN
      const gstInput = screen.getByLabelText(/GST Identification Number/i);
      fireEvent.change(gstInput, { target: { value: "INVALID-GST" } });

      const saveBtn = screen.getAllByRole("button", { name: /save settings/i })[0];
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/Must be a valid 15-character GSTIN/i)).toBeInTheDocument();
      });
    });

    it("validates that Why Choose Us pairs must have both title and description", async () => {
      render(<SettingsForm initialSettings={sampleSettings} />);

      // Fill statement #2 title but leave description blank
      const titleInputs = screen.getAllByLabelText(/^Title$/i);
      fireEvent.change(titleInputs[1], { target: { value: "Only Title Filled" } });

      const saveBtn = screen.getAllByRole("button", { name: /save settings/i })[0];
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Statement #2 needs both a title and a description/i),
        ).toBeInTheDocument();
      });
    });
  });
});
