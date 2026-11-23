import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AdminEnquiryDetail } from "@/features/admin/types";
import type { QuotationRecord } from "@/features/quotations/types";
import { QuotationManager } from "./quotation-manager";

const actions = vi.hoisted(() => ({
  createQuotationDraftAction: vi.fn(),
  issueQuotationAction: vi.fn(),
  rotateQuotationLinkAction: vi.fn(),
  revokeQuotationLinkAction: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("@/features/quotations/actions", () => actions);
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/enquiries/e1",
}));

const enquiry = {
  id: "11111111-1111-4111-8111-111111111111",
  reference: "ENQ-AB12-CD34-EF56",
  customerName: "Asha Rao",
  mobile: "9876543210",
  email: "asha@example.test",
  items: [
    {
      id: "i1",
      productId: "p1",
      sku: "C-1",
      productName: "Cement PPC",
      brandName: "Brand One",
      unitCode: "BAG",
      unitLabel: "Bag",
      quantity: 100,
      listedPrice: 385,
      stockStatus: "IN_STOCK",
    },
    {
      id: "i2",
      productId: "p2",
      sku: null,
      productName: "TMT 12mm",
      brandName: null,
      unitCode: "METRIC_TON",
      unitLabel: "MT",
      quantity: 2,
      listedPrice: null,
      stockStatus: "AVAILABLE_ON_ORDER",
    },
  ],
} as unknown as AdminEnquiryDetail;

const quo = (over: Partial<QuotationRecord> = {}): QuotationRecord => ({
  id: "22222222-2222-4222-8222-222222222222",
  reference: "QUO-2026-001000",
  enquiryId: enquiry.id,
  version: 1,
  status: "DRAFT",
  customerName: "Asha Rao",
  mobile: "9876543210",
  email: null,
  deliveryLocation: null,
  subtotal: 38500,
  discountAmount: 0,
  taxAmount: 0,
  totalAmount: 38500,
  termsAndConditions: "Keep this clause",
  validUntil: "2099-01-01T00:00:00Z",
  linkState: "NONE",
  linkExpiresAt: null,
  viewCount: 0,
  lastViewedAt: null,
  createdBy: null,
  createdAt: "2026-11-23T10:00:00Z",
  updatedAt: "2026-11-23T10:00:00Z",
  issuedAt: null,
  items: [
    {
      id: "x",
      quotationId: "q",
      position: 1,
      productId: "p1",
      sku: "C-1",
      productName: "Cement PPC",
      brandName: "Brand One",
      unitCode: "BAG",
      unitLabel: "Bag",
      quantity: 100,
      unitPrice: 385,
      lineTotal: 38500,
      notes: null,
    },
  ],
  ...over,
});

beforeEach(() => {
  Object.values(actions).forEach((f) => f.mockReset());
  router.refresh.mockReset();
});
afterEach(cleanup);

const dialog = () => document.querySelector("dialog[open]") as HTMLElement;

