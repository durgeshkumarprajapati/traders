import { act } from "react";
import { cleanup, render } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { sampleCard, TEST_SETTINGS } from "@/features/business-card/fixtures";
import { CallButton } from "@/components/website/contact-actions";
import { ContactDetails } from "@/components/website/contact-details";
import { SiteHeader } from "@/components/website/site-header";
import { BusinessCallLink } from "./business-call-link";
import { BusinessCardPanel } from "./business-card-panel";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

let errors: unknown[][];
beforeEach(() => {
  errors = [];
  vi.spyOn(console, "error").mockImplementation((...args) => void errors.push(args));
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never; // jsdom has no canvas
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const messages = () => errors.map((e) => String(e[0])).join("\n");

describe("no React warnings from the call actions", () => {
  it("never forwards a non-DOM prop (e.g. businessName) to an <a>", () => {
    render(
      <>
        <SiteHeader settings={TEST_SETTINGS} />
        <ContactDetails settings={TEST_SETTINGS} />
        <CallButton phone={TEST_SETTINGS.phone}>Call</CallButton>
        <BusinessCallLink phone={TEST_SETTINGS.phone} businessName="Test" />
      </>,
    );
    expect(messages()).not.toMatch(/does not recognize|unknown prop|Unknown event handler/i);
    expect(errors).toEqual([]);
  });
});

describe("visiting card hydration", () => {
  it("the server HTML and the first client render are identical (no hydration error)", async () => {
    const data = sampleCard();
    const html = renderToString(<BusinessCardPanel data={data} />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, <BusinessCardPanel data={data} />, {
        onRecoverableError: (e) => errors.push([`recoverable: ${String(e)}`]),
      });
    });
    expect(messages()).not.toMatch(/hydrat|did not match|recoverable/i);
    expect(errors).toEqual([]);
    act(() => root.unmount());
    container.remove();
  });

  it("the server markup is deterministic: one aspect ratio, in classes only, no inline style, no feedback region", () => {
    const html = renderToString(<BusinessCardPanel data={sampleCard()} />);
    const canvas = /<canvas[^>]*>/.exec(html)?.[0] ?? "";
    expect(canvas).toContain("aspect-[16/11]");
    expect(canvas).not.toContain("style=");
    expect(canvas).not.toMatch(/1050|600/);
    expect(html).not.toContain('role="status"');
    expect(renderToString(<BusinessCardPanel data={sampleCard()} />)).toBe(html); // same input → same output
  });

  it("renders the same markup for the server and for a client-only render", () => {
    const data = sampleCard();
    const server = renderToString(<BusinessCardPanel data={data} />);
    const { container } = render(<BusinessCardPanel data={data} />);
    const normalise = (s: string) => s.replace(/\s+/g, " ").replace(/ data-[a-z-]+="[^"]*"/g, "");
    expect(normalise(container.innerHTML)).toBe(normalise(server));
  });
});
