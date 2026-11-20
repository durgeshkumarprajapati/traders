// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HomeCarousel, DEFAULT_CAROUSEL_SLIDES } from "./home-carousel";

describe("HomeCarousel Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the carousel with accessible role and label", () => {
    render(<HomeCarousel />);
    const region = screen.getByRole("region", {
      name: /Homepage Building Materials Highlights/i,
    });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute("aria-roledescription", "carousel");
  });

  it("renders the first slide content by default", () => {
    render(<HomeCarousel />);
    const firstSlide = DEFAULT_CAROUSEL_SLIDES[0];
    expect(screen.getByText(firstSlide.title)).toBeInTheDocument();
    expect(screen.getByText(firstSlide.badge)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: new RegExp(firstSlide.primaryCta.label, "i") }),
    ).toBeInTheDocument();
  });

  it("navigates to next and previous slides using button controls", () => {
    render(<HomeCarousel />);
    const nextBtn = screen.getByRole("button", { name: /Next slide/i });
    const prevBtn = screen.getByRole("button", { name: /Previous slide/i });

    // Click next -> Slide 2
    fireEvent.click(nextBtn);
    const secondSlide = DEFAULT_CAROUSEL_SLIDES[1];
    expect(screen.getByText(secondSlide.title)).toBeInTheDocument();

    // Click prev -> Back to Slide 1
    fireEvent.click(prevBtn);
    const firstSlide = DEFAULT_CAROUSEL_SLIDES[0];
    expect(screen.getByText(firstSlide.title)).toBeInTheDocument();
  });

  it("navigates directly via pagination indicator dots", () => {
    render(<HomeCarousel />);
    const thirdSlide = DEFAULT_CAROUSEL_SLIDES[2];
    const dot3 = screen.getByRole("tab", {
      name: new RegExp(`Go to slide 3 of ${DEFAULT_CAROUSEL_SLIDES.length}`, "i"),
    });

    fireEvent.click(dot3);
    expect(screen.getByText(thirdSlide.title)).toBeInTheDocument();
    expect(dot3).toHaveAttribute("aria-selected", "true");
  });

  it("handles keyboard navigation with arrow keys", () => {
    render(<HomeCarousel />);
    const carousel = screen.getByRole("region", {
      name: /Homepage Building Materials Highlights/i,
    });

    // ArrowRight
    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(screen.getByText(DEFAULT_CAROUSEL_SLIDES[1].title)).toBeInTheDocument();

    // ArrowLeft
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(screen.getByText(DEFAULT_CAROUSEL_SLIDES[0].title)).toBeInTheDocument();
  });

  it("handles mobile touch swipe navigation", () => {
    render(<HomeCarousel />);
    const carousel = screen.getByRole("region", {
      name: /Homepage Building Materials Highlights/i,
    });

    // Swipe left (diff > 40) -> next slide
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 120 }] });
    expect(screen.getByText(DEFAULT_CAROUSEL_SLIDES[1].title)).toBeInTheDocument();

    // Swipe right (diff < -40) -> prev slide
    fireEvent.touchStart(carousel, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 180 }] });
    expect(screen.getByText(DEFAULT_CAROUSEL_SLIDES[0].title)).toBeInTheDocument();
  });

  it("ignores mostly-vertical touch gestures so page scrolling never changes the slide", () => {
    render(<HomeCarousel />);
    const carousel = screen.getByRole("region", {
      name: /Homepage Building Materials Highlights/i,
    });
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 150, clientY: 400 }] });
    expect(screen.getByText(DEFAULT_CAROUSEL_SLIDES[0].title)).toBeInTheDocument();
  });

  it("renders graceful fallback when images are not available on disk", () => {
    const slidesWithoutImages = [
      {
        id: "slide-no-img",
        badge: "Test Badge",
        title: "Test Heading Without Photo",
        description: "Test description for fallback testing",
        primaryCta: { label: "Learn More", href: "/products" },
        altText: "Test alt text",
      },
    ];

    render(<HomeCarousel slides={slidesWithoutImages} />);
    expect(screen.getByText("Test Heading Without Photo")).toBeInTheDocument();
    expect(screen.getByText("Test Badge")).toBeInTheDocument();
    // Verify no broken <img> is rendered
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("pauses autoplay on mouse enter and resumes on mouse leave", () => {
    vi.useFakeTimers();
    render(<HomeCarousel autoPlayIntervalMs={2000} />);

    const carousel = screen.getByRole("region", {
      name: /Homepage Building Materials Highlights/i,
    });

    // Hover
    fireEvent.mouseEnter(carousel);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // Should still be on Slide 1 because it paused
    expect(screen.getByText(DEFAULT_CAROUSEL_SLIDES[0].title)).toBeInTheDocument();

    // Leave
    fireEvent.mouseLeave(carousel);
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    // Should advance to Slide 2
    expect(screen.getByText(DEFAULT_CAROUSEL_SLIDES[1].title)).toBeInTheDocument();

    vi.useRealTimers();
  });
});

describe("HomeCarousel truthfulness", () => {
  it("shows no availability badge and no price unless the slide carries verified data", () => {
    render(<HomeCarousel />);
    expect(screen.queryByText(/in stock/i)).toBeNull();
    expect(screen.queryByText(/indicative rate/i)).toBeNull();
    expect(screen.queryByText(/₹/)).toBeNull();
    for (const s of DEFAULT_CAROUSEL_SLIDES) {
      expect(s.price).toBeUndefined();
      expect(s.availability).toBeUndefined();
    }
  });

  it("renders availability and rate only when supplied (e.g. from catalogue data)", () => {
    const slide = {
      ...DEFAULT_CAROUSEL_SLIDES[0],
      price: "₹1.00",
      unit: "/ Bag",
      availability: "LIMITED_STOCK" as const,
    };
    render(<HomeCarousel slides={[slide]} />);
    expect(screen.getByText("Limited Stock")).toBeInTheDocument();
    expect(screen.getByText(/₹1\.00/)).toBeInTheDocument();
  });
});
