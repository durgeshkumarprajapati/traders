// @vitest-environment node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Path2D, createCanvas } from "@napi-rs/canvas";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { qrMatrix } from "@/features/qr/qr";
import { buildBusinessCardData } from "./data";
import { CARD_HEIGHT, CARD_WIDTH, drawBusinessCard } from "./draw";
import { TEST_SETTINGS } from "./fixtures";

vi.mock("server-only", () => ({}));
vi.stubGlobal("Path2D", Path2D); // the browser provides Path2D globally

const FAMILY = "sans-serif";
const SITE = "https://shop.test-traders.example";

function render(
  settings = TEST_SETTINGS,
  over: { categoryNames?: string[]; siteUrl?: string | null } = {},
  scale = 3,
) {
  const data = buildBusinessCardData({
    settings,
    categoryNames: over.categoryNames ?? ["Cement", "Steel Bars & Rods", "Bricks and Blocks"],
    siteUrl: over.siteUrl === undefined ? SITE : over.siteUrl,
    makeQr: qrMatrix,
  });
  const canvas = createCanvas(CARD_WIDTH * scale, CARD_HEIGHT * scale);
  drawBusinessCard(canvas.getContext("2d") as unknown as CanvasRenderingContext2D, data, {
    scale,
    fontFamily: FAMILY,
  });
  return { data, png: canvas.toBuffer("image/png") };
}

const save = (name: string, png: Buffer) => {
  const dir = process.env.CARD_PREVIEW_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), png);
};

describe("business card rendered to a real PNG", () => {
  it("produces a valid 1920×1320 PNG whose pixels are not blank", () => {
    const { png } = render();
    save("card-full.png", png);
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const img = PNG.sync.read(png);
    expect([img.width, img.height]).toEqual([1920, 1320]);
    const colours = new Set<string>();
    for (let i = 0; i < img.data.length; i += 4 * 997)
      colours.add(`${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}`);
    expect(colours.size).toBeGreaterThan(4);
  });

  it("uses the approved brand colours (navy strip 4/5, amber strip 1/5, navy footer band, white body)", () => {
    const img = PNG.sync.read(render().png);
    const px = (x: number, y: number) => {
      const i = (y * img.width + x) * 4;
      return [img.data[i], img.data[i + 1], img.data[i + 2]];
    };
    expect(px(300, 15)).toEqual([0x17, 0x36, 0x5d]); // navy strip
    expect(px(1800, 15)).toEqual([0xf5, 0xa6, 0x23]); // amber strip
    expect(px(30, 1300)).toEqual([0x17, 0x36, 0x5d]); // footer band
    expect(px(60, 700)).toEqual([0xff, 0xff, 0xff]); // white body
    expect(px(2, 2)).toEqual([0xff, 0xff, 0xff]); // corners are white, not transparent
  });

  it("the QR code in the downloaded image decodes to the configured public site URL", () => {
    const { png } = render();
    const img = PNG.sync.read(png);
    const result = jsQR(new Uint8ClampedArray(img.data), img.width, img.height);
    expect(result?.data).toBe(SITE);
  });

  it("the QR code is still readable at preview size on a 2× screen", () => {
    const { png } = render(TEST_SETTINGS, {}, 2);
    const img = PNG.sync.read(png);
    expect(jsQR(new Uint8ClampedArray(img.data), img.width, img.height)?.data).toBe(SITE);
  });

  it("draws no QR when the public URL is not a valid production URL", () => {
    for (const siteUrl of [null, "http://localhost:3000", "http://shop.example", "not a url"]) {
      const { png, data } = render(TEST_SETTINGS, { siteUrl });
      expect(data.qr).toBeNull();
      const img = PNG.sync.read(png);
      expect(jsQR(new Uint8ClampedArray(img.data), img.width, img.height)).toBeNull();
    }
  });

  it("renders with sparse settings (only a name and one phone) without errors", () => {
    const { png } = render(
      {
        ...TEST_SETTINGS,
        tagline: null,
        whatsappNumber: null,
        email: null,
        address: null,
        businessHours: null,
        gstNumber: null,
      },
      { categoryNames: [], siteUrl: null },
    );
    save("card-sparse.png", png);
    expect(PNG.sync.read(png).width).toBe(1920);
  });

  it("renders long values (long email, long address, long categories) without throwing", () => {
    const { png } = render(
      {
        ...TEST_SETTINGS,
        name: "A Very Long Business Name For Building Materials And Hardware Trading Company Private",
        tagline: "x ".repeat(120),
        email: `${"averyveryverylongmailboxname".repeat(3)}@a-very-long-domain-name-for-testing.example`,
        address: "Plot 1 ".repeat(30),
      },
      {
        categoryNames: Array.from(
          { length: 12 },
          (_, i) => `Category number ${i} with a long name`,
        ),
      },
    );
    save("card-long.png", png);
    expect(PNG.sync.read(png).height).toBe(1320);
  });
});
