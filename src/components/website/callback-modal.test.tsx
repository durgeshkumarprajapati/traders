import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { istDatePlusDays, istToday } from "@/features/enquiries/callback-schemas";
import { CallbackModal } from "./callback-modal";

const action = vi.hoisted(() => ({ submitCallbackEnquiryAction: vi.fn() }));
vi.mock("@/features/enquiries/callback-actions", () => action);

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const open = (props: Partial<React.ComponentProps<typeof CallbackModal>> = {}) =>
  render(<CallbackModal open onClose={() => {}} {...props} />);
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

beforeEach(() => {
  action.submitCallbackEnquiryAction.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const form = () => document.querySelector("form")!;
const valid = () => {
  fill(/Your name/, "Asha Rao");
  fill(/Mobile number/, "9876543210");
};

describe("CallbackModal", () => {
  it("validates on the client first and sends nothing when invalid", () => {
    open();
    fireEvent.submit(form());
    expect(screen.getByText(/enter your name/i)).toBeInTheDocument();
    expect(screen.getByText(/valid 10-digit/i)).toBeInTheDocument();
    fill(/Your name/, "Asha Rao");
    fill(/Mobile number/, "9876543210");
    fill(/Email/, "nope");
    fireEvent.submit(form());
    expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    expect(action.submitCallbackEnquiryAction).not.toHaveBeenCalled();
  });

  it("the date picker is limited to today … +30 days in India time", () => {
    open();
    const d = screen.getByLabelText(/Preferred date/) as HTMLInputElement;
    expect(d.min).toBe(istToday());
    expect(d.max).toBe(istDatePlusDays(30));
  });

  it("only digits are accepted in the mobile field, capped at 10", () => {
    open();
    fill(/Mobile number/, "98a76-54321 0999");
    expect((screen.getByLabelText(/Mobile number/) as HTMLInputElement).value).toBe("9876543210");
  });

  it("sends the optional fields and a honeypot, with a UUID idempotency key", async () => {
    action.submitCallbackEnquiryAction.mockResolvedValue({
      ok: true,
      reference: "ENQ-AB12-CD34-EF56",
      trackingUrl: null,
    });
    open();
    valid();
    fill(/Email/, "a@b.test");
    fill(/Reason/, "TMT rates");
    fill(/Message/, "Call after 5");
    fireEvent.submit(form());
    await screen.findByText(/Enquiry received/);
    const p = action.submitCallbackEnquiryAction.mock.calls[0][0];
    expect(p).toMatchObject({
      name: "Asha Rao",
      mobile: "9876543210",
      email: "a@b.test",
      reason: "TMT rates",
      message: "Call after 5",
      preferredTimeWindow: "ANYTIME",
      website: "",
    });
    expect(p.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("a retry after a failure reuses the SAME idempotency key (no duplicate if the first request actually landed)", async () => {
    action.submitCallbackEnquiryAction
      .mockResolvedValueOnce({
        ok: false,
        code: "UNAVAILABLE",
        message: "We could not save your enquiry right now.",
      })
      .mockResolvedValueOnce({ ok: true, reference: "ENQ-AB12-CD34-EF56" });
    open();
    valid();
    fireEvent.submit(form());
    await screen.findByText(/details are still here/i);
    fireEvent.submit(form());
    await screen.findByText(/Enquiry received/, undefined, { timeout: 4000 });
    const [a, b] = action.submitCallbackEnquiryAction.mock.calls.map((c) => c[0].idempotencyKey);
    expect(a).toBe(b);
  });

  it("keeps everything typed when saving fails, and says so", async () => {
    action.submitCallbackEnquiryAction.mockResolvedValue({
      ok: false,
      code: "UNAVAILABLE",
      message: "We could not save your enquiry right now.",
    });
    open();
    valid();
    fill(/Message/, "keep me");
    fireEvent.submit(form());
    await screen.findByText(/details are still here/i);
    expect((screen.getByLabelText(/Your name/) as HTMLInputElement).value).toBe("Asha Rao");
    expect((screen.getByLabelText(/Message/) as HTMLTextAreaElement).value).toBe("keep me");
    expect(screen.queryByText(/Enquiry received/)).toBeNull(); // never claims success when nothing was saved
  });

  it("a second submit while the first is in flight is ignored", async () => {
    const d = deferred<unknown>();
    action.submitCallbackEnquiryAction.mockReturnValue(d.promise);
    open();
    valid();
    fireEvent.submit(form());
    fireEvent.submit(form());
    fireEvent.submit(form());
    await waitFor(() => expect(screen.getByRole("button", { name: /Sending/ })).toBeDisabled());
    expect(action.submitCallbackEnquiryAction).toHaveBeenCalledTimes(1);
    d.resolve({ ok: true, reference: "ENQ-AB12-CD34-EF56" });
    await screen.findByText(/Enquiry received/);
  });

  it("success: shows the reference and the REQUESTED time, and never says a callback is scheduled or done", async () => {
    action.submitCallbackEnquiryAction.mockResolvedValue({
      ok: true,
      reference: "ENQ-AB12-CD34-EF56",
      trackingUrl: "/track-enquiry#ref=x&token=y",
    });
    open({ contact: { phone: "+91 11111 22222", whatsappNumber: "919999900000" } });
    valid();
    const date = istDatePlusDays(3);
    fill(/Preferred date/, date);
    fireEvent.change(screen.getByLabelText(/Preferred time/), { target: { value: "EVENING" } });
    fireEvent.submit(form());
    await screen.findByText(/Enquiry received/);
    expect(screen.getByText(/ENQ-AB12-CD34-EF56/)).toBeInTheDocument();
    expect(screen.getByText(/Your requested callback time/)).toBeInTheDocument();
    expect(screen.getByText(/Evening/)).toBeInTheDocument();
    expect(screen.getByText(/not a confirmed appointment/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /scheduled|we will call you at|callback (has been|is) (booked|confirmed)/i,
    );
    expect(screen.getByRole("link", { name: /Call us now/ })).toHaveAttribute(
      "href",
      "tel:+911111122222",
    );
    expect(screen.getByRole("link", { name: /WhatsApp us/ })).toHaveAttribute(
      "href",
      expect.stringContaining("wa.me/919999900000"),
    );
  });

  it("shows call / WhatsApp only when they are configured (nothing invented)", async () => {
    action.submitCallbackEnquiryAction.mockResolvedValue({
      ok: true,
      reference: "ENQ-AB12-CD34-EF56",
    });
    open();
    valid();
    fireEvent.submit(form());
    await screen.findByText(/Enquiry received/);
    expect(screen.queryByRole("link", { name: /Call us now/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /WhatsApp us/ })).toBeNull();
  });

  it("offline: nothing is sent and the form is kept", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    open();
    valid();
    fireEvent.submit(form());
    expect(screen.getByText(/You are offline/)).toBeInTheDocument();
    expect(action.submitCallbackEnquiryAction).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/Your name/) as HTMLInputElement).value).toBe("Asha Rao");
  });

  it("a honeypot hit is simulated as success by the server and shows no reference", async () => {
    action.submitCallbackEnquiryAction.mockResolvedValue({ ok: true, reference: null });
    open();
    valid();
    fireEvent.submit(form());
    await screen.findByText(/Enquiry received/);
    expect(screen.queryByText(/ENQ-/)).toBeNull();
  });
});
