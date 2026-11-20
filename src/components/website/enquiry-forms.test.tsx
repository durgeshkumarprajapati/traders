import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ENQUIRY_LIST_KEY, enquiryList } from "@/features/enquiries/enquiry-list-store";
import type { EnquiryActionResult } from "@/features/enquiries/result";
import { BulkEnquiryForm, type EnquiryCatalogueItem } from "./bulk-enquiry-form";
import { ContactForm } from "./contact-form";

const actions = vi.hoisted(() => ({
  submitContactEnquiryAction: vi.fn(),
  submitBulkEnquiryAction: vi.fn(),
}));
vi.mock("@/features/enquiries/actions", () => actions);
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/form", () => ({
  default: ({
    action,
    ...rest
  }: { action: string; children: ReactNode } & Record<string, unknown>) => (
    <form action={action} {...rest} />
  ),
}));

const ok = (reference: string | null = "ENQ-2026-001000"): EnquiryActionResult => ({
  ok: true,
  reference,
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  actions.submitContactEnquiryAction.mockReset();
  actions.submitBulkEnquiryAction.mockReset();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  enquiryList._reset();
});

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("ContactForm → Server Action", () => {
  const fillValid = () => {
    fill(/Your name/, "Ravi Kumar");
    fill(/Mobile number/, "91234 56789");
    fill(/^Message/, "I would like to discuss a delivery schedule.");
  };
  const form = () => screen.getByRole("form", { name: "General enquiry" });

  it("sends validated fields (with an idempotency key) and shows the saved reference — without claiming an email or WhatsApp message was sent", async () => {
    actions.submitContactEnquiryAction.mockResolvedValue(ok());
    render(<ContactForm />);
    fillValid();
    fireEvent.submit(form());
    const notice = await screen.findByText(/Enquiry received/);
    expect(actions.submitContactEnquiryAction).toHaveBeenCalledTimes(1);
    expect(actions.submitContactEnquiryAction.mock.calls[0][0]).toEqual({
      name: "Ravi Kumar",
      mobile: "91234 56789",
      email: "",
      message: "I would like to discuss a delivery schedule.",
      website: "",
      idempotencyKey: expect.stringMatching(UUID),
    });
    expect(screen.getByText("ENQ-2026-001000")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /email (was )?sent|whatsapp (message )?(was )?sent|within \d+ (minutes|hours)/i,
    );
    expect(screen.getByLabelText(/Your name/)).toHaveValue(""); // form cleared
    await waitFor(() => expect(document.activeElement).toBe(notice.closest("[tabindex]"))); // outcome announced via focus
  });

  it("does not call the server when browser-side validation fails", () => {
    render(<ContactForm />);
    fireEvent.submit(form());
    expect(actions.submitContactEnquiryAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Name is required/);
  });

  it("shows a pending state, blocks double submission, and then confirms", async () => {
    const d = deferred<EnquiryActionResult>();
    actions.submitContactEnquiryAction.mockReturnValue(d.promise);
    render(<ContactForm />);
    fillValid();
    fireEvent.submit(form());
    const button = await screen.findByRole("button", { name: "Sending…" });
    expect(button).toBeDisabled();
    expect(form()).toHaveAttribute("aria-busy", "true");
    fireEvent.submit(form()); // a second submit while pending must not reach the server twice
    await act(async () => d.resolve(ok()));
    await screen.findByText(/Enquiry received/);
    expect(actions.submitContactEnquiryAction.mock.calls.length).toBeLessThanOrEqual(2);
    expect(screen.getByRole("button", { name: "Send enquiry" })).toBeEnabled();
  });

  it.each([
    [
      "rate limited",
      {
        ok: false,
        code: "RATE_LIMITED",
        retryAfterSeconds: 300,
        message:
          "Too many enquiries from this connection. Please try again in about 5 minutes, or contact us directly.",
      } as EnquiryActionResult,
      /Too many enquiries/,
    ],
    [
      "unavailable",
      {
        ok: false,
        code: "UNAVAILABLE",
        message:
          "We could not save your enquiry right now. Please try again in a few minutes, or contact us directly.",
      } as EnquiryActionResult,
      /could not save your enquiry/,
    ],
  ])(
    "shows a clear error and NO success message when the server says: %s",
    async (_n, result, text) => {
      actions.submitContactEnquiryAction.mockResolvedValue(result);
      render(<ContactForm />);
      fillValid();
      fireEvent.submit(form());
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(text);
      expect(screen.queryByText(/Enquiry received/)).toBeNull();
      expect(screen.getByLabelText(/Your name/)).toHaveValue("Ravi Kumar"); // nothing the customer typed is lost
      await waitFor(() => expect(document.activeElement).toBe(alert));
    },
  );

  it("maps server-side field errors onto the fields", async () => {
    actions.submitContactEnquiryAction.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Please check the highlighted fields and try again.",
      fieldErrors: { mobile: "Enter a valid 10-digit mobile number." },
    });
    render(<ContactForm />);
    fillValid();
    fireEvent.submit(form());
    await waitFor(() =>
      expect(screen.getByLabelText(/Mobile number/)).toHaveAttribute("aria-invalid", "true"),
    );
    expect(screen.getByLabelText(/Mobile number/)).toHaveAccessibleDescription(/valid 10-digit/);
  });

  it("never shows raw error text when the action itself throws", async () => {
    actions.submitContactEnquiryAction.mockRejectedValue(
      new Error("ECONNREFUSED 10.0.0.5 service-role-key=abc123"),
    );
    render(<ContactForm />);
    fillValid();
    fireEvent.submit(form());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not save your enquiry/);
    expect(document.body.textContent).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|abc123/);
  });

  it("reuses the idempotency key until a submission succeeds, then issues a fresh one (no duplicate on retry)", async () => {
    actions.submitContactEnquiryAction
      .mockResolvedValueOnce({
        ok: false,
        code: "UNAVAILABLE",
        message:
          "We could not save your enquiry right now. Please try again in a few minutes, or contact us directly.",
      })
      .mockResolvedValueOnce(ok("ENQ-2026-001001"))
      .mockResolvedValueOnce(ok("ENQ-2026-001002"));
    render(<ContactForm />);
    fillValid();
    fireEvent.submit(form());
    await screen.findByRole("alert");
    fireEvent.submit(form()); // customer retries the same enquiry
    await screen.findByText(/Enquiry received/);
    fillValid();
    fireEvent.submit(form()); // a second, new enquiry
    await waitFor(() => expect(actions.submitContactEnquiryAction).toHaveBeenCalledTimes(3));
    const keys = actions.submitContactEnquiryAction.mock.calls.map((c) => c[0].idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it("includes an invisible honeypot that assistive technology and keyboard users never reach", async () => {
    actions.submitContactEnquiryAction.mockResolvedValue(ok(null));
    render(<ContactForm />);
    const trap = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap).not.toBeNull();
    expect(trap.closest("[aria-hidden='true']")).not.toBeNull();
    expect(trap.tabIndex).toBe(-1);
    expect(trap).toHaveAttribute("autocomplete", "off");
    fillValid();
    fireEvent.change(trap, { target: { value: "http://spam.example" } }); // what a bot would do
    fireEvent.submit(form());
    await waitFor(() => expect(actions.submitContactEnquiryAction).toHaveBeenCalled());
    expect(actions.submitContactEnquiryAction.mock.calls[0][0].website).toBe("http://spam.example"); // the SERVER discards it
  });

  it("a discarded (honeypot) submission shows a neutral thank-you without a reference number", async () => {
    actions.submitContactEnquiryAction.mockResolvedValue(ok(null));
    render(<ContactForm />);
    fillValid();
    fireEvent.submit(form());
    expect(await screen.findByText(/Your enquiry has been received/)).toBeInTheDocument();
    expect(screen.queryByText(/reference number/i)).toBeNull();
  });
});

