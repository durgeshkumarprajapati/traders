// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: vi.fn().mockResolvedValue(undefined),
  };
});

import * as catalogueServer from "@/features/catalogue/server";
import * as supabaseServer from "@/lib/supabase/server";
import { loadAdminDashboardData } from "./dashboard";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("loadAdminDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates catalogue and enquiry stats correctly when sources are healthy", async () => {
    vi.spyOn(catalogueServer, "loadAdminCatalogue").mockResolvedValue({
      ok: true,
      snapshot: {
        fetchedAt: "2026-11-20T10:00:00Z",
        products: [
          {
            id: "p1",
            slug: "p1",
            name: "P1",
            categoryId: "c1",
            brandId: "b1",
            sku: null,
            description: "",
            specifications: [],
            imageUrl: null,
            price: 100,
            unit: { code: "BAG" },
            stockStatus: "IN_STOCK",
            isFeatured: false,
            isActive: true,
            createdAt: null,
            updatedAt: null,
          },
          {
            id: "p2",
            slug: "p2",
            name: "P2",
            categoryId: "c1",
            brandId: "b1",
            sku: null,
            description: "",
            specifications: [],
            imageUrl: null,
            price: 200,
            unit: { code: "BAG" },
            stockStatus: "OUT_OF_STOCK",
            isFeatured: false,
            isActive: false, // inactive
            createdAt: null,
            updatedAt: null,
          },
          {
            id: "p3",
            slug: "p3",
            name: "P3",
            categoryId: "c2",
            brandId: "b2",
            sku: null,
            description: "",
            specifications: [],
            imageUrl: null,
            price: 300,
            unit: { code: "TON" },
            stockStatus: "LIMITED_STOCK",
            isFeatured: true,
            isActive: true,
            createdAt: null,
            updatedAt: null,
          },
        ],
        categories: [
          {
            id: "c1",
            slug: "c1",
            name: "Cat 1",
            description: null,
            imageUrl: null,
            displayOrder: 1,
            isActive: true,
          },
          {
            id: "c2",
            slug: "c2",
            name: "Cat 2",
            description: null,
            imageUrl: null,
            displayOrder: 2,
            isActive: false,
          },
        ],
        brands: [
          {
            id: "b1",
            slug: "b1",
            name: "Brand 1",
            logoUrl: null,
            description: null,
            isActive: true,
          },
          {
            id: "b2",
            slug: "b2",
            name: "Brand 2",
            logoUrl: null,
            description: null,
            isActive: true,
          },
        ],
        settings: {
          businessName: "Sagar Traders",
          tagline: null,
          logoUrl: null,
          phone: null,
          whatsappNumber: null,
          email: null,
          address: null,
          businessHours: null,
          gstNumber: null,
          googleMapsUrl: null,
          deliveryCoverage: null,
          social: {},
          announcement: { enabled: false, text: null },
          whyChooseUs: [],
        },
        issues: [],
        stats: {
          products: { rows: 3, valid: 3 },
          categories: { rows: 2, valid: 2 },
          brands: { rows: 2, valid: 2 },
          settings: { rows: 1, valid: 1 },
        },
      },
    });

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "enquiries") {
          return {
            select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === "exact") {
                return {
                  eq: vi.fn((field: string, val: string) => {
                    if (field === "status" && val === "NEW") {
                      return Promise.resolve({ count: 2, error: null });
                    }
                    return Promise.resolve({ count: 0, error: null });
                  }),
                  in: vi.fn(() => {
                    return Promise.resolve({ count: 5, error: null });
                  }),
                  then: (resolve: (val: unknown) => void) => resolve({ count: 8, error: null }),
                };
              }
              return {
                order: vi.fn(() => ({
                  limit: vi.fn(() =>
                    Promise.resolve({
                      data: [
                        {
                          id: "e1",
                          reference: "ENQ-1001",
                          type: "BULK",
                          status: "NEW",
                          customer_name: "John Builder",
                          mobile: "9876543210",
                          delivery_location: "Varanasi Site A",
                          created_at: "2026-11-20T09:30:00Z",
                        },
                      ],
                      error: null,
                    }),
                  ),
                })),
              };
            }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    vi.spyOn(supabaseServer, "createSupabaseServerClient").mockResolvedValue(mockSupabase);

    const result = await loadAdminDashboardData();

    // Verify catalogue stats
    expect(result.catalogue).not.toBeNull();
    expect(result.catalogue?.totalProducts).toBe(3);
    expect(result.catalogue?.activeProducts).toBe(2);
    expect(result.catalogue?.totalCategories).toBe(2);
    expect(result.catalogue?.activeCategories).toBe(1);
    expect(result.catalogue?.totalBrands).toBe(2);
    expect(result.catalogue?.activeBrands).toBe(2);
    expect(result.catalogue?.availability.IN_STOCK).toBe(1);
    expect(result.catalogue?.availability.LIMITED_STOCK).toBe(1);
    expect(result.catalogue?.availability.OUT_OF_STOCK).toBe(0);

    // Verify enquiry stats
    expect(result.enquiries).not.toBeNull();
    expect(result.enquiries?.totalCount).toBe(8);
    expect(result.enquiries?.newCount).toBe(2);
    expect(result.enquiries?.pendingCount).toBe(5);
    expect(result.enquiries?.recent).toHaveLength(1);
    expect(result.enquiries?.recent[0].reference).toBe("ENQ-1001");
  });

  it("handles Google Sheets failure gracefully without crashing", async () => {
    vi.spyOn(catalogueServer, "loadAdminCatalogue").mockResolvedValue({
      ok: false,
      error: "Google Sheets connection timed out",
    });

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === "exact") {
            return {
              eq: vi.fn(() => Promise.resolve({ count: 0, error: null })),
              in: vi.fn(() => Promise.resolve({ count: 0, error: null })),
              then: (resolve: (val: unknown) => void) => resolve({ count: 0, error: null }),
            };
          }
          return {
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          };
        }),
      })),
    } as unknown as SupabaseClient;
    vi.spyOn(supabaseServer, "createSupabaseServerClient").mockResolvedValue(mockSupabase);

    const result = await loadAdminDashboardData();
    expect(result.catalogue).toBeNull();
    expect(result.enquiries).not.toBeNull();
  });

  it("handles Supabase failure gracefully without crashing", async () => {
    vi.spyOn(catalogueServer, "loadAdminCatalogue").mockResolvedValue({
      ok: true,
      snapshot: {
        fetchedAt: "2026-11-20T10:00:00Z",
        products: [],
        categories: [],
        brands: [],
        settings: {
          businessName: "Sagar Traders",
          tagline: null,
          logoUrl: null,
          phone: null,
          whatsappNumber: null,
          email: null,
          address: null,
          businessHours: null,
          gstNumber: null,
          googleMapsUrl: null,
          deliveryCoverage: null,
          social: {},
          announcement: { enabled: false, text: null },
          whyChooseUs: [],
        },
        issues: [],
        stats: {
          products: { rows: 0, valid: 0 },
          categories: { rows: 0, valid: 0 },
          brands: { rows: 0, valid: 0 },
          settings: { rows: 0, valid: 0 },
        },
      },
    });

    vi.spyOn(supabaseServer, "createSupabaseServerClient").mockRejectedValue(
      new Error("Database connection refused"),
    );

    const result = await loadAdminDashboardData();
    expect(result.catalogue).not.toBeNull();
    expect(result.enquiries).toBeNull();
  });
});
