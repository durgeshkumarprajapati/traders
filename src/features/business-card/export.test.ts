import { sampleCard } from "./fixtures";
import {
  CardExportError,
  EXPORT_SCALE,
  canShareImageFiles,
  downloadBlob,
  ensureFonts,
  loadLogo,
  renderCardPng,
  shareCardFile,
} from "./export";

function fakeCtx() {
  const calls: Array<[string, unknown[]]> = [];
  const ctx = new Proxy(
    { measureText: (t: string) => ({ width: t.length * 10 }), canvas: null },
    {
      get: (target, prop: string) =>
        prop in target
          ? (target as Record<string, unknown>)[prop]
          : (...args: unknown[]) => void calls.push([prop, args]),
      set: () => true,
    },
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

function fakeCanvas(opts: { blob?: Blob | null; ctx?: boolean } = {}) {
  const { ctx, calls } = fakeCtx();
  const sizes: number[] = [];
  const canvas = {
    set width(v: number) {
      sizes[0] = v;
    },
    set height(v: number) {
      sizes[1] = v;
    },
    getContext: () => (opts.ctx === false ? null : ctx),
    toBlob: (cb: (b: Blob | null) => void) =>
      cb(opts.blob === undefined ? new Blob(["png-bytes"], { type: "image/png" }) : opts.blob),
  } as unknown as HTMLCanvasElement;
  return { canvas, calls, sizes };
}

function stubImage(outcome: "load" | "error") {
  class FakeImage {
    crossOrigin = "";
    naturalWidth = outcome === "load" ? 200 : 0;
    naturalHeight = outcome === "load" ? 100 : 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      queueMicrotask(() => (outcome === "load" ? this.onload?.() : this.onerror?.()));
    }
  }
  vi.stubGlobal("Image", FakeImage);
}

afterEach(() => vi.unstubAllGlobals());

describe("renderCardPng", () => {
  it("draws the card at export resolution and returns a PNG blob", async () => {
    const f = fakeCanvas();
    let size: [number, number] = [0, 0];
    const blob = await renderCardPng(sampleCard(), {
      createCanvas: (w, h) => ((size = [w, h]), f.canvas),
    });
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
    expect(size).toEqual([640 * EXPORT_SCALE, 440 * EXPORT_SCALE]);
    const texts = f.calls.filter(([n]) => n === "fillText").map(([, a]) => String(a[0]));
    expect(texts).toEqual(
      expect.arrayContaining([
        "Test Hardware & Traders",
        "+91 11111 22222",
        "desk@test-traders.example",
      ]),
    );
  });

  it("draws only configured fields: nothing for a missing email/address/hours/GSTIN", async () => {
    const f = fakeCanvas();
    await renderCardPng(
      sampleCard(
        { email: null, address: null, businessHours: null, gstNumber: null, whatsappNumber: null },
        { categoryNames: [] },
      ),
      { createCanvas: () => f.canvas },
    );
    const texts = f.calls.filter(([n]) => n === "fillText").map(([, a]) => String(a[0]));
    for (const label of ["Email", "Address", "WhatsApp", "Phone & WhatsApp"])
      expect(texts).not.toContain(label);
    expect(texts.some((t) => t.startsWith("GSTIN"))).toBe(false);
    expect(texts).toContain("Phone");
    expect(texts).toContain("Digital Visiting Card");
    expect(texts).not.toContain("•"); // no categories → no category strip
  });

  it("fails clearly when the PNG cannot be encoded or the canvas is unavailable", async () => {
    await expect(
      renderCardPng(sampleCard(), { createCanvas: () => fakeCanvas({ blob: null }).canvas }),
    ).rejects.toMatchObject({
      code: "ENCODE_FAILED",
    });
    await expect(
      renderCardPng(sampleCard(), {
        createCanvas: () => fakeCanvas({ blob: new Blob([], { type: "image/png" }) }).canvas,
      }),
    ).rejects.toBeInstanceOf(CardExportError);
    await expect(
      renderCardPng(sampleCard(), { createCanvas: () => fakeCanvas({ ctx: false }).canvas }),
    ).rejects.toMatchObject({
      code: "NO_CANVAS",
    });
    await expect(
      renderCardPng(sampleCard(), {
        createCanvas: () => fakeCanvas({ blob: new Blob(["x"], { type: "image/jpeg" }) }).canvas,
      }),
    ).rejects.toMatchObject({ code: "ENCODE_FAILED" });
  });

  it("still renders when fonts fail to load (fallback font) and when the logo cannot be fetched", async () => {
    stubImage("error"); // the logo host is unreachable
    const original = Object.getOwnPropertyDescriptor(document, "fonts");
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { load: () => Promise.reject(new Error("font")) },
    });
    try {
      const blob = await renderCardPng(
        sampleCard({ logoUrl: "https://res.cloudinary.com/x/logo.png" }),
        {
          createCanvas: () => fakeCanvas().canvas,
        },
      );
      expect(blob.type).toBe("image/png");
    } finally {
      if (original) Object.defineProperty(document, "fonts", original);
      else delete (document as unknown as { fonts?: unknown }).fonts;
    }
  });
});

