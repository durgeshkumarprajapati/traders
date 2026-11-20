// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    connection: vi.fn().mockResolvedValue(undefined),
  };
});

import { GET } from "./route";
import * as adminAuth from "@/lib/auth/admin";
import { AppError } from "@/lib/errors";

describe("GET /api/admin/session (Protected Route Handler)", () => {
  it("returns 401 Unauthorized when unauthenticated direct HTTP request is made", async () => {
    vi.spyOn(adminAuth, "requireAdmin").mockRejectedValue(
      new AppError("UNAUTHORIZED", "Administrator authentication required."),
    );

    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Administrator authentication required.",
      },
    });
  });

  it("returns admin details when authorized active admin calls endpoint", async () => {
    vi.spyOn(adminAuth, "requireAdmin").mockResolvedValue({
      id: "admin-123",
      email: "admin@sagartraders.in",
      fullName: "Sagar Admin",
      isActive: true,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      admin: {
        id: "admin-123",
        email: "admin@sagartraders.in",
        fullName: "Sagar Admin",
      },
    });
  });
});
