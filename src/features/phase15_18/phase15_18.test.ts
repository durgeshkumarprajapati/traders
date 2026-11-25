// @vitest-environment node
import { calculateProjectEstimate } from "@/features/calculator/cost-estimator";
import { t, UI_TRANSLATIONS } from "@/features/i18n/dictionary";
import { saveKnowledgeArticleAction } from "@/features/knowledge/actions";
import { submitOrderReviewSchema } from "@/features/reviews/schemas";
import { TOUR_DEFINITIONS, pickText } from "@/features/tours/config";

describe("Phase 15 — Advanced Project Cost Estimator", () => {
  it("calculates wall, floor, room, and residential material estimates with wastage", () => {
    const wall = calculateProjectEstimate({
      projectType: "WALL",
      lengthFt: 20,
      widthFt: 10,
      heightFt: 10,
      wastagePercent: 5,
    });
    expect(wall.areaSqFt).toBe(200);
    expect(wall.lines.find((l) => l.key === "bricks")?.quantity).toBe(2100);

    const room = calculateProjectEstimate({
      projectType: "ROOM",
      lengthFt: 12,
      widthFt: 10,
      heightFt: 10,
      wastagePercent: 0,
    });
    expect(room.areaSqFt).toBe(120);
    expect(room.lines.length).toBe(3);
  });
});

describe("Phase 16 — Verified Reviews Validation", () => {
  it("validates 1-5 ratings and consent flag", () => {
    expect(
      submitOrderReviewSchema.safeParse({
        token: "a".repeat(40),
        overallRating: 5,
        qualityRating: 5,
        deliveryRating: 4,
        serviceRating: 5,
        consentToPublish: true,
      }).success,
    ).toBe(true);

    expect(
      submitOrderReviewSchema.safeParse({
        token: "a".repeat(40),
        overallRating: 6,
        qualityRating: 5,
        deliveryRating: 5,
        serviceRating: 5,
      }).success,
    ).toBe(false);
  });
});

describe("Phase 17 — Knowledge Centre & Guided Tours", () => {
  it("blocks publishing knowledge articles without technical review", async () => {
    const res = await saveKnowledgeArticleAction({
      title: "TMT Steel Guide",
      slug: "tmt-steel-guide",
      category: "TMT Steel",
      summary: "Plain language guide to selecting TMT bars.",
      body: "Detailed educational guidance about TMT steel grades and storage.",
      technicalReviewed: false,
      status: "PUBLISHED",
    });
    expect(res.ok).toBe(false);
  });

  it("provides multilingual guided tour steps with stable data-tour selectors", () => {
    expect(TOUR_DEFINITIONS.length).toBeGreaterThan(0);
    for (const tour of TOUR_DEFINITIONS) {
      for (const step of tour.steps) {
        expect(step.target).toMatch(/\[data-tour=/);
        expect(pickText(step.title, "en")).toBeTruthy();
        expect(pickText(step.title, "hi")).toBeTruthy();
        expect(pickText(step.title, "gu")).toBeTruthy();
      }
    }
  });
});

describe("Phase 18 — Multilingual Dictionary (en, hi, gu)", () => {
  it("has complete translations across English, Hindi, and Gujarati", () => {
    const keys = Object.keys(UI_TRANSLATIONS.en) as Array<keyof typeof UI_TRANSLATIONS.en>;
    for (const k of keys) {
      expect(t("en", k).length).toBeGreaterThan(0);
      expect(t("hi", k).length).toBeGreaterThan(0);
      expect(t("gu", k).length).toBeGreaterThan(0);
    }
  });
});
