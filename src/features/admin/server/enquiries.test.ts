// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAdminEnquiries, loadAdminEnquiryDetail } from "./enquiries";
import * as supabaseServer from "@/lib/supabase/server";

vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

describe("loadAdminEnquiries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads enquiries with counts and item aggregation", async () => {
    const mockEnquiryRows = [
      {
        id: "enq-1",
        reference: "ENQ-2026-001001",
        type: "BULK",
        status: "NEW",
        customer_name: "Ramesh Sharma",
        mobile: "9123456789",
        email: "ramesh@example.org",
        delivery_location: "Rewa Site",
        message: "Need cement urgently",
        created_at: "2026-11-20T10:00:00Z",
        updated_at: "2026-11-20T10:00:00Z",
      },
    ];

    const mockItemRows = [
      { enquiry_id: "enq-1" },
      { enquiry_id: "enq-1" },
      { enquiry_id: "enq-1" },
    ];

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "enquiries") {
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                range: vi.fn(() =>
                  Promise.resolve({ data: mockEnquiryRows, count: 1, error: null }),
                ),
              })),
            })),
          };
        }
        if (table === "enquiry_items") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve({ data: mockItemRows, error: null })),
            })),
          };
        }
        if (table === "enquiry_callbacks") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    vi.spyOn(supabaseServer, "createSupabaseServerClient").mockResolvedValue(mockSupabase);

    const result = await loadAdminEnquiries({ page: 1, pageSize: 15 });
    expect(result.totalCount).toBe(1);
    expect(result.enquiries.length).toBe(1);
    expect(result.enquiries[0].reference).toBe("ENQ-2026-001001");
    expect(result.enquiries[0].itemCount).toBe(3);
    expect(result.enquiries[0].status).toBe("NEW");
  });

  it("handles Supabase query failure gracefully without throwing", async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            range: vi.fn(() =>
              Promise.resolve({ data: null, count: null, error: { message: "Database down" } }),
            ),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    vi.spyOn(supabaseServer, "createSupabaseServerClient").mockResolvedValue(mockSupabase);

    const result = await loadAdminEnquiries();
    expect(result.enquiries).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});

describe("loadAdminEnquiryDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads full enquiry details including items, notes, and outbox", async () => {
    const mockEnquiry = {
      id: "enq-123",
      reference: "ENQ-2026-001002",
      type: "BULK",
      status: "CONTACTED",
      customer_name: "Amit Verma",
      mobile: "9876543210",
      email: "amit@example.org",
      delivery_location: "Satna Bypass",
      message: "Please provide best bulk rate",
      created_at: "2026-11-20T09:00:00Z",
      updated_at: "2026-11-20T09:30:00Z",
    };

    const mockItems = [
      {
        id: "item-1",
        position: 1,
        product_id: "prod-cem-1",
        sku: "CEM-1",
        product_name: "BuildPro PPC Cement",
        brand_name: "BuildPro",
        unit_code: "BAG",
        unit_label: "Bag",
        quantity: 200,
        listed_price: 385.0,
        stock_status: "IN_STOCK",
      },
    ];

    const mockNotes = [
      {
        id: "note-1",
        enquiry_id: "enq-123",
        author_id: "admin-uid-1",
        body: "Spoke with customer, agreed on freight quotation.",
        created_at: "2026-11-20T09:30:00Z",
        admin_profiles: { email: "admin@sagartraders.in", full_name: "Store Manager" },
      },
    ];

    const mockOutbox = {
      id: "outbox-1",
      status: "SENT",
      attempt_count: 1,
      max_attempts: 8,
      last_error: null,
      sent_at: "2026-11-20T09:01:00Z",
      next_attempt_at: "2026-11-20T09:01:00Z",
    };

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === "enquiries") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: mockEnquiry, error: null })),
              })),
            })),
          };
        }
        if (table === "enquiry_items") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: mockItems, error: null })),
              })),
            })),
          };
        }
        if (table === "enquiry_notes") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: mockNotes, error: null })),
              })),
            })),
          };
        }
        if (table === "notification_outbox") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: mockOutbox, error: null })),
              })),
            })),
          };
        }
        if (table === "enquiry_status_history") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          };
        }
        if (table === "enquiry_callbacks") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    vi.spyOn(supabaseServer, "createSupabaseServerClient").mockResolvedValue(mockSupabase);

    const detail = await loadAdminEnquiryDetail("enq-123");
    expect(detail).not.toBeNull();
    expect(detail?.reference).toBe("ENQ-2026-001002");
    expect(detail?.items.length).toBe(1);
    expect(detail?.items[0].productName).toBe("BuildPro PPC Cement");
    expect(detail?.items[0].listedPrice).toBe(385.0);
    expect(detail?.notes.length).toBe(1);
    expect(detail?.notes[0].authorName).toBe("Store Manager");
    expect(detail?.outbox?.status).toBe("SENT");
  });

  it("returns null when enquiry is not found", async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    vi.spyOn(supabaseServer, "createSupabaseServerClient").mockResolvedValue(mockSupabase);

    const detail = await loadAdminEnquiryDetail("missing-id");
    expect(detail).toBeNull();
  });
});
