// @vitest-environment node
import { SheetsApiError } from "@/lib/google-sheets/errors";
import { FakeSheets } from "@/lib/google-sheets/test-utils";
import { SHEETS_CACHE_LIFE, SHEETS_CACHE_TAG } from "./constants";

const next = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));
vi.mock("next/cache", () => next);

const state = vi.hoisted(() => ({ fake: null as unknown }));
vi.mock("@/lib/google-sheets/config", () => ({
  loadSheetsConfig: () => ({
    clientEmail: "x@y.z",
    privateKey: "k",
    spreadsheetId: "s",
    priceHistoryEnabled: false,
  }),
}));
vi.mock("@/lib/google-sheets/client", () => ({ createSheetsReader: () => state.fake }));

import { getSheetsSnapshot } from "./cache";
import { invalidateSheetsCache, markSheetsCacheStale } from "./invalidate";

beforeEach(() => Object.values(next).forEach((f) => f.mockReset()));

describe("getSheetsSnapshot (cached read)", () => {
  it("declares the cache lifetime and tag, then returns the snapshot", async () => {
    state.fake = new FakeSheets();
    const snap = await getSheetsSnapshot();
    expect(next.cacheLife).toHaveBeenCalledWith(SHEETS_CACHE_LIFE);
    expect(next.cacheTag).toHaveBeenCalledWith(SHEETS_CACHE_TAG);
    expect(snap.products).toHaveLength(1);
  });

  it("propagates failures (so an error is never cached or replaced by fake data)", async () => {
    const fake = new FakeSheets();
    fake.failOn.read = new SheetsApiError("down", 503, true);
    state.fake = fake;
    await expect(getSheetsSnapshot()).rejects.toBeInstanceOf(SheetsApiError);
  });
});

describe("invalidation", () => {
  it("uses updateTag (immediate, read-your-own-writes) in Server Actions", () => {
    expect(invalidateSheetsCache()).toBe(true);
    expect(next.updateTag).toHaveBeenCalledWith("sheets");
    expect(next.revalidateTag).not.toHaveBeenCalled();
  });
  it("falls back to revalidateTag(expire: 0) outside Server Actions", () => {
    next.updateTag.mockImplementation(() => {
      throw new Error("updateTag can only be called from within a Server Action");
    });
    expect(invalidateSheetsCache()).toBe(true);
    expect(next.revalidateTag).toHaveBeenCalledWith("sheets", { expire: 0 });
  });
  it("never throws when no invalidation is possible (cache then expires on schedule)", () => {
    next.updateTag.mockImplementation(() => {
      throw new Error("no store");
    });
    next.revalidateTag.mockImplementation(() => {
      throw new Error("no store");
    });
    expect(invalidateSheetsCache()).toBe(false);
  });
  it("can mark the snapshot stale (stale-while-revalidate)", () => {
    markSheetsCacheStale();
    expect(next.revalidateTag).toHaveBeenCalledWith("sheets", "max");
  });
});
