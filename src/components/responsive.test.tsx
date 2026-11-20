import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { MobileNav } from "@/components/website/mobile-nav";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/products",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

/**
 * Responsive behaviour that can be verified without a browser: interaction/ARIA contracts of the
 * mobile navigation drawers, the stacked-table markup, and source-level layout guards (jsdom does not
 * evaluate CSS, so layout *rendering* is NOT covered here — see docs/FINAL_RESPONSIVE_AUDIT_REPORT.md).
 */
describe("admin mobile navigation", () => {
  it("exposes an accessible menu button that opens a labelled drawer and reflects state in ARIA", () => {
    render(<AdminMobileNav footer={<button>Sign Out</button>} />);
    const btn = screen.getByRole("button", { name: "Open admin menu" });
    expect(btn).toHaveAttribute("aria-haspopup", "dialog");
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    const dialog = document.querySelector("dialog")!;
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAccessibleName("Admin menu");
    const nav = within(dialog).getByRole("navigation", { name: "Admin mobile" });
    for (const label of ["Dashboard", "Products", "Categories & Brands", "Enquiries", "Settings"])
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
  });

  it("marks the active route and closes after a link is chosen", () => {
    render(<AdminMobileNav />);
    fireEvent.click(screen.getByRole("button", { name: "Open admin menu" }));
    const dialog = document.querySelector("dialog")!;
    expect(within(dialog).getByRole("link", { name: "Products" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    fireEvent.click(within(dialog).getByRole("link", { name: "Settings" }));
    expect(dialog).not.toHaveAttribute("open");
  });

  it("closes on the dialog close event (Escape) and via the Close button", () => {
    render(<AdminMobileNav />);
    const open = () => fireEvent.click(screen.getByRole("button", { name: "Open admin menu" }));
    open();
    const dialog = document.querySelector("dialog")!;
    fireEvent(dialog, new Event("close")); // what the platform fires on Escape
    expect(dialog).not.toHaveAttribute("open");
    open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(dialog).not.toHaveAttribute("open");
  });

  it("is only shown below lg (the desktop sidebar takes over from lg)", () => {
    const { container } = render(<AdminMobileNav />);
    expect(container.firstElementChild).toHaveClass("lg:hidden");
  });
});

describe("customer mobile navigation", () => {
  it("offers Quick Quote at the top of the drawer and closes after navigating", () => {
    render(<MobileNav actions={<a href="tel:100">Call us</a>} />);
    const btn = screen.getByRole("button", { name: "Open menu" });
    expect(btn).toHaveClass("md:hidden");
    fireEvent.click(btn);
    const dialog = document.querySelector("dialog")!;
    const quote = within(dialog).getByRole("link", { name: "Get a quick quote" });
    expect(quote).toHaveAttribute("href", "/bulk-enquiry");
    expect(within(dialog).getByRole("link", { name: "Call us" })).toBeInTheDocument();
    fireEvent.click(quote);
    expect(dialog).not.toHaveAttribute("open");
  });
});

describe("stacked table", () => {
  const render2 = (stacked: boolean) =>
    render(
      <Table stacked={stacked}>
        <THead>
          <Tr>
            <Th>Name</Th>
            <Th>Rate</Th>
          </Tr>
        </THead>
        <TBody>
          <Tr>
            <Td label="Name">Cement</Td>
            <Td label="Rate">₹ 400</Td>
          </Tr>
        </TBody>
      </Table>,
    );

  it("labels every value and keeps table semantics when displayed as cards", () => {
    render2(true);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    const cell = screen.getByRole("cell", { name: "Cement" });
    expect(cell).toHaveAttribute("data-label", "Name");
    expect(cell.className).toMatch(/max-md:block/);
    expect(screen.getByRole("cell", { name: "₹ 400" })).toHaveAttribute("data-label", "Rate");
  });

  it("keeps headers available to assistive tech (visually hidden, not removed) on phones", () => {
    const { container } = render2(true);
    expect(container.querySelector("thead")!.className).toMatch(/max-md:sr-only/);
  });

  it("non-stacked tables are unchanged and scroll inside their own wrapper", () => {
    const { container } = render2(false);
    expect(container.firstElementChild).toHaveClass("overflow-x-auto");
    expect(container.querySelector("td")!.className).not.toMatch(/max-md:/);
    expect(container.querySelector("table")).not.toHaveAttribute("role");
  });
});

describe("modal sizing", () => {
  it("fits the viewport and scrolls its own content", () => {
    render(
      <Modal open onClose={() => {}} title="Long dialog">
        body
      </Modal>,
    );
    const cls = document.querySelector("dialog")!.className;
    expect(cls).toMatch(/max-h-\[calc\(100dvh-2rem\)\]/);
    expect(cls).toMatch(/w-\[calc\(100%-2rem\)\]/);
    expect(cls).toMatch(/overflow-y-auto/);
  });
});

describe("source-level layout guards", () => {
  const SRC = join(process.cwd(), "src");
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((n) =>
      statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)],
    );
  const ui = walk(SRC)
    .filter((f) => /\.tsx$/.test(f) && !/\.test\.tsx$/.test(f))
    .filter((f) => !relative(SRC, f).split(sep).join("/").startsWith("app/dev/"));
  const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

  it("no component hard-codes a width wider than a 320px phone (w-[NNNpx] / min-w-[NNNpx])", () => {
    const offenders = ui.flatMap((f) => {
      const hits = [...readFileSync(f, "utf8").matchAll(/\b(?:min-)?w-\[(\d+)px\]/g)]
        .map((m) => Number(m[1]))
        .filter((n) => n > 300);
      return hits.length ? [relative(SRC, f)] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("admin console: the sidebar is desktop-only, main can shrink (min-w-0) and gutters are 16px on phones", () => {
    const layout = read("app/admin/(console)/layout.tsx");
    expect(layout).toMatch(/min-w-0 flex-1/);
    expect(layout).toMatch(/p-gutter-md[^"]*sm:p-page-margin/);
    expect(read("components/admin/admin-sidebar.tsx")).toMatch(/hidden w-sidebar[^"]*lg:flex/);
  });

  it("toasts stay inside the viewport on narrow screens", () => {
    const toast = read("components/ui/notification.tsx");
    expect(toast).toMatch(/left-gutter-md/);
    expect(toast).toMatch(/right-gutter-md/);
    expect(toast).not.toMatch(/fixed[^"]*\bw-full\b/);
  });

  it("controls reach 44px on touch devices without changing desktop sizes", () => {
    const button = read("components/ui/button.tsx");
    expect(button).toMatch(/sm: "h-8 px-3 pointer-coarse:h-11"/);
    expect(button).toMatch(/md: "h-10 px-4 pointer-coarse:h-11"/);
    expect(button).toMatch(/icon: "size-10 p-0 pointer-coarse:size-11"/);
    const fc = read("components/ui/form-controls.tsx");
    expect(fc).toMatch(/text-body-lg md:text-body-md/); // 16px on phones: no iOS focus-zoom
    expect(fc).toMatch(/pointer-coarse:h-11/);
  });

  it("global CSS locks page scroll behind an open dialog and wraps long words", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/html:has\(dialog\[open\]\)\s*\{\s*overflow:\s*hidden/);
    expect(css).toMatch(/overflow-wrap:\s*break-word/);
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  it("the header can shrink on phones: brand block is shrinkable, tagline hidden on phones, Quick Quote joins the bar from 400px", () => {
    const h = read("components/website/site-header.tsx");
    expect(h).toMatch(/group flex min-w-0 items-center/);
    expect(h).toMatch(/hidden truncate[^"]*sm:block/);
    expect(h).toMatch(/hidden h-10[^"]*min-\[400px\]:inline-flex/); // Quick Quote: bar from 400px, drawer below
  });
});

describe("final-pass guards", () => {
  const SRC2 = join(process.cwd(), "src");
  const walk2 = (d: string): string[] =>
    readdirSync(d).flatMap((n) =>
      statSync(join(d, n)).isDirectory() ? walk2(join(d, n)) : [join(d, n)],
    );
  const files = walk2(SRC2).filter(
    (f) =>
      /\.tsx$/.test(f) &&
      !/\.test\.tsx$/.test(f) &&
      !relative(SRC2, f).split(sep).join("/").startsWith("app/dev/"),
  );

  it("every grid that defines columns at a breakpoint also defines a mobile base (grid-cols-1), so long content cannot widen the implicit column", () => {
    const offenders: string[] = [];
    for (const f of files)
      for (const m of readFileSync(f, "utf8").matchAll(/className="([^"]*)"/g)) {
        const toks = m[1].split(/\s+/);
        if (
          toks.includes("grid") &&
          toks.some((t) => /^(sm|md|lg|xl|min-\[[^\]]+\]):grid-cols-/.test(t)) &&
          !toks.some((t) => /^grid-cols-/.test(t))
        )
          offenders.push(`${relative(SRC2, f)}: ${m[1]}`);
      }
    expect(offenders).toEqual([]);
  });

  it("footer phone and email are tappable links built only from configured settings", async () => {
    const { SiteFooter } = await import("@/components/website/site-footer");
    const { emptyBusinessSettings } = await import("@/features/settings/business-settings");
    const settings = { ...emptyBusinessSettings(), phone: "+91 99999 00000", email: "a@b.test" };
    render(<SiteFooter settings={settings} categories={[]} />);
    expect(screen.getByRole("link", { name: "+91 99999 00000" })).toHaveAttribute(
      "href",
      "tel:+919999900000",
    );
    expect(screen.getByRole("link", { name: "a@b.test" })).toHaveAttribute(
      "href",
      "mailto:a@b.test",
    );
  });

  it("footer renders no phone/email link when none is configured (nothing invented)", async () => {
    const { SiteFooter } = await import("@/components/website/site-footer");
    const { emptyBusinessSettings } = await import("@/features/settings/business-settings");
    const { container } = render(<SiteFooter settings={emptyBusinessSettings()} categories={[]} />);
    expect(container.querySelector('a[href^="tel:"], a[href^="mailto:"]')).toBeNull();
  });

  it("the admin sign-in email field asks mobile keyboards for an email layout without auto-capitalising", async () => {
    const { LoginForm } = await import("@/components/admin/login-form");
    render(<LoginForm />);
    const email = screen.getByLabelText(/email address/i);
    expect(email).toHaveAttribute("inputmode", "email");
    expect(email).toHaveAttribute("autocapitalize", "none");
    expect(email).toHaveAttribute("autocomplete", "email");
  });
});
