// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addEnquiryNoteAction,
  retryNotificationAction,
  updateEnquiryStatusAction,
} from "./actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

interface MockSupabaseOptions {
  adminUser?: { id: string; email: string } | null;
  enquiryStatus?: string;
  updateError?: { message: string } | null;
  noteInsertData?: { id: string; body: string } | null;
  noteInsertError?: { message: string } | null;
  rpcData?: { retried: boolean; reason?: string } | null;
  rpcError?: { message: string } | null;
}

function createMockSupabase(options?: MockSupabaseOptions) {
  const adminUser =
    options?.adminUser !== undefined
      ? options.adminUser
      : { id: "admin-1", email: "admin@sagartraders.in" };

  const currentStatus = options?.enquiryStatus ?? "NEW";

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: adminUser },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "admin_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
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
            })),
          })),
        };
      }

      if (table === "enquiries") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { status: currentStatus },
                error: null,
              }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              error: options?.updateError ?? null,
            }),
          })),
        };
      }

      if (table === "enquiry_notes") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: options?.noteInsertData ?? { id: "note-new-1", body: "Test note" },
                error: options?.noteInsertError ?? null,
              }),
            })),
          })),
        };
      }

      if (table === "enquiry_status_history") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      return {};
    }),
    rpc: vi.fn(() =>
      Promise.resolve({
        data: options?.rpcData ?? { retried: true },
        error: options?.rpcError ?? null,
      }),
    ),
  } as unknown as SupabaseClient;
}

describe("updateEnquiryStatusAction", () => {
  it("rejects unauthenticated requests", async () => {
    const unauthClient = createMockSupabase({ adminUser: null });
    const res = await updateEnquiryStatusAction("enq-1", "CONTACTED", unauthClient);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("UNAUTHORIZED");
    }
  });

  it("updates status when transition is allowed (NEW -> CONTACTED)", async () => {
    const client = createMockSupabase({ enquiryStatus: "NEW" });
    const res = await updateEnquiryStatusAction("enq-1", "CONTACTED", client);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ id: "enq-1", status: "CONTACTED" });
    }
  });

  it("rejects invalid status transitions (COMPLETED -> NEW)", async () => {
    const client = createMockSupabase({ enquiryStatus: "COMPLETED" });
    const res = await updateEnquiryStatusAction("enq-1", "NEW", client);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("VALIDATION");
      expect(res.message).toContain("Cannot transition enquiry status");
    }
  });

  it("allows transition to CANCELLED from NEW or CONTACTED", async () => {
    const client = createMockSupabase({ enquiryStatus: "CONTACTED" });
    const res = await updateEnquiryStatusAction("enq-1", "CANCELLED", client);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.status).toBe("CANCELLED");
    }
  });
});

describe("addEnquiryNoteAction", () => {
  it("rejects unauthenticated caller", async () => {
    const unauthClient = createMockSupabase({ adminUser: null });
    const res = await addEnquiryNoteAction("enq-1", "Some note", unauthClient);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("UNAUTHORIZED");
    }
  });

  it("rejects empty note body", async () => {
    const client = createMockSupabase();
    const res = await addEnquiryNoteAction("enq-1", "   ", client);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("VALIDATION");
    }
  });

  it("successfully inserts staff note", async () => {
    const client = createMockSupabase({
      noteInsertData: { id: "note-101", body: "Customer agreed on price" },
    });
    const res = await addEnquiryNoteAction("enq-1", "Customer agreed on price", client);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ id: "note-101", body: "Customer agreed on price" });
    }
  });
});

describe("retryNotificationAction", () => {
  it("triggers RPC retry_notification", async () => {
    const client = createMockSupabase({ rpcData: { retried: true } });
    const res = await retryNotificationAction("outbox-1", client);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.retried).toBe(true);
    }
  });
});
