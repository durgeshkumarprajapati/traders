import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CustomerTrackedQuotation } from "@/features/quotations/types";
import { QuotationView } from "./quotation-view";
import { TrackEnquiryView } from "./track-enquiry-view";

const track = vi.hoisted(() => ({ trackEnquiryAction: vi.fn() }));
vi.mock("@/features/enquiries/tracking-actions", () => track);
vi.mock("next/navigation", () => ({ usePathname: () => "/track-enquiry" }));

const TOKEN = `qt_${"a".repeat(64)}`;
const quotation: CustomerTrackedQuotation = {
  reference: "QUO-2026-001234",
  enquiryReference: "ENQ-AB12-CD34-EF56",
  version: 2,
  status: "ISSUED",
  isLatest: true,
  isExpired: false,
  customerName: "Asha Rao",
  deliveryLocation: "Pune site",
  subtotal: 1000,
  discountAmount: 0,
  taxAmount: 0,
  totalAmount: 1000,
  termsAndConditions: null,
  validUntil: "2099-01-01T00:00:00Z",
  issuedAt: "2026-11-23T10:00:00Z",
  items: [
    {
      position: 1,
      productName: "Cement",
      brandName: null,
      unitLabel: "Bag",
      quantity: 10,
      unitPrice: 100,
      lineTotal: 1000,
      notes: null,
    },
  ],
};

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});
beforeEach(() => {
  track.trackEnquiryAction.mockReset();
});

