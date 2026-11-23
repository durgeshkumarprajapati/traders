import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OfflineBanner, PwaInstallPrompt } from "./pwa-components";

const DISMISS_KEY = "sagar-pwa-install-dismissed-at";

function setOnline(value: boolean) {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(value);
}
function fireInstallPrompt(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return { prompt, event };
}
function setUserAgent(ua: string) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(ua);
}
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  delete (window as unknown as { caches?: unknown }).caches;
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

describe("OfflineBanner", () => {
  it("is invisible while online", () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("offline: says it is a saved copy, that prices/availability may be outdated, and that enquiries need a connection", () => {
    setOnline(false);
    render(<OfflineBanner />);
    const s = screen.getByRole("status");
    expect(s).toHaveTextContent(/offline/i);
    expect(s).toHaveTextContent(/saved copy/i);
    expect(s).toHaveTextContent(/Prices and availability may be out of date/i);
    expect(s).toHaveTextContent(/Enquiries can only be sent when you are online/i);
  });

  it("shows WHEN the saved copy was stored, read from the service worker's timestamp header", async () => {
    setOnline(false);
    (window as unknown as { caches: unknown }).caches = {
      match: async () =>
        new Response("x", { headers: { "x-sw-cached-at": "2026-11-20T08:30:00.000Z" } }),
    };
    render(<OfflineBanner />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/from 20 Nov 2026/));
  });

  it("reacts to the connection coming back", () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("PwaInstallPrompt", () => {
  it("shows nothing until the browser offers installation (and nothing in unsupported browsers)", () => {
    render(<PwaInstallPrompt />);
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("Chromium: offers Install on the browser's event, calls the native prompt only on click, and then hides", async () => {
    render(<PwaInstallPrompt />);
    const { prompt, event } = fireInstallPrompt("accepted");
    expect(event.defaultPrevented).toBe(true); // the page controls when the prompt appears
    const btn = await screen.findByRole("button", { name: /Install/ });
    expect(prompt).not.toHaveBeenCalled(); // no automatic prompt
    fireEvent.click(btn);
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("complementary")).toBeNull());
  });

  it("does not claim the app is installed anywhere in its text", async () => {
    render(<PwaInstallPrompt />);
    fireInstallPrompt();
    await screen.findByRole("complementary");
    expect(document.body.textContent).not.toMatch(
      /(is|been|now) installed|successfully installed/i,
    );
  });

  it("dismissing hides it and remembers for 30 days — it does not reappear on the next visit", async () => {
    const first = render(<PwaInstallPrompt />);
    fireInstallPrompt();
    fireEvent.click(await screen.findByRole("button", { name: /Dismiss install suggestion/ }));
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(Number(localStorage.getItem(DISMISS_KEY))).toBeGreaterThan(Date.now() - 5000);
    first.unmount();
    render(<PwaInstallPrompt />);
    fireInstallPrompt();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("shows again after the 30-day quiet period", async () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() - 31 * 86_400_000));
    render(<PwaInstallPrompt />);
    fireInstallPrompt();
    expect(await screen.findByRole("complementary")).toBeInTheDocument();
  });

  it("is never shown inside an installed app (standalone display mode)", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (q: string) => ({
        matches: q.includes("standalone"),
        media: q,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    render(<PwaInstallPrompt />);
    fireInstallPrompt();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("the browser's appinstalled event hides it", async () => {
    render(<PwaInstallPrompt />);
    fireInstallPrompt();
    await screen.findByRole("complementary");
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("iOS Safari has no install API: shows the manual Add to Home Screen steps instead", async () => {
    setUserAgent(IPHONE_SAFARI);
    render(<PwaInstallPrompt />);
    const aside = await screen.findByRole("complementary");
    expect(aside).toHaveTextContent(/Share/);
    expect(aside).toHaveTextContent(/Add to Home Screen/);
    expect(screen.queryByRole("button", { name: /^Install/ })).toBeNull();
  });

  it("iOS in-app browsers (Chrome/Firefox on iOS) get no iOS-Safari instructions", () => {
    setUserAgent(IPHONE_SAFARI.replace("Version/17.0", "CriOS/120.0"));
    render(<PwaInstallPrompt />);
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("the dismiss control is a real, labelled button with a touch-size target", async () => {
    render(<PwaInstallPrompt />);
    fireInstallPrompt();
    const dismiss = await screen.findByRole("button", { name: /Dismiss install suggestion/ });
    expect(dismiss.className).toMatch(/size-11/);
  });
});
