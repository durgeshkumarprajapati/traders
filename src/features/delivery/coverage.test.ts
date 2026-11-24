import type { DeliveryConfig } from "@/features/catalogue/types";
import { COVERAGE_MESSAGES, checkCoverage, isConfigured, normalisePin } from "./coverage";

const cfg = (over: Partial<DeliveryConfig> = {}): DeliveryConfig => ({
  enabled: true,
  pincodes: ["110001", "110002"],
  localities: null,
  notes: null,
  terms: null,
  ...over,
});

describe("checkCoverage", () => {
  it("accepts only six-digit PIN codes not starting with 0", () => {
    for (const bad of ["", "12345", "1234567", "012345", "abcdef", "11 00 01x"])
      expect(checkCoverage(bad, cfg())).toBe("INVALID");
  });
  it("tolerates spaces and hyphens typed by customers", () => {
    expect(normalisePin("110 001")).toBe("110001");
    expect(checkCoverage("110-001", cfg())).toBe("LISTED");
  });
  it("reports LISTED / NOT_LISTED against the owner's list only", () => {
    expect(checkCoverage("110002", cfg())).toBe("LISTED");
    expect(checkCoverage("560001", cfg())).toBe("NOT_LISTED");
  });
  it("is NOT_CONFIGURED when disabled, absent, or only localities are listed", () => {
    expect(checkCoverage("110001", undefined)).toBe("NOT_CONFIGURED");
    expect(checkCoverage("110001", cfg({ enabled: false }))).toBe("NOT_CONFIGURED");
    expect(checkCoverage("110001", cfg({ pincodes: [], localities: "Old city" }))).toBe(
      "NOT_CONFIGURED",
    );
    expect(isConfigured(cfg({ enabled: true, pincodes: [], localities: null }))).toBe(false);
  });
  it("never promises delivery, a time or a price in any message", () => {
    for (const m of Object.values(COVERAGE_MESSAGES)) {
      expect(m).not.toMatch(
        /₹|\bRs\.?\b|free delivery|guaranteed to|within \d|same[- ]day|will be delivered/i,
      );
    }
    expect(COVERAGE_MESSAGES.LISTED).toMatch(/not guaranteed/i);
  });
});