describe("ensureFonts", () => {
  it("reports false (never throws) without the Font Loading API or when loading rejects", async () => {
    expect(await ensureFonts("Inter")).toBe(false);
    const doc = { fonts: { load: () => Promise.reject(new Error("x")) } } as unknown as Document;
    expect(await ensureFonts("Inter", doc)).toBe(false);
  });
  it("reports true when every weight loads", async () => {
    const load = vi.fn(async () => []);
    expect(await ensureFonts("Inter", { fonts: { load } } as unknown as Document)).toBe(true);
    expect(load).toHaveBeenCalledTimes(5);
  });
});

describe("loadLogo", () => {
  it("loads a CORS-enabled https logo, requesting it anonymously so the canvas stays exportable", async () => {
    stubImage("load");
    const logo = await loadLogo("https://res.cloudinary.com/x/logo.png");
    expect(logo).toMatchObject({ width: 200, height: 100 });
  });
  it("returns null when the logo fails to load (the built-in mark is drawn instead)", async () => {
    stubImage("error");
    expect(await loadLogo("https://res.cloudinary.com/x/logo.png")).toBeNull();
  });
  it("returns null for missing or non-https URLs without touching the network", async () => {
    expect(await loadLogo(null)).toBeNull();
    expect(await loadLogo("http://x.test/logo.png")).toBeNull();
    expect(await loadLogo("data:image/png;base64,AAAA")).toBeNull();
  });
});

describe("downloadBlob", () => {
  it("clicks a hidden download link with the filename and releases the object URL later", () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:test-url");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    downloadBlob(new Blob(["x"], { type: "image/png" }), "sagar-traders-business-card.png");
    const anchorCall = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchorCall.download).toBe("sagar-traders-business-card.png");
    expect(anchorCall.getAttribute("href")).toBe("blob:test-url");
    expect(document.querySelector("a[download]")).toBeNull(); // removed again
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(revoke).toHaveBeenCalledWith("blob:test-url");
    click.mockRestore();
    vi.useRealTimers();
  });
});

describe("native sharing", () => {
  const blob = new Blob(["x"], { type: "image/png" });
  it("is unsupported when the browser cannot share files", async () => {
    expect(canShareImageFiles({} as Navigator)).toBe(false);
    expect(
      await shareCardFile(blob, "c.png", "t", { share: () => undefined } as unknown as Navigator),
    ).toBe("unsupported");
    expect(
      canShareImageFiles({ share: () => undefined, canShare: () => false } as unknown as Navigator),
    ).toBe(false);
  });
  it("shares the PNG file, and distinguishes cancel from failure", async () => {
    const share = vi.fn(async () => undefined);
    const nav = { share, canShare: () => true } as unknown as Navigator;
    expect(canShareImageFiles(nav)).toBe(true);
    expect(await shareCardFile(blob, "c.png", "Card", nav)).toBe("shared");
    const sent = (share.mock.calls[0] as unknown as [{ files: File[] }])[0];
    expect(sent.files[0].name).toBe("c.png");
    expect(sent.files[0].type).toBe("image/png");
    const abort = {
      share: async () => {
        throw new DOMException("x", "AbortError");
      },
      canShare: () => true,
    } as unknown as Navigator;
    expect(await shareCardFile(blob, "c.png", "t", abort)).toBe("cancelled");
    const broken = {
      share: async () => {
        throw new Error("boom");
      },
      canShare: () => true,
    } as unknown as Navigator;
    expect(await shareCardFile(blob, "c.png", "t", broken)).toBe("failed");
  });
});
