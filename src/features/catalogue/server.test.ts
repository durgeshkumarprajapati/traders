// @vitest-environment node
import { SheetsApiError } from "@/lib/google-sheets/errors";
import { fetchSheetsSnapshot } from "./snapshot";
import { FakeSheets } from "@/lib/google-sheets/test-utils";
import { EMPTY_SHEETS, realisticSheets } from "./test-catalogue";
import { emptyBusinessSettings } from "@/features/settings/business-settings";

const snapshotMock = vi.hoisted(() => ({ getSheetsSnapshot: vi.fn() }));
vi.mock("./cache", () => snapshotMock);
const nextServer = vi.hoisted(() => ({ connection: vi.fn(async () => {}) }));
vi.mock("next/server", () => nextServer);

import { loadCatalogue, loadSettings } from "./server";

const snapshotOf = (sheets: Record<string, unknown[][]>) =>
  fetchSheetsSnapshot(new FakeSheets(sheets), () => new Date("2026-11-18T12:00:00Z"));
beforeEach(() => {
  snapshotMock.getSheetsSnapshot.mockReset();
  nextServer.connection.mockClear();
});

describe("loadCatalogue", () => {
  it("returns the public view and mapped settings from the cached snapshot", async () => {
    snapshotMock.getSheetsSnapshot.mockResolvedValue(await snapshotOf(realisticSheets()));
    const r = await loadCatalogue();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.catalogue.products).toHaveLength(17);
    expect(r.settings.name).toBe("Test Traders");
    expect(r.fetchedAt).toBe("2026-11-18T12:00:00.000Z");
    expect(snapshotMock.getSheetsSnapshot).toHaveBeenCalledTimes(1);
  });

  it("an empty worksheet is a successful empty catalogue — distinct from a failure", async () => {
    snapshotMock.getSheetsSnapshot.mockResolvedValue(await snapshotOf(EMPTY_SHEETS()));
    const r = await loadCatalogue();
    expect(r).toMatchObject({ ok: true, catalogue: { products: [], categories: [], brands: [] } });
  });

  it("any failure becomes { ok: false } — never sample data, never a thrown error, never leaked detail", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    snapshotMock.getSheetsSnapshot.mockRejectedValue(
      new SheetsApiError("Google denied access: super-secret-detail", 403, false),
    );
    const r = await loadCatalogue();
    expect(r).toEqual({ ok: false });
    expect(JSON.stringify(r)).not.toContain("secret");
    expect(String(spy.mock.calls.at(-1)?.[0])).toContain("catalogue_unavailable"); // logged server-side instead
    spy.mockRestore();
  });

  it("never serves cached fake data after a failure: the next call tries the (cached) source again", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    snapshotMock.getSheetsSnapshot
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(await snapshotOf(realisticSheets()));
    expect((await loadCatalogue()).ok).toBe(false);
    expect((await loadCatalogue()).ok).toBe(true);
    spy.mockRestore();
  });
});

describe("request-time deferral", () => {
  it("defers to request time BEFORE touching the cached snapshot (so builds never read the sheet or bake a failure)", async () => {
    const order: string[] = [];
    nextServer.connection.mockImplementation(async () => void order.push("connection"));
    snapshotMock.getSheetsSnapshot.mockImplementation(async () => {
      order.push("snapshot");
      return snapshotOf(realisticSheets());
    });
    await loadCatalogue();
    expect(order).toEqual(["connection", "snapshot"]);
  });

  it("if deferral signals a prerender postponement, nothing is read and nothing is swallowed", async () => {
    const postpone = new Error("PRERENDER_POSTPONED");
    nextServer.connection.mockRejectedValueOnce(postpone);
    await expect(loadCatalogue()).rejects.toBe(postpone); // propagates to Next; not converted into an 'unavailable' result
    expect(snapshotMock.getSheetsSnapshot).not.toHaveBeenCalled();
  });
});

describe("loadSettings", () => {
  it("returns configured settings", async () => {
    snapshotMock.getSheetsSnapshot.mockResolvedValue(await snapshotOf(realisticSheets()));
    expect((await loadSettings()).tagline).toBe("Test tagline for materials");
  });
  it("returns 'nothing configured' (not invented data) when the sheet is unavailable", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    snapshotMock.getSheetsSnapshot.mockRejectedValue(new Error("down"));
    expect(await loadSettings()).toEqual(emptyBusinessSettings());
    spy.mockRestore();
  });
});
