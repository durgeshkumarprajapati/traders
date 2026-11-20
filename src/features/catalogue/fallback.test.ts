// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { SheetsApiError, SheetsNotFoundError } from "@/lib/google-sheets/errors";
import {
  findStaticProductById,
  findStaticProductBySlug,
  getStaticCatalogue,
  STATIC_PRODUCTS,
} from "./data/static-catalogue";
import { loadCatalogue } from "./server";
import { FakeSheets } from "@/lib/google-sheets/test-utils";
import { fetchSheetsSnapshot } from "./snapshot";
import { EMPTY_SHEETS, realisticSheets } from "./test-catalogue";

const snapshotMock = vi.hoisted(() => ({ getSheetsSnapshot: vi.fn() }));
vi.mock("./cache", () => snapshotMock);
const nextServer = vi.hoisted(() => ({ connection: vi.fn(async () => {}) }));
vi.mock("next/server", () => nextServer);

const snapshotOf = (sheets: Record<string, unknown[][]>) =>
  fetchSheetsSnapshot(new FakeSheets(sheets), () => new Date("2026-11-20T12:00:00Z"));

describe("Phase 11 Catalogue Fallback & Resolution", () => {
  it("Priority 1: loads live catalogue data when Google Sheets returns valid products", async () => {
    snapshotMock.getSheetsSnapshot.mockResolvedValueOnce(await snapshotOf(realisticSheets()));
    const r = await loadCatalogue();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.source).toBe("LIVE");
    expect(r.catalogue.products.length).toBe(17);
    expect(r.catalogue.categories.length).toBe(3);
    expect(r.catalogue.brands.length).toBe(2);
  });

  it("Priority 2: falls back to static catalogue when Google Sheets throws an API error", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    snapshotMock.getSheetsSnapshot.mockRejectedValueOnce(
      new SheetsApiError("Google Sheets rate limit exceeded", 429, true),
    );
    const r = await loadCatalogue();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.source).toBe("STATIC");
    expect(r.catalogue.products.length).toBeGreaterThan(15);
    expect(r.catalogue.categories).toHaveLength(6);
    spy.mockRestore();
  });

  it("Priority 2: falls back to static catalogue when required worksheets are missing (e.g. only Sheet1)", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    snapshotMock.getSheetsSnapshot.mockRejectedValueOnce(
      new SheetsNotFoundError("Worksheet Products not found in spreadsheet"),
    );
    const r = await loadCatalogue();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.source).toBe("STATIC");
    expect(r.catalogue.products.length).toBe(STATIC_PRODUCTS.length);
    spy.mockRestore();
  });

  it("Priority 2: falls back to static catalogue when Google Sheets returns empty or 0 active products", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    snapshotMock.getSheetsSnapshot.mockResolvedValueOnce(await snapshotOf(EMPTY_SHEETS()));
    const r = await loadCatalogue();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.source).toBe("STATIC");
    expect(r.catalogue.products.length).toBe(STATIC_PRODUCTS.length);
    spy.mockRestore();
  });

  it("static catalogue represents all 6 approved categories with zero fabricated prices or claims", () => {
    const cat = getStaticCatalogue();
    const categoryIds = new Set(cat.categories.map((c) => c.id));
    expect(categoryIds).toEqual(
      new Set(["cat-cement", "cat-steel", "cat-bricks", "cat-sand", "cat-hardware", "cat-other"]),
    );

    // Verify all 6 categories have products
    for (const catId of categoryIds) {
      const inCat = cat.products.filter((p) => p.categoryId === catId);
      expect(inCat.length, `Expected products in category ${catId}`).toBeGreaterThan(0);
    }

    // Verify data integrity: no fabricated prices, no fabricated SKUs, stockStatus is null, brandId is null
    for (const p of cat.products) {
      expect(p.price, `Product ${p.id} must not have a fabricated price`).toBeNull();
      expect(p.sku, `Product ${p.id} must not have a fabricated SKU`).toBeNull();
      expect(p.stockStatus, `Product ${p.id} must have null stockStatus`).toBeNull();
      expect(p.brandId, `Product ${p.id} must have null brandId`).toBeNull();
      expect(p.updatedAt, `Product ${p.id} must not have a fabricated updatedAt`).toBeNull();
      expect(p.unit.code).toBeTruthy();
    }

    // Verify STATIC_BRANDS is strictly empty (zero invented distributor brands)
    expect(cat.brands).toHaveLength(0);
  });

  it("finds static product by slug and ID, and returns undefined for unknown products", () => {
    const cement = findStaticProductBySlug("opc-53-grade-cement");
    expect(cement).toBeDefined();
    expect(cement?.name).toBe("OPC 53 Grade Cement");

    const rebar = findStaticProductById("static-steel-tmt-12mm");
    expect(rebar).toBeDefined();
    expect(rebar?.name).toContain("TMT Steel Rebar 12mm");

    expect(findStaticProductBySlug("non-existent-product-slug")).toBeUndefined();
    expect(findStaticProductById("non-existent-product-id")).toBeUndefined();
  });
});