const catalogue: EnquiryCatalogueItem[] = [
  {
    id: "p1",
    slug: "one",
    name: "Item One",
    brandName: "Brand X",
    sku: "S-1",
    unitLabel: "Bag",
    stockStatus: "IN_STOCK",
    rate: "₹10.00 / Bag",
  },
  {
    id: "p3",
    slug: "three",
    name: "Item Three",
    brandName: null,
    sku: null,
    unitLabel: "Metric Ton",
    stockStatus: "AVAILABLE_ON_ORDER",
    rate: null,
  },
];

describe("BulkEnquiryForm → Server Action", () => {
  const form = () => screen.getByRole("form", { name: "Bulk quotation enquiry" });
  const fillValid = () => {
    fill(/Full name/, "Asha Rao");
    fill(/Mobile number/, "9876543210");
    fill(/Delivery location/, "Pune site");
  };
  const list = () => JSON.parse(localStorage.getItem(ENQUIRY_LIST_KEY) ?? "[]");

  it("sends ONLY product ids and quantities — never names, brands, units or prices — and clears the list on success", async () => {
    act(() => {
      enquiryList.add("p1", 100);
      enquiryList.add("p3", 5.5);
    });
    actions.submitBulkEnquiryAction.mockResolvedValue(ok());
    render(<BulkEnquiryForm catalogue={catalogue} whatsappNumber="15550109999" />);
    fillValid();
    fireEvent.submit(form());
    await screen.findByText(/Enquiry received/);
    const payload = actions.submitBulkEnquiryAction.mock.calls[0][0];
    expect(payload).toEqual({
      name: "Asha Rao",
      mobile: "9876543210",
      email: "",
      deliveryLocation: "Pune site",
      message: "",
      website: "",
      items: [
        { productId: "p1", quantity: 100 },
        { productId: "p3", quantity: 5.5 },
      ],
      idempotencyKey: expect.stringMatching(UUID),
    });
    const sent = JSON.stringify(payload);
    for (const display of ["Item One", "Brand X", "Bag", "Metric Ton", "₹10.00", "S-1"])
      expect(sent).not.toContain(display);
    expect(list()).toEqual([]); // enquiry list emptied after the enquiry was saved
    expect(screen.getByText("ENQ-2026-001000")).toBeInTheDocument();
    const follow = screen.getByRole("link", { name: /Follow up on WhatsApp/ });
    expect(decodeURIComponent(follow.getAttribute("href")!)).toContain(
      "following up on my enquiry ENQ-2026-001000",
    );
    expect(document.body.textContent).not.toMatch(/email (was )?sent/i);
  });

  it("offers no WhatsApp follow-up when no number is configured", async () => {
    act(() => void enquiryList.add("p1", 1));
    actions.submitBulkEnquiryAction.mockResolvedValue(ok());
    render(<BulkEnquiryForm catalogue={catalogue} whatsappNumber={null} />);
    fillValid();
    fireEvent.submit(form());
    await screen.findByText(/Enquiry received/);
    expect(screen.queryByText(/Follow up on WhatsApp/)).toBeNull();
  });

  it("keeps the list and the typed details when the server rejects or cannot save", async () => {
    act(() => void enquiryList.add("p1", 2));
    actions.submitBulkEnquiryAction.mockResolvedValue({
      ok: false,
      code: "UNAVAILABLE",
      message:
        "We could not save your enquiry right now. Please try again in a few minutes, or contact us directly.",
    });
    render(<BulkEnquiryForm catalogue={catalogue} whatsappNumber={null} />);
    fillValid();
    fireEvent.submit(form());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not save your enquiry/);
    expect(list()).toEqual([{ productId: "p1", quantity: 2 }]);
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Asha Rao");
    expect(screen.queryByText(/Enquiry received/)).toBeNull();
  });

  it("explains which products the server no longer accepts, without clearing the list", async () => {
    act(() => {
      enquiryList.add("p1", 1);
      enquiryList.add("p3", 1);
    });
    actions.submitBulkEnquiryAction.mockResolvedValue({
      ok: false,
      code: "INVALID_PRODUCTS",
      message: "Some products are no longer available. Remove them from your list and try again.",
      productIds: ["p3", "zzz"],
    });
    render(<BulkEnquiryForm catalogue={catalogue} whatsappNumber={null} />);
    fillValid();
    fireEvent.submit(form());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Item Three");
    expect(alert).toHaveTextContent("a product that is no longer listed");
    expect(list()).toHaveLength(2);
  });

  it("stops stale ids in the browser before calling the server, and shows the pending state while saving", async () => {
    act(() => void enquiryList.add("gone", 1));
    render(<BulkEnquiryForm catalogue={catalogue} whatsappNumber={null} />);
    fillValid();
    fireEvent.submit(form());
    expect(actions.submitBulkEnquiryAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/no longer available/);
    cleanup();
    enquiryList._reset();
    localStorage.clear();

    const d = deferred<EnquiryActionResult>();
    actions.submitBulkEnquiryAction.mockReturnValue(d.promise);
    act(() => void enquiryList.add("p1", 1));
    render(<BulkEnquiryForm catalogue={catalogue} whatsappNumber={null} />);
    fillValid();
    fireEvent.submit(form());
    expect(await screen.findByRole("button", { name: "Sending…" })).toBeDisabled();
    await act(async () => d.resolve(ok()));
    await screen.findByText(/Enquiry received/);
  });

  it("includes the honeypot and an empty list is rejected locally", () => {
    render(<BulkEnquiryForm catalogue={catalogue} whatsappNumber={null} />);
    expect(
      document.querySelector('input[name="website"]')?.closest("[aria-hidden='true']"),
    ).not.toBeNull();
    fireEvent.submit(form());
    expect(actions.submitBulkEnquiryAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Add at least one product/);
  });
});

