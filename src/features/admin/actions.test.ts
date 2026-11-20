// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as catalogueWrite from "@/features/catalogue/write";
import { SheetsValidationError } from "@/features/catalogue/write-errors";
import {
  createBrandAction,
  createCategoryAction,
  createProductAction,
  toggleBrandActiveAction,
  toggleCategoryActiveAction,
  toggleProductActiveAction,
  updateBusinessSettingsAction,
  updateCategoryAction,
  updateProductAction,
} from "./actions";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

function createMockSupabase(
  adminUser: { id: string; email: string } | null = {
    id: "admin-1",
    email: "admin@sagartraders.in",
  },
) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: adminUser },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: adminUser
              ? {
                  id: adminUser.id,
                  email: adminUser.email,
                  full_name: "Sagar Admin",
                  is_active: true,
                }
              : null,
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const authorizedClient = createMockSupabase();
const unauthorizedClient = createMockSupabase(null);

describe("Admin Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication Gate (Defense in Depth)", () => {
    it("rejects createProductAction when unauthenticated", async () => {
      const res = await createProductAction(
        {
          name: "Test",
          slug: "test",
          categoryId: "cat-1",
          brandId: "brand-1",
          unit: { code: "BAG" },
          stockStatus: "IN_STOCK",
          isFeatured: false,
          isActive: true,
        },
        unauthorizedClient,
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("UNAUTHORIZED");
      }
    });

    it("rejects toggleCategoryActiveAction when unauthenticated", async () => {
      const res = await toggleCategoryActiveAction("cat-1", false, unauthorizedClient);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("Product Actions", () => {
    it("creates a product successfully and returns its id and name", async () => {
      vi.spyOn(catalogueWrite, "createProduct").mockResolvedValue({
        id: "prod_123",
        slug: "ultratech-cement",
        name: "UltraTech Cement",
        categoryId: "cat-1",
        brandId: "brand-1",
        sku: "UT-1",
        description: "Test description",
        specifications: [],
        imageUrl: null,
        price: 380,
        unit: { code: "BAG" },
        stockStatus: "IN_STOCK",
        isFeatured: true,
        isActive: true,
        createdAt: "2026-11-20T10:00:00Z",
        updatedAt: "2026-11-20T10:00:00Z",
      });

      const res = await createProductAction(
        {
          name: "UltraTech Cement",
          slug: "ultratech-cement",
          sku: "UT-1",
          categoryId: "cat-1",
          brandId: "brand-1",
          description: "Test description",
          price: 380,
          unit: { code: "BAG" },
          stockStatus: "IN_STOCK",
          isFeatured: true,
          isActive: true,
        },
        authorizedClient,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual({ id: "prod_123", name: "UltraTech Cement" });
      }
    });

    it("updates a product with expectedUpdatedAt concurrency guard", async () => {
      vi.spyOn(catalogueWrite, "updateProduct").mockResolvedValue({
        product: {
          id: "prod_123",
          slug: "ultratech-cement",
          name: "UltraTech Cement Updated",
          categoryId: "cat-1",
          brandId: "brand-1",
          sku: "UT-1",
          description: "",
          specifications: [],
          imageUrl: null,
          price: 395,
          unit: { code: "BAG" },
          stockStatus: "IN_STOCK",
          isFeatured: false,
          isActive: true,
          createdAt: "2026-11-20T10:00:00Z",
          updatedAt: "2026-11-20T11:00:00Z",
        },
        priceHistoryRecorded: true,
      });

      const res = await updateProductAction(
        "prod_123",
        { name: "UltraTech Cement Updated", price: 395 },
        "2026-11-20T10:00:00Z",
        authorizedClient,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual({ id: "prod_123", name: "UltraTech Cement Updated" });
      }
      expect(catalogueWrite.updateProduct).toHaveBeenCalledWith(
        "prod_123",
        { name: "UltraTech Cement Updated", price: 395 },
        { expectedUpdatedAt: "2026-11-20T10:00:00Z", updatedBy: "admin@sagartraders.in" },
      );
    });

    it("toggles product active status", async () => {
      vi.spyOn(catalogueWrite, "updateProduct").mockResolvedValue({
        product: {
          id: "prod_123",
          slug: "ultratech-cement",
          name: "UltraTech Cement",
          categoryId: "cat-1",
          brandId: "brand-1",
          sku: null,
          description: "",
          specifications: [],
          imageUrl: null,
          price: null,
          unit: { code: "BAG" },
          stockStatus: "IN_STOCK",
          isFeatured: false,
          isActive: false,
          createdAt: "2026-11-20T10:00:00Z",
          updatedAt: "2026-11-20T11:00:00Z",
        },
        priceHistoryRecorded: null,
      });

      const res = await toggleProductActiveAction("prod_123", false, authorizedClient);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual({ id: "prod_123", isActive: false });
      }
    });
  });

  describe("Category Actions & Dependency Checks", () => {
    it("creates a category successfully", async () => {
      vi.spyOn(catalogueWrite, "createCategory").mockResolvedValue({
        id: "cat_999",
        slug: "structural-steel",
        name: "Structural Steel",
        description: "Heavy structural steel",
        imageUrl: null,
        displayOrder: 5,
        isActive: true,
      });

      const res = await createCategoryAction(
        {
          name: "Structural Steel",
          slug: "structural-steel",
          description: "Heavy structural steel",
          displayOrder: 5,
          isActive: true,
        },
        authorizedClient,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual({ id: "cat_999", name: "Structural Steel" });
      }
    });

    it("updates a category successfully", async () => {
      vi.spyOn(catalogueWrite, "updateCategory").mockResolvedValue({
        id: "cat_999",
        slug: "structural-steel",
        name: "Structural Steel & Beams",
        description: null,
        imageUrl: null,
        displayOrder: 5,
        isActive: true,
      });

      const res = await updateCategoryAction(
        "cat_999",
        {
          name: "Structural Steel & Beams",
        },
        authorizedClient,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual({ id: "cat_999", name: "Structural Steel & Beams" });
      }
    });

    it("prevents category deactivation when active products still depend on it", async () => {
      vi.spyOn(catalogueWrite, "updateCategory").mockRejectedValue(
        new SheetsValidationError([
          {
            worksheet: "Categories",
            row: 2,
            column: "is_active",
            severity: "error",
            code: "INACTIVE_CATEGORY",
            message: 'active product references inactive category "Cement"',
          },
        ]),
      );

      const res = await toggleCategoryActiveAction("cat-1", false, authorizedClient);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("VALIDATION");
        expect(res.message).toMatch(/active products still reference this category/i);
      }
    });
  });

  describe("Brand Actions & Dependency Checks", () => {
    it("creates a brand successfully", async () => {
      vi.spyOn(catalogueWrite, "createBrand").mockResolvedValue({
        id: "brand_999",
        slug: "tata-tiscon",
        name: "Tata Tiscon",
        logoUrl: null,
        description: null,
        isActive: true,
      });

      const res = await createBrandAction(
        {
          name: "Tata Tiscon",
          slug: "tata-tiscon",
          isActive: true,
        },
        authorizedClient,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual({ id: "brand_999", name: "Tata Tiscon" });
      }
    });

    it("prevents brand deactivation when active products depend on it", async () => {
      vi.spyOn(catalogueWrite, "updateBrand").mockRejectedValue(
        new SheetsValidationError([
          {
            worksheet: "Brands",
            row: 3,
            column: "is_active",
            severity: "error",
            code: "INACTIVE_BRAND",
            message: 'active product references inactive brand "Tata Tiscon"',
          },
        ]),
      );

      const res = await toggleBrandActiveAction("brand-1", false, authorizedClient);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("VALIDATION");
        expect(res.message).toMatch(/active products still reference this brand/i);
      }
    });
  });

  describe("Business Settings Actions", () => {
    it("updates multiple business settings in Google Sheets", async () => {
      vi.spyOn(catalogueWrite, "setBusinessSetting").mockResolvedValue();

      const res = await updateBusinessSettingsAction(
        {
          business_name: "Sagar Traders Varanasi",
          phone: "+91 98765 43210",
          announcement_enabled: "TRUE",
          announcement_text: "Special cement pricing available this week.",
        },
        authorizedClient,
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.updatedCount).toBe(4);
      }
      expect(catalogueWrite.setBusinessSetting).toHaveBeenCalledTimes(4);
      expect(catalogueWrite.setBusinessSetting).toHaveBeenCalledWith(
        "business_name",
        "Sagar Traders Varanasi",
      );
    });
  });
});