describe("QuotationView (customer)", () => {
  const view = (
    q = quotation,
    business = { name: "Configured Co" } as Parameters<typeof QuotationView>[0]["business"],
  ) => render(<QuotationView quotation={q} token={TOKEN} business={business} />);

  it("prints ONLY configured business facts — no hard-coded address, bank, GSTIN, phone or tagline", () => {
    view();
    const text = document.body.textContent ?? "";
    expect(screen.getByRole("heading", { level: 1, name: "Configured Co" })).toBeInTheDocument();
    for (const forbidden of [
      "State Bank",
      "RTGS",
      "NEFT",
      "IFSC",
      "Bank",
      "Raipur",
      "Ring Road",
      "GSTIN",
      "Phone:",
      "Email:",
      "SAGAR TRADERS",
      "Quality Building Materials",
    ])
      expect(text, forbidden).not.toContain(forbidden);
    expect(screen.queryByText(/Terms/)).toBeNull(); // no terms entered → no terms section, nothing invented
  });

  it("shows the configured details and the quotation's own terms when present", () => {
    view(
      {
        ...quotation,
        termsAndConditions: "Pay on delivery.",
        taxAmount: 50,
        discountAmount: 20,
        totalAmount: 1030,
      },
      {
        name: "Configured Co",
        tagline: "Our tagline",
        address: "1 Test Street",
        phone: "+91 11111 22222",
        email: "x@y.test",
        gstin: "GST-123",
        whatsappNumber: "919999900000",
      },
    );
    const text = document.body.textContent ?? "";
    for (const expected of [
      "Our tagline",
      "1 Test Street",
      "Phone: +91 11111 22222",
      "Email: x@y.test",
      "GSTIN: GST-123",
      "Pay on delivery.",
      "Tax",
      "Discount",
    ])
      expect(text, expected).toContain(expected);
    expect(screen.getByRole("link", { name: /Call \+91 11111 22222/ })).toHaveAttribute(
      "href",
      "tel:+911111122222",
    );
  });

  it("labels superseded and expired quotations instead of presenting them as current", () => {
    const { unmount } = view({ ...quotation, isLatest: false });
    expect(screen.getByRole("status")).toHaveTextContent(/Superseded/);
    expect(screen.getByRole("status")).toHaveTextContent(/newer version/);
    unmount();
    view({ ...quotation, isExpired: true });
    expect(screen.getByRole("status")).toHaveTextContent(/Expired/);
    expect(document.body.textContent).toMatch(/Expired: /);
  });

  it("a current quotation shows no warning banner", () => {
    view();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("downloads the PDF through the same token, and shares to WhatsApp WITHOUT picking a recipient", () => {
    view();
    expect(screen.getByRole("link", { name: /Download PDF/ })).toHaveAttribute(
      "href",
      `/api/quotation/${TOKEN}/pdf`,
    );
    const share = screen.getByRole("link", { name: /Share on WhatsApp/ }) as HTMLAnchorElement;
    expect(share.href.startsWith("https://wa.me/?text=")).toBe(true);
    const text = decodeURIComponent(share.href.split("text=")[1]);
    expect(text).toContain("QUO-2026-001234");
    expect(text).toContain("version 2");
  });

  it("line items render as an accessible table with every column labelled", () => {
    view();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").length).toBeGreaterThanOrEqual(5);
    expect(within(table).getByText("Cement")).toBeInTheDocument();
    expect(within(table).getAllByText("₹1,000.00").length).toBeGreaterThan(0);
  });
});

describe("TrackEnquiryView (credentials arrive in the URL fragment)", () => {
  const found = {
    ok: true,
    data: {
      reference: "ENQ-AB12-CD34-EF56",
      type: "BULK",
      status: "CONTACTED",
      deliveryLocation: "Pune",
      createdAt: "2026-11-23T10:00:00Z",
      updatedAt: "2026-11-23T11:00:00Z",
      items: [
        {
          id: "",
          position: 1,
          productName: "Cement",
          brandName: null,
          unitLabel: "Bag",
          quantity: 10,
          listedPrice: null,
        },
      ],
      statusHistory: [
        {
          id: "",
          previousStatus: null,
          newStatus: "NEW",
          description: "Enquiry received",
          createdAt: "2026-11-23T10:00:00Z",
        },
      ],
      latestQuotation: null,
    },
  };

  it("reads ref + token from the fragment and looks the enquiry up", async () => {
    window.history.replaceState(null, "", "/track-enquiry#ref=ENQ-AB12-CD34-EF56&token=tr_secret");
    track.trackEnquiryAction.mockResolvedValue(found);
    render(<TrackEnquiryView />);
    await waitFor(() =>
      expect(track.trackEnquiryAction).toHaveBeenCalledWith("ENQ-AB12-CD34-EF56", "tr_secret"),
    );
    await screen.findByText("ENQ-AB12-CD34-EF56");
    expect(screen.getByText("Cement")).toBeInTheDocument();
  });

  it("an old link with ?ref=&token= still works once, and is immediately rewritten to the fragment form", async () => {
    window.history.replaceState(null, "", "/track-enquiry?ref=ENQ-AB12-CD34-EF56&token=tr_secret");
    track.trackEnquiryAction.mockResolvedValue(found);
    render(<TrackEnquiryView />);
    await waitFor(() => expect(track.trackEnquiryAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(window.location.search).toBe(""));
    expect(window.location.hash).toContain("token=tr_secret");
  });

  it("without credentials it just shows the lookup form and makes no request", () => {
    render(<TrackEnquiryView />);
    expect(track.trackEnquiryAction).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/reference/i)).toBeInTheDocument();
  });

  it("an invalid / expired / revoked link shows only the generic message", async () => {
    window.history.replaceState(null, "", "/track-enquiry#ref=ENQ-AB12-CD34-EF56&token=tr_expired");
    track.trackEnquiryAction.mockResolvedValue({
      ok: false,
      message: "Enquiry not found or the tracking token has expired or is invalid.",
    });
    render(<TrackEnquiryView />);
    await screen.findByText(/not found or the tracking token has expired or is invalid/i);
    expect(screen.queryByText("ENQ-AB12-CD34-EF56")).toBeNull();
  });

  it("the customer-facing page never shows contact data or internal notes", async () => {
    window.history.replaceState(null, "", "/track-enquiry#ref=ENQ-AB12-CD34-EF56&token=tr_secret");
    track.trackEnquiryAction.mockResolvedValue(found);
    render(<TrackEnquiryView />);
    await screen.findByText("ENQ-AB12-CD34-EF56");
    expect(document.body.textContent).not.toMatch(
      /internal note|9876543210|outbox|attempt|notification/i,
    );
  });

  it("copying the tracking link copies the FRAGMENT form", async () => {
    window.history.replaceState(null, "", "/track-enquiry#ref=ENQ-AB12-CD34-EF56&token=tr_secret");
    track.trackEnquiryAction.mockResolvedValue(found);
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: write },
      configurable: true,
    });
    render(<TrackEnquiryView />);
    await screen.findByText("ENQ-AB12-CD34-EF56");
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => expect(write).toHaveBeenCalled());
    const url: string = write.mock.calls[0][0];
    expect(url).toContain("/track-enquiry#ref=ENQ-AB12-CD34-EF56&token=tr_secret");
    expect(url).not.toContain("?");
  });
});
