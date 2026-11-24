import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { sampleCard } from "@/features/business-card/fixtures";
import { BusinessCallLink } from "./business-call-link";
import { BusinessCardPanel } from "./business-card-panel";

const { renderPng, download, share, canShare } = vi.hoisted(() => ({
  renderPng: vi.fn(),
  download: vi.fn(),
  share: vi.fn(),
  canShare: vi.fn(() => false),
}));
vi.mock("@/features/business-card/export", async (orig) => ({
  ...(await orig<typeof import("@/features/business-card/export")>()),
  renderCardPng: renderPng,
  downloadBlob: download,
  shareCardFile: share,
  canShareImageFiles: canShare,
}));

beforeEach(() => {
  renderPng.mockReset();
  download.mockReset();
  share.mockReset();
  canShare.mockReset();
  canShare.mockReturnValue(false);
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never; // jsdom has no canvas
});
afterEach(cleanup);

const png = () => new Blob(["x"], { type: "image/png" });
const downloadButton = () =>
  screen.getByRole("button", { name: /Download Business Visiting Card|Preparing/ });

describe("BusinessCallLink", () => {
  it("renders a tel: link with the normalised number and a descriptive accessible name", () => {
    render(<BusinessCallLink phone="+91-98765-43210" businessName="Test Traders" />);
    const a = screen.getByRole("link", { name: "Call Test Traders at +91-98765-43210" });
    expect(a).toHaveAttribute("href", "tel:+919876543210");
    expect(a.className).toMatch(/min-h-11/); // 44px touch target
  });
  it("shows the number the way the owner wrote it, but dials the normalised one", () => {
    render(<BusinessCallLink phone="098765 43210" businessName="T" />);
    expect(screen.getByRole("link")).toHaveTextContent("098765 43210");
    expect(screen.getByRole("link")).toHaveAttribute("href", "tel:+919876543210");
  });
  it.each([null, undefined, "", "call us", "12345", "98765 43210 ext 5"])(
    "renders nothing for %j (never a working-looking link to a bad number)",
    (phone) => {
      const { container } = render(<BusinessCallLink phone={phone as string} businessName="T" />);
      expect(container).toBeEmptyDOMElement();
    },
  );
  it("keeps custom visible text as the accessible name", () => {
    render(
      <BusinessCallLink phone="+91 11111 22222" businessName="T">
        Call now
      </BusinessCallLink>,
    );
    expect(screen.getByRole("link", { name: "Call now" })).toHaveAttribute(
      "href",
      "tel:+911111122222",
    );
  });
});

describe("BusinessCardPanel", () => {
  it("previews the card with an accessible description of what it shows", () => {
    render(<BusinessCardPanel data={sampleCard()} />);
    const img = screen.getByRole("img", { name: /Visiting card for Test Hardware & Traders/ });
    expect(img.getAttribute("aria-label")).toContain("+91 11111 22222");
    expect(img.getAttribute("aria-label")).toContain("categories: Cement, Steel, Bricks");
  });

  it("generates the PNG, downloads it with a meaningful filename and confirms honestly", async () => {
    renderPng.mockResolvedValue(png());
    render(<BusinessCardPanel data={sampleCard()} />);
    fireEvent.click(downloadButton());
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(download.mock.calls[0][1]).toBe("test-hardware-traders-business-card.png");
    const message = await screen.findByText(
      /downloading as test-hardware-traders-business-card\.png/,
    );
    // never claims the image was saved to the gallery
    expect(message.textContent).not.toMatch(/saved to your (phone|gallery)|added to your gallery/i);
    expect(message.textContent).toMatch(/open the image and choose Save or Share/);
  });

  it("shows 'Preparing Visiting Card…', disables the button, and ignores repeated clicks while generating", async () => {
    let release!: (b: Blob) => void;
    renderPng.mockImplementation(() => new Promise<Blob>((r) => (release = r)));
    render(<BusinessCardPanel data={sampleCard()} />);
    const btn = downloadButton();
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(await screen.findByRole("button", { name: /Preparing Visiting Card/ })).toBeDisabled();
    expect(renderPng).toHaveBeenCalledTimes(1);
    await act(async () => release(png()));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(downloadButton()).toBeEnabled();
  });

  it("reports a failure, downloads nothing, and lets the customer retry", async () => {
    renderPng.mockRejectedValueOnce(new Error("encode"));
    render(<BusinessCardPanel data={sampleCard()} />);
    fireEvent.click(downloadButton());
    expect(
      await screen.findByText(/could not create the visiting card image/i),
    ).toBeInTheDocument();
    expect(download).not.toHaveBeenCalled();
    renderPng.mockResolvedValueOnce(png());
    fireEvent.click(downloadButton());
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  });

  it("offers a share button only where the browser can share image files", () => {
    render(<BusinessCardPanel data={sampleCard()} />);
    expect(screen.queryByRole("button", { name: /Share card/ })).toBeNull();
    cleanup();
    canShare.mockReturnValue(true);
    render(<BusinessCardPanel data={sampleCard()} />);
    expect(screen.getByRole("button", { name: /Share card/ })).toBeInTheDocument();
  });

  it("shares through the native sheet when chosen, and falls back to a download when sharing is unsupported", async () => {
    canShare.mockReturnValue(true);
    renderPng.mockResolvedValue(png());
    share.mockResolvedValueOnce("shared");
    render(<BusinessCardPanel data={sampleCard()} />);
    fireEvent.click(screen.getByRole("button", { name: /Share card/ }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(download).not.toHaveBeenCalled();
    share.mockResolvedValueOnce("unsupported");
    fireEvent.click(screen.getByRole("button", { name: /Share card/ }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  });

  it("says nothing when the customer cancels the share sheet, and reports a real share failure", async () => {
    canShare.mockReturnValue(true);
    renderPng.mockResolvedValue(png());
    share.mockResolvedValueOnce("cancelled");
    render(<BusinessCardPanel data={sampleCard()} />);
    fireEvent.click(screen.getByRole("button", { name: /Share card/ }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(screen.queryByText(/Sharing did not work/)).toBeNull();
    share.mockResolvedValueOnce("failed");
    fireEvent.click(screen.getByRole("button", { name: /Share card/ }));
    expect(await screen.findByText(/Sharing did not work/)).toBeInTheDocument();
  });
});
