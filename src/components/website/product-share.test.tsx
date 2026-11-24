import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProductShare } from "./product-share";

afterEach(cleanup);
const url = "https://shop.example.test/products/cement-ppc";

describe("ProductShare", () => {
  it("shows the server-generated QR with a meaningful alt text, and PNG / SVG downloads", () => {
    render(<ProductShare slug="cement-ppc" name="Cement PPC" url={url} />);
    expect(
      screen.getByRole("img", { name: "QR code that opens the Cement PPC page" }),
    ).toHaveAttribute("src", "/api/qr/product/cement-ppc?format=svg");
    expect(screen.getByRole("link", { name: /Download PNG/ })).toHaveAttribute(
      "href",
      "/api/qr/product/cement-ppc?format=png&size=768&download=1",
    );
    expect(screen.getByRole("link", { name: /Download SVG/ })).toHaveAttribute(
      "href",
      "/api/qr/product/cement-ppc?format=svg&download=1",
    );
  });

  it("copies the canonical product link", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: write },
      configurable: true,
    });
    render(<ProductShare slug="cement-ppc" name="Cement PPC" url={url} />);
    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));
    expect(write).toHaveBeenCalledWith(url);
    await screen.findByText("Link copied");
  });

  it("uses the device share sheet when available, sharing only the public URL", () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    render(<ProductShare slug="cement-ppc" name="Cement PPC" url={url} />);
    fireEvent.click(screen.getByRole("button", { name: /^Share$/ }));
    expect(share).toHaveBeenCalledWith({ title: "Cement PPC", url });
    delete (navigator as unknown as { share?: unknown }).share;
  });

  it("falls back to copying when there is no share sheet", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: write },
      configurable: true,
    });
    render(<ProductShare slug="cement-ppc" name="Cement PPC" url={url} />);
    fireEvent.click(screen.getByRole("button", { name: /^Share$/ }));
    await screen.findByText("Link copied");
  });
});
