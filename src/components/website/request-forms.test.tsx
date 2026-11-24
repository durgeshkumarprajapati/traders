import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeliveryCheck } from "./delivery-check";
import { ExpertForm } from "./expert-form";

const { freight, expert, check } = vi.hoisted(() => ({
  freight: vi.fn(),
  expert: vi.fn(),
  check: vi.fn(),
}));
vi.mock("@/features/enquiries/request-actions", () => ({
  submitFreightEnquiryAction: freight,
  submitExpertEnquiryAction: expert,
  checkDeliveryAction: check,
}));

beforeEach(() => {
  freight.mockReset();
  expert.mockReset();
  check.mockReset();
});

describe("DeliveryCheck", () => {
  it("rejects a malformed PIN without calling the server", async () => {
    render(<DeliveryCheck />);
    fireEvent.change(screen.getAllByLabelText(/^Delivery PIN code/)[0], {
      target: { value: "12ab" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Check delivery area/ }));
    expect(screen.getByText("Enter a valid six-digit PIN code.")).toBeInTheDocument();
    expect(check).not.toHaveBeenCalled();
  });

  it("shows the server's answer and never a freight price", async () => {
    check.mockResolvedValue({
      status: "LISTED",
      message: "This PIN code is in the delivery area we have listed. Delivery is not guaranteed.",
      notes: null,
      terms: null,
      localities: null,
    });
    render(<DeliveryCheck />);
    fireEvent.change(screen.getAllByLabelText(/^Delivery PIN code/)[0], {
      target: { value: "110001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Check delivery area/ }));
    expect(await screen.findByRole("status")).toHaveTextContent(/not guaranteed/);
    expect(document.body.textContent).not.toMatch(/₹/);
  });

  it("still lets the customer send a freight enquiry if the check fails", async () => {
    check.mockRejectedValue(new Error("down"));
    render(<DeliveryCheck />);
    fireEvent.change(screen.getAllByLabelText(/^Delivery PIN code/)[0], {
      target: { value: "110001" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Check delivery area/ }));
    expect(await screen.findByText(/could not check the delivery area/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send freight enquiry" })).toBeEnabled();
  });

  it("submits the freight enquiry with one stable key and shows the reference", async () => {
    freight.mockResolvedValue({ ok: true, reference: "ENQ-AAAA-BBBB-CCCC", trackingUrl: null });
    render(<DeliveryCheck />);
    fireEvent.change(screen.getAllByLabelText(/^Delivery PIN code/)[0], {
      target: { value: "110001" },
    });
    fireEvent.change(screen.getByLabelText(/^Your name/), { target: { value: "Ravi Kumar" } });
    fireEvent.change(screen.getByLabelText(/^Mobile number/), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText(/^Locality/), { target: { value: "Sector 5" } });
    fireEvent.change(screen.getByLabelText(/^Materials needed/), {
      target: { value: "Cement bags" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send freight enquiry" }));
    await waitFor(() => expect(freight).toHaveBeenCalledTimes(1));
    expect(freight.mock.calls[0][0]).toMatchObject({
      pincode: "110001",
      locality: "Sector 5",
      materials: "Cement bags",
      website: "",
    });
    expect(freight.mock.calls[0][0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByText(/ENQ-AAAA-BBBB-CCCC/)).toBeInTheDocument();
  });

  it("keeps typed values and shows field errors when the server rejects", async () => {
    freight.mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      message: "Please check the highlighted fields and try again.",
      fieldErrors: { mobile: "Enter a valid 10-digit mobile number." },
    });
    render(<DeliveryCheck />);
    fireEvent.change(screen.getByLabelText(/^Your name/), { target: { value: "Ravi Kumar" } });
    fireEvent.click(screen.getByRole("button", { name: "Send freight enquiry" }));
    expect(await screen.findByText("Enter a valid 10-digit mobile number.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Your name/)).toHaveValue("Ravi Kumar");
  });
});

describe("ExpertForm", () => {
  it("sends a structured question and confirms with the reference", async () => {
    expert.mockResolvedValue({ ok: true, reference: "ENQ-1111-2222-3333", trackingUrl: null });
    render(<ExpertForm />);
    fireEvent.change(screen.getByLabelText(/^Your name/), { target: { value: "Ravi Kumar" } });
    fireEvent.change(screen.getByLabelText(/^Mobile number/), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText("Topic"), { target: { value: "STEEL_REINFORCEMENT" } });
    fireEvent.change(screen.getByLabelText(/^Your question/), {
      target: { value: "Which TMT grade for a column?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() => expect(expert).toHaveBeenCalledTimes(1));
    expect(expert.mock.calls[0][0]).toMatchObject({
      topic: "STEEL_REINFORCEMENT",
      projectType: "NOT_SURE",
    });
    expect(await screen.findByText(/ENQ-1111-2222-3333/)).toBeInTheDocument();
  });

  it("shows an unavailable message and keeps the question when sending fails", async () => {
    expert.mockRejectedValue(new Error("network"));
    render(<ExpertForm />);
    fireEvent.change(screen.getByLabelText(/^Your question/), {
      target: { value: "Which cement grade?? please" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    expect(await screen.findByText(/could not send your request/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Your question/)).toHaveValue("Which cement grade?? please");
  });
});