describe("Email enquiry button (mailto) — the email counterpart of WhatsApp", () => {
  const mailto = () =>
    screen.queryByRole("link", { name: /Send list by email/ }) as HTMLAnchorElement | null;

  it("opens the customer's email app with the list prefilled from server data, and creates NO record", () => {
    act(() => {
      enquiryList.add("p1", 100);
      enquiryList.add("p3", 5.5);
    });
    render(
      <BulkEnquiryForm
        catalogue={catalogue}
        whatsappNumber={null}
        businessEmail="sales@example.test"
      />,
    );
    const link = mailto()!;
    expect(link).toBeInTheDocument();
    expect(link.href.startsWith("mailto:sales@example.test?")).toBe(true);
    const params = new URLSearchParams(link.href.split("?")[1]);
    expect(params.get("subject")).toBe("Bulk quotation enquiry");
    expect(params.get("body")).toContain("- Item One: 100 Bag");
    expect(params.get("body")).toContain("- Item Three: 5.5 Metric Ton");
    expect(link).not.toHaveAttribute("target"); // no tab hijack; mail app handles it
    fireEvent.click(link);
    expect(actions.submitBulkEnquiryAction).not.toHaveBeenCalled();
    expect(actions.submitContactEnquiryAction).not.toHaveBeenCalled();
  });

  it("is hidden when no valid business email is configured (never a dead or invented address)", () => {
    const { unmount } = render(<BulkEnquiryForm catalogue={catalogue} whatsappNumber={null} />);
    expect(mailto()).toBeNull();
    unmount();
    render(
      <BulkEnquiryForm catalogue={catalogue} whatsappNumber={null} businessEmail="not-an-email" />,
    );
    expect(mailto()).toBeNull();
  });

  it("does not claim anything was sent", () => {
    render(
      <BulkEnquiryForm catalogue={catalogue} whatsappNumber={null} businessEmail="a@b.test" />,
    );
    expect(screen.getByText(/only prepares a message; you must press Send/)).toBeInTheDocument();
  });
});