describe("QuotationManager", () => {
  it("lists the quotations passed in (the page loads them), with version and status", () => {
    render(
      <QuotationManager
        enquiry={enquiry}
        quotations={[
          quo(),
          quo({
            id: "3",
            reference: "QUO-2026-000999",
            version: 0 + 2,
            status: "REVISED",
            linkState: "ACTIVE",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Quotations (2)")).toBeInTheDocument();
    expect(screen.getByText("QUO-2026-001000")).toBeInTheDocument();
    expect(screen.getByText("Superseded")).toBeInTheDocument();
  });

  it("empty state is honest", () => {
    render(<QuotationManager enquiry={enquiry} quotations={[]} />);
    expect(screen.getByText(/No quotation has been created/)).toBeInTheDocument();
  });

  it("the new-quotation form starts with NO invented terms, NO default validity and NO assumed rate for unpriced lines", () => {
    render(<QuotationManager enquiry={enquiry} />);
    fireEvent.click(screen.getByRole("button", { name: /New quotation/ }));
    const d = within(dialog());
    expect((d.getByLabelText(/Terms & conditions/) as HTMLTextAreaElement).value).toBe("");
    expect((d.getByLabelText(/Valid for/) as HTMLInputElement).value).toBe("");
    const rates = d.getAllByLabelText(/Rate/) as HTMLInputElement[];
    expect(rates[0].value).toBe("385"); // enquiry snapshot price: a visible starting suggestion
    expect(rates[1].value).toBe(""); // no price → blank, never 0
    expect(dialog().textContent).not.toMatch(/RTGS|NEFT|advance|7 days|GST 18/i);
    expect(d.getByText(/Not calculated automatically/)).toBeInTheDocument();
  });

  it("catalogue-backed lines cannot be renamed or re-unit'd; manual lines can be added and removed", () => {
    render(<QuotationManager enquiry={enquiry} />);
    fireEvent.click(screen.getByRole("button", { name: /New quotation/ }));
    const d = within(dialog());
    const descriptions = d.getAllByLabelText(/Description/) as HTMLInputElement[];
    expect(descriptions[0].readOnly).toBe(true);
    fireEvent.click(d.getByRole("button", { name: /Add a manual line/ }));
    const after = d.getAllByLabelText(/Description/) as HTMLInputElement[];
    expect(after).toHaveLength(3);
    expect(after[2].readOnly).toBe(false);
    fireEvent.click(d.getByRole("button", { name: /Remove line 3/ }));
    expect(d.getAllByLabelText(/Description/)).toHaveLength(2);
  });

  it("shows only a PREVIEW of totals computed with exact arithmetic", () => {
    render(<QuotationManager enquiry={enquiry} />);
    fireEvent.click(screen.getByRole("button", { name: /New quotation/ }));
    const d = within(dialog());
    fireEvent.change(d.getAllByLabelText(/Rate/)[1], { target: { value: "0.1" } });
    expect(d.getByText("Subtotal (preview)").nextSibling).toHaveTextContent("₹38,500.20"); // 100 x 385 + 2 x 0.10
    expect(d.getByText("Total (preview)")).toBeInTheDocument();
  });

  it("saves a draft sending numbers parsed from the form — and NO totals", async () => {
    actions.createQuotationDraftAction.mockResolvedValue({
      ok: true,
      data: { quotationId: "q", reference: "QUO-2026-001001", version: 1 },
    });
    render(<QuotationManager enquiry={enquiry} />);
    fireEvent.click(screen.getByRole("button", { name: /New quotation/ }));
    const d = within(dialog());
    fireEvent.change(d.getAllByLabelText(/Rate/)[1], { target: { value: "62500" } });
    fireEvent.change(d.getByLabelText(/Valid for/), { target: { value: "7" } });
    fireEvent.change(d.getByLabelText(/Terms & conditions/), {
      target: { value: "  Pay on delivery  " },
    });
    fireEvent.click(d.getByRole("button", { name: /Save draft/ }));
    await screen.findByText(/Draft QUO-2026-001001 \(version 1\) saved/);
    const input = actions.createQuotationDraftAction.mock.calls[0][0];
    expect(input.enquiryId).toBe(enquiry.id);
    expect(input.validDays).toBe(7);
    expect(input.items[1]).toMatchObject({ productId: "p2", quantity: 2, unitPrice: 62500 });
    expect(input.termsAndConditions).toBe("Pay on delivery");
    expect(JSON.stringify(input)).not.toMatch(/subtotal|totalAmount|lineTotal/);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("a server refusal is shown in the form and keeps the dialog (and its content) open", async () => {
    actions.createQuotationDraftAction.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Validity must be 1–90 days",
    });
    render(<QuotationManager enquiry={enquiry} />);
    fireEvent.click(screen.getByRole("button", { name: /New quotation/ }));
    const d = within(dialog());
    fireEvent.click(d.getByRole("button", { name: /Save draft/ }));
    await d.findByText("Validity must be 1–90 days");
    expect(dialog()).toBeTruthy();
  });

  it("issuing needs confirmation, then shows the customer link ONCE with copy / WhatsApp / email-app options and honest wording", async () => {
    actions.issueQuotationAction.mockResolvedValue({
      ok: true,
      data: {
        rawToken: `qt_${"a".repeat(64)}`,
        trackingUrl: `/quotation/qt_${"a".repeat(64)}`,
        reference: "QUO-2026-001000",
        enquiryStatusChanged: true,
      },
    });
    render(<QuotationManager enquiry={enquiry} quotations={[quo()]} />);
    fireEvent.click(screen.getByRole("button", { name: /Issue to customer/ }));
    expect(actions.issueQuotationAction).not.toHaveBeenCalled(); // confirmation first
    expect(dialog()).toHaveTextContent(/can never be edited/i);
    fireEvent.click(within(dialog()).getByRole("button", { name: /Issue quotation/ }));
    await screen.findByText(/shown once/);
    expect(actions.issueQuotationAction).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      enquiry.id,
    );
    expect(screen.getByText(/moved to Quotation Sent/)).toBeInTheDocument();
    const url = `${window.location.origin}/quotation/qt_${"a".repeat(64)}`;
    expect(screen.getByText(url)).toBeInTheDocument();
    const wa = screen.getByRole("link", { name: /Send via WhatsApp/ }) as HTMLAnchorElement;
    expect(wa.href).toContain("wa.me/919876543210");
    expect(decodeURIComponent(wa.href)).toContain(url);
    const mail = screen.getByRole("link", {
      name: /Email customer \(opens your email app\)/,
    }) as HTMLAnchorElement;
    expect(mail.href.startsWith("mailto:asha@example.test?")).toBe(true);
    expect(screen.getByText(/nothing is sent by the website/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Automatic emailing of quotations is not available yet/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(url)).toBeNull(); // gone: only its hash exists server-side
  });

  it("no email-app link when the customer gave no email", async () => {
    actions.issueQuotationAction.mockResolvedValue({
      ok: true,
      data: {
        rawToken: "t",
        trackingUrl: `/quotation/qt_${"b".repeat(64)}`,
        reference: "QUO-1",
        enquiryStatusChanged: false,
      },
    });
    render(<QuotationManager enquiry={{ ...enquiry, email: null }} quotations={[quo()]} />);
    fireEvent.click(screen.getByRole("button", { name: /Issue to customer/ }));
    fireEvent.click(within(dialog()).getByRole("button", { name: /Issue quotation/ }));
    await screen.findByText(/shown once/);
    expect(screen.queryByRole("link", { name: /Email customer/ })).toBeNull();
  });

  it("a failed issue reports the reason and shows no link", async () => {
    actions.issueQuotationAction.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Only a draft can be issued (this one is already ISSUED)",
    });
    render(<QuotationManager enquiry={enquiry} quotations={[quo()]} />);
    fireEvent.click(screen.getByRole("button", { name: /Issue to customer/ }));
    fireEvent.click(within(dialog()).getByRole("button", { name: /Issue quotation/ }));
    await screen.findByText(/Only a draft can be issued/);
    expect(screen.queryByText(/shown once/)).toBeNull();
  });

  it("controls match the status: drafts can be issued; issued ones can be re-linked / revoked / revised but never re-issued", () => {
    const issued = quo({
      id: "33333333-3333-4333-8333-333333333333",
      reference: "QUO-I",
      version: 2,
      status: "ISSUED",
      linkState: "ACTIVE",
      viewCount: 3,
    });
    render(<QuotationManager enquiry={enquiry} quotations={[issued, quo()]} />);
    const cards = screen.getAllByRole("listitem");
    const issuedCard = within(cards[0]);
    expect(issuedCard.queryByRole("button", { name: /Issue to customer/ })).toBeNull();
    expect(issuedCard.getByRole("button", { name: /New link/ })).toBeInTheDocument();
    expect(issuedCard.getByRole("button", { name: /Revoke link/ })).toBeInTheDocument();
    expect(issuedCard.getByRole("button", { name: /Revise \(new version\)/ })).toBeInTheDocument();
    expect(issuedCard.getByText(/customer views: 3/)).toBeInTheDocument();
    expect(within(cards[1]).getByRole("button", { name: /Issue to customer/ })).toBeInTheDocument();
  });

  it("PDF links go to the admin-only route (drafts are previewable)", () => {
    render(<QuotationManager enquiry={enquiry} quotations={[quo()]} />);
    expect(screen.getByRole("link", { name: /Preview PDF/ })).toHaveAttribute(
      "href",
      "/api/admin/quotations/22222222-2222-4222-8222-222222222222/pdf",
    );
  });

  it("revising pre-fills from that version, but still demands a fresh validity period", () => {
    render(
      <QuotationManager
        enquiry={enquiry}
        quotations={[quo({ status: "ISSUED", linkState: "ACTIVE" })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Revise \(new version\)/ }));
    const d = within(dialog());
    expect(dialog()).toHaveTextContent(/New version based on QUO-2026-001000 v1/);
    expect((d.getByLabelText(/Terms & conditions/) as HTMLTextAreaElement).value).toBe(
      "Keep this clause",
    );
    expect((d.getAllByLabelText(/Rate/)[0] as HTMLInputElement).value).toBe("385");
    expect((d.getByLabelText(/Valid for/) as HTMLInputElement).value).toBe("");
  });

  it("rotating shows the new link once; revoking says the customer can no longer open it", async () => {
    actions.rotateQuotationLinkAction.mockResolvedValue({
      ok: true,
      data: { trackingUrl: `/quotation/qt_${"c".repeat(64)}` },
    });
    actions.revokeQuotationLinkAction.mockResolvedValue({ ok: true, data: { revoked: true } });
    render(
      <QuotationManager
        enquiry={enquiry}
        quotations={[quo({ status: "ISSUED", linkState: "ACTIVE" })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /New link/ }));
    await screen.findByText(/previous link no longer works/i);
    expect(screen.getByText(/shown once/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /Revoke link/ })).toBeEnabled()); // disabled while the rotate request runs
    fireEvent.click(screen.getByRole("button", { name: /Revoke link/ }));
    await screen.findByText(/can no longer open it/i);
    expect(screen.queryByText(/shown once/)).toBeNull();
  });

  it("never renders a token hash or any internal id as text", () => {
    render(
      <QuotationManager
        enquiry={enquiry}
        quotations={[quo({ status: "ISSUED", linkState: "ACTIVE" })]}
      />,
    );
    expect(document.body.textContent).not.toMatch(/[0-9a-f]{64}|tracking_token|createdBy/);
  });

  it("while a request is running the action buttons are disabled (no double issue)", async () => {
    let release!: (v: unknown) => void;
    actions.issueQuotationAction.mockReturnValue(new Promise((r) => (release = r)));
    render(<QuotationManager enquiry={enquiry} quotations={[quo()]} />);
    fireEvent.click(screen.getByRole("button", { name: /Issue to customer/ }));
    fireEvent.click(within(dialog()).getByRole("button", { name: /Issue quotation/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /New quotation/ })).toBeDisabled(),
    );
    release({ ok: false, code: "VALIDATION", message: "x" });
  });
});
