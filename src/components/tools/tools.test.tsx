import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { EnquiryCatalogueItem } from "@/features/enquiries/types";
import { ENQUIRY_LIST_KEY, enquiryList } from "@/features/enquiries/enquiry-list-store";
import { PREFILL_KEY } from "@/features/material-lists/handoff";
import { materialStore } from "@/features/material-lists/store";
import { PRICE_DISCLAIMER } from "@/features/products/format";
import { STORAGE_KEY } from "@/features/material-lists/types";
import { MaterialCalculator } from "./calculator";
import { MaterialCollection } from "./material-collection";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
const server = vi.hoisted(() => ({ resolveMaterialItemsAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, usePathname: () => "/tools" }));
vi.mock("@/features/material-lists/actions", () => server);

const cat = (
  id: string,
  name: string,
  unitLabel: string,
  brandName: string | null = null,
): EnquiryCatalogueItem => ({
  id,
  slug: id,
  name,
  brandName,
  sku: null,
  unitLabel,
  stockStatus: "IN_STOCK",
  rate: null,
});
const CATALOGUE = [
  cat("p-cement", "Cement PPC 50 kg", "Bag", "Brand A"),
  cat("p-tmt", "TMT 12 mm", "Metric Ton"),
  cat("p-sand", "River sand", "Cubic Feet"),
];
const live = (name: string, rate: string | null = "₹385.00 / Bag") => ({
  name,
  brandName: null,
  unitLabel: "Bag",
  rate,
  stockStatus: "IN_STOCK" as const,
  updatedAt: null,
  slug: "x",
});

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const dialog = () => document.querySelector("dialog[open]") as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  nav.push.mockReset();
  server.resolveMaterialItemsAction
    .mockReset()
    .mockResolvedValue({ ok: true, source: "LIVE", products: {} });
  act(() => {
    materialStore._reset();
    enquiryList._reset();
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MaterialCalculator", () => {
  it("concrete: converts feet and shows the volume, the formula steps and the estimate disclaimer", () => {
    render(<MaterialCalculator catalogue={CATALOGUE} />);
    type(/^Length/, "10");
    type(/^Width/, "10");
    type(/^Depth or thickness/, "0.5");
    fireEvent.click(screen.getByRole("button", { name: /Calculate volume/ }));
    expect(screen.getByText("1.416 m³")).toBeInTheDocument();
    expect(screen.getByText("50 ft³")).toBeInTheDocument();
    expect(screen.getByText(/Volume = length × width × depth/)).toBeInTheDocument();
    expect(
      screen.getAllByText(/approximate planning estimates, not an engineering specification/i)
        .length,
    ).toBeGreaterThan(0);
  });

  it("validation: an empty form shows what is missing and no result", () => {
    render(<MaterialCalculator catalogue={CATALOGUE} />);
    fireEvent.click(screen.getByRole("button", { name: /Calculate volume/ }));
    expect(screen.getByText("Please check the highlighted fields")).toBeInTheDocument();
    expect(screen.getByText("Length is required.")).toBeInTheDocument();
    expect(screen.queryByText("Estimate")).toBeNull();
  });

  it.each([["0"], ["-2"], ["abc"], ["5000"]])("rejects the dimension %j", (bad) => {
    render(<MaterialCalculator catalogue={CATALOGUE} />);
    type(/^Length/, bad);
    type(/^Width/, "4");
    type(/^Depth or thickness/, "0.2");
    fireEvent.change(screen.getByLabelText(/Measurement unit/), { target: { value: "m" } });
    fireEvent.click(screen.getByRole("button", { name: /Calculate volume/ }));
    expect(screen.queryByText("Estimate")).toBeNull();
    expect(screen.getByText("Please check the highlighted fields")).toBeInTheDocument();
  });

  function fillMix() {
    fireEvent.click(screen.getByRole("tab", { name: /Cement, sand/ }));
    fireEvent.change(screen.getByLabelText(/Measurement unit/), { target: { value: "m" } });
    type(/^Length/, "5");
    type(/^Width/, "4");
    type(/^Depth or thickness/, "0.15");
    type(/^Mix ratio/, "1:2:4");
    fireEvent.click(screen.getByRole("button", { name: /Calculate materials/ }));
  }

  it("mix: shows exact, with-wastage and rounded-up purchase quantities separately (19.008 → 19.958 → 20 bags)", () => {
    render(<MaterialCalculator catalogue={CATALOGUE} />);
    fillMix();
    const table = screen.getByRole("table");
    const cement = within(table).getByText("Cement").closest("tr")!;
    expect(cement.textContent).toContain("19.008 bags (50 kg)");
    expect(cement.textContent).toContain("19.958 bags (50 kg)");
    expect(cement.textContent).toContain("20 bags (50 kg)");
    expect(screen.getByText(/Assumptions used/)).toBeInTheDocument();
    expect(screen.getByText(/Dry-volume factor 1.54/)).toBeInTheDocument();
  });

  it("mix: a mix ratio is required (never assumed)", () => {
    render(<MaterialCalculator catalogue={CATALOGUE} />);
    fireEvent.click(screen.getByRole("tab", { name: /Cement, sand/ }));
    fireEvent.change(screen.getByLabelText(/Measurement unit/), { target: { value: "m" } });
    type(/^Length/, "5");
    type(/^Width/, "4");
    type(/^Depth or thickness/, "0.15");
    fireEvent.click(screen.getByRole("button", { name: /Calculate materials/ }));
    expect(screen.getAllByText("Choose a mix ratio.").length).toBeGreaterThan(0);
  });

  it("Add to enquiry list: catalogue lines go to the enquiry list (id + quantity), the rest become labelled text; nothing is submitted", () => {
    render(<MaterialCalculator catalogue={CATALOGUE} />);
    fillMix();
    fireEvent.change(screen.getByLabelText("Product for Cement"), {
      target: { value: "p-cement" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Add to enquiry list/ }));
    expect(JSON.parse(localStorage.getItem(ENQUIRY_LIST_KEY)!)).toEqual([
      { productId: "p-cement", quantity: 20 },
    ]);
    const prefill = JSON.parse(sessionStorage.getItem(PREFILL_KEY)!).message as string;
    expect(prefill).toContain("not matched to catalogue products");
    expect(prefill).toContain("- Sand: 49 cubic feet");
    expect(prefill).toContain("- Aggregate: 98 cubic feet");
    expect(nav.push).toHaveBeenCalledWith("/bulk-enquiry");
  });

  it("the customer can change the suggested quantity before adding it", () => {
    render(<MaterialCalculator catalogue={CATALOGUE} />);
    fillMix();
    fireEvent.change(screen.getByLabelText("Product for Cement"), {
      target: { value: "p-cement" },
    });
    fireEvent.change(screen.getByLabelText(/Quantity \(Bag\)/), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /Add to enquiry list/ }));
    expect(JSON.parse(localStorage.getItem(ENQUIRY_LIST_KEY)!)[0].quantity).toBe(25);
  });

  it("an invalid quantity blocks the hand-off with a message", () => {
    render(<MaterialCalculator catalogue={CATALOGUE} />);
    fillMix();
    fireEvent.change(screen.getByLabelText(/Quantity \(bags/), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Add to enquiry list/ }));
    expect(screen.getByText(/Enter a quantity greater than zero for “Cement”/)).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("warns — and does not convert — when the product's unit differs from the calculated unit", () => {
    render(<MaterialCalculator catalogue={CATALOGUE} />);
    fillMix();
    fireEvent.change(screen.getByLabelText("Product for Cement"), { target: { value: "p-tmt" } });
    expect(screen.getByRole("note")).toHaveTextContent(
      /Calculated in bags \(50 kg\), but this product is sold per Metric Ton\. Nothing is converted/,
    );
    fireEvent.change(screen.getByLabelText("Product for Cement"), {
      target: { value: "p-cement" },
    });
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("Save to a material list stores items on this device and links to the lists", () => {
    render(<MaterialCalculator catalogue={CATALOGUE} />);
    fillMix();
    fireEvent.change(screen.getByLabelText("Product for Cement"), {
      target: { value: "p-cement" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save to a material list/ }));
    expect(screen.getByText(/Saved to your material list/)).toBeInTheDocument();
    const lists = JSON.parse(localStorage.getItem(STORAGE_KEY)!).lists;
    expect(lists).toHaveLength(1);
    expect(lists[0].items.map((i: { name: string; source: string }) => [i.name, i.source])).toEqual(
      [
        ["Cement PPC 50 kg", "ESTIMATED"],
        ["Sand", "ESTIMATED"],
        ["Aggregate", "ESTIMATED"],
      ],
    );
  });

  it("works without a catalogue: lines are added as custom requirements", () => {
    render(
      <MaterialCalculator
        catalogue={[]}
        catalogueNote="The product list is unavailable right now."
      />,
    );
    expect(screen.getByText(/product list is unavailable/i)).toBeInTheDocument();
    fillMix();
    fireEvent.click(screen.getByRole("button", { name: /Add to enquiry list/ }));
    expect(localStorage.getItem(ENQUIRY_LIST_KEY)).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(PREFILL_KEY)!).message).toContain(
      "- Cement: 20 bags (50 kg)",
    );
  });

  it("bricks: a size must be chosen or typed (never assumed), then 3,381 pieces with 5% wastage", () => {
    render(<MaterialCalculator catalogue={CATALOGUE} />);
    fireEvent.click(screen.getByRole("tab", { name: /Bricks & blocks/ }));
    fireEvent.change(screen.getByLabelText(/Wall measurement unit/), { target: { value: "m" } });
    type(/^Wall length/, "10");
    type(/^Wall height/, "3");
    type(/^Wall thickness/, "0.23");
    type(/^Openings area/, "2");
    fireEvent.click(screen.getByRole("button", { name: /Calculate bricks/ }));
    expect(screen.getByText("Brick length is required.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Start from a typical size/), {
      target: { value: "modular-brick" },
    });
    type(/^Mortar joint/, "10");
    fireEvent.click(screen.getByRole("button", { name: /Calculate bricks/ }));
    const row = within(screen.getByRole("table")).getByText("Bricks").closest("tr")!;
    expect(row.textContent).toContain("3,220 pieces");
    expect(row.textContent).toContain("3,381 pieces");
  });

  it("steel: always shows the structural-engineer disclaimer; refuses guesses; points to the team when details are missing", () => {
    render(<MaterialCalculator catalogue={CATALOGUE} />);
    fireEvent.click(screen.getByRole("tab", { name: /Steel/ }));
    expect(
      screen.getByText(/qualified structural engineer using approved structural drawings/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Calculate steel weight/ }));
    expect(screen.getByText("Choose a bar diameter from the list.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /I don’t have these details/ }));
    expect(screen.getByRole("link", { name: /Ask a materials expert/ })).toHaveAttribute(
      "href",
      "/ask-expert",
    );
    expect(screen.queryByRole("button", { name: /Calculate steel weight/ })).toBeNull();
  });

  it("steel bars: 20 × 6 m × 12 mm ≈ 106.54 kg, suggested 107 kg", () => {
    render(<MaterialCalculator catalogue={CATALOGUE} />);
    fireEvent.click(screen.getByRole("tab", { name: /Steel/ }));
    type(/^Bar diameter/, "12");
    type(/^Number of bars/, "20");
    type(/^Length of each bar/, "6");
    fireEvent.click(screen.getByRole("button", { name: /Calculate steel weight/ }));
    const row = within(screen.getByRole("table"))
      .getByText(/Steel bars 12 mm/)
      .closest("tr")!;
    expect(row.textContent).toContain("106.54 kg");
    expect(row.textContent).toContain("107 kg");
  });
});

describe("MaterialCollection (saved lists)", () => {
  const create = (name: string) => {
    type(/^New list name/, name);
    fireEvent.click(screen.getByRole("button", { name: /Create list/ }));
  };
  const addCatalogue = (id: string, qty = "10") => {
    fireEvent.change(screen.getByLabelText(/^Product\*?$/), { target: { value: id } });
    fireEvent.change(screen.getByLabelText(/^Quantity\*?$/), { target: { value: qty } });
    fireEvent.click(screen.getByRole("button", { name: /Add to list/ }));
  };

  it("starts empty with an honest explanation (stored on this device, no account)", () => {
    render(<MaterialCollection kind="list" catalogue={CATALOGUE} />);
    expect(screen.getByText("No saved lists yet")).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/stored only on this device/);
  });

  it("creates, names and persists a list; a blank name is refused", () => {
    render(<MaterialCollection kind="list" catalogue={CATALOGUE} />);
    fireEvent.click(screen.getByRole("button", { name: /Create list/ }));
    expect(screen.getByText("Give your list a name.")).toBeInTheDocument();
    create("Monthly cement");
    expect(screen.getByRole("button", { name: /Monthly cement/ })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).lists[0].name).toBe("Monthly cement");
  });

  it("adds a catalogue item and a custom requirement, edits the quantity, removes an item", () => {
    render(<MaterialCollection kind="list" catalogue={CATALOGUE} />);
    create("Site A");
    addCatalogue("p-cement", "10");
    fireEvent.click(screen.getByRole("button", { name: "Custom requirement" }));
    type(/^Material\*?$/, "Waterproofing job");
    fireEvent.click(screen.getByRole("button", { name: /Add to list/ }));
    expect(screen.getByText("Materials (2)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Increase Quantity of Cement PPC 50 kg" }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).lists[0].items[0].quantity).toBe(11);
    fireEvent.click(screen.getByRole("button", { name: "Remove Waterproofing job" }));
    expect(screen.getByText("Materials (1)")).toBeInTheDocument();
  });

  it("shows CURRENT price and stock from the catalogue, never saved ones", async () => {
    server.resolveMaterialItemsAction.mockResolvedValue({
      ok: true,
      source: "LIVE",
      products: { "p-cement": live("Cement PPC 50 kg", "₹385.00 / Bag") },
    });
    render(<MaterialCollection kind="list" catalogue={CATALOGUE} />);
    create("L");
    addCatalogue("p-cement");
    await screen.findByText(/Indicative rate ₹385\.00 \/ Bag/);
    expect(localStorage.getItem(STORAGE_KEY)).not.toMatch(/385|rate|price/i);
    expect(server.resolveMaterialItemsAction).toHaveBeenCalledWith(["p-cement"]);
  });

  it("flags a product that has left the catalogue and keeps the saved name visible", async () => {
    server.resolveMaterialItemsAction.mockResolvedValue({
      ok: true,
      source: "LIVE",
      products: { "p-cement": null },
    });
    render(<MaterialCollection kind="list" catalogue={CATALOGUE} />);
    create("L");
    addCatalogue("p-cement");
    await screen.findByText("No longer available");
    expect(screen.getByText("Cement PPC 50 kg")).toBeInTheDocument();
  });

  it("warns that static fallback prices are not live", async () => {
    server.resolveMaterialItemsAction.mockResolvedValue({
      ok: true,
      source: "STATIC",
      products: { "p-cement": live("Cement PPC 50 kg") },
    });
    render(<MaterialCollection kind="list" catalogue={CATALOGUE} />);
    create("L");
    addCatalogue("p-cement");
    await screen.findByText(/Live prices are not available at the moment/);
  });

  it("duplicate makes an independent copy; delete asks first and then removes only that list", () => {
    render(<MaterialCollection kind="list" catalogue={CATALOGUE} />);
    create("Original");
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(screen.getByRole("button", { name: /Original \(copy\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).lists).toHaveLength(2); // asked, not yet deleted
    fireEvent.click(within(dialog()).getByRole("button", { name: "Delete" }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).lists).toHaveLength(1);
  });

  it("Send this list as enquiry: reviews current details, leaves out unavailable items, then opens the existing enquiry form", async () => {
    server.resolveMaterialItemsAction.mockResolvedValue({
      ok: true,
      source: "LIVE",
      products: { "p-cement": live("Cement PPC 50 kg"), "p-tmt": null },
    });
    render(<MaterialCollection kind="list" catalogue={CATALOGUE} />);
    create("Order");
    addCatalogue("p-cement", "10");
    addCatalogue("p-tmt", "2");
    fireEvent.click(screen.getByRole("button", { name: /Send this list as enquiry/ }));
    await within(dialog()).findByText(/1 item\(s\) are no longer available/);
    expect(within(dialog()).getByText(/indicative rate ₹385\.00/)).toBeInTheDocument();
    expect(within(dialog()).getByText(PRICE_DISCLAIMER, { exact: false })).toBeInTheDocument();
    expect(localStorage.getItem(ENQUIRY_LIST_KEY)).toBeNull(); // nothing staged until the customer confirms
    fireEvent.click(within(dialog()).getByRole("button", { name: "Continue to enquiry form" }));
    expect(JSON.parse(localStorage.getItem(ENQUIRY_LIST_KEY)!)).toEqual([
      { productId: "p-cement", quantity: 10 },
    ]);
    expect(nav.push).toHaveBeenCalledWith("/bulk-enquiry");
  });

  it("the review cannot continue when the catalogue could not be checked, and offers a retry", async () => {
    server.resolveMaterialItemsAction.mockResolvedValue({ ok: false, message: "unavailable" });
    render(<MaterialCollection kind="list" catalogue={CATALOGUE} />);
    create("Order");
    addCatalogue("p-cement");
    fireEvent.click(screen.getByRole("button", { name: /Send this list as enquiry/ }));
    await within(dialog()).findByText(/could not be checked right now/);
    expect(
      within(dialog()).getByRole("button", { name: "Continue to enquiry form" }),
    ).toBeDisabled();
    expect(within(dialog()).getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("offline: lists still work, a notice explains, and sending an enquiry is disabled", () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    render(<MaterialCollection kind="list" catalogue={CATALOGUE} />);
    expect(screen.getByText("You are offline")).toBeInTheDocument();
    create("Offline list");
    fireEvent.click(screen.getByRole("button", { name: "Custom requirement" }));
    type(/^Material\*?$/, "Sand");
    fireEvent.click(screen.getByRole("button", { name: /Add to list/ }));
    expect(screen.getByText("Materials (1)")).toBeInTheDocument();
    expect(server.resolveMaterialItemsAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Send this list as enquiry/ }));
    expect(
      within(dialog()).getByRole("button", { name: "Continue to enquiry form" }),
    ).toBeDisabled();
    expect(within(dialog()).getByText(/You are offline/)).toBeInTheDocument();
  });

  it("recovers from corrupted storage with a visible, dismissible notice and keeps valid lists", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        lists: [
          {
            id: "ok",
            name: "Kept",
            notes: "",
            items: [],
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
          { id: "bad" },
        ],
        projects: [],
      }),
    );
    render(<MaterialCollection kind="list" catalogue={CATALOGUE} />);
    expect(screen.getByText("Some saved data could not be read")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kept/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Some saved data could not be read")).toBeNull();
  });

  it("exports as plain text without any prices", () => {
    render(<MaterialCollection kind="list" catalogue={CATALOGUE} />);
    create("Export me");
    addCatalogue("p-cement", "3");
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: write },
      configurable: true,
    });
    fireEvent.click(screen.getByRole("button", { name: /Copy as text/ }));
    const text = write.mock.calls[0][0] as string;
    expect(text).toContain("Export me");
    expect(text).toContain("- Cement PPC 50 kg: 3 Bag");
    expect(text).not.toMatch(/₹|price|rate/i);
  });
});

describe("MaterialCollection (projects)", () => {
  it("creates a project with a type, edits details and measurements, and persists them", () => {
    render(<MaterialCollection kind="project" catalogue={CATALOGUE} />);
    type(/^New project name/, "Boundary wall");
    fireEvent.change(screen.getAllByLabelText(/Project type/)[0], {
      target: { value: "BOUNDARY_WALL" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create project/ }));
    const loc = screen.getByLabelText(/^Location/);
    fireEvent.change(loc, { target: { value: "Plot 12" } });
    fireEvent.blur(loc);
    fireEvent.click(screen.getByRole("button", { name: /Add a measurement/ }));
    const label = screen.getByLabelText("Label 1");
    fireEvent.change(label, { target: { value: "Length" } });
    fireEvent.blur(label);
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY)!).projects[0];
    expect(p).toMatchObject({
      name: "Boundary wall",
      type: "BOUNDARY_WALL",
      location: "Plot 12",
      measurements: [{ label: "Length", value: "" }],
    });
  });

  it("projects and lists are separate collections in one shared store", () => {
    const { unmount } = render(<MaterialCollection kind="project" catalogue={CATALOGUE} />);
    type(/^New project name/, "P1");
    fireEvent.click(screen.getByRole("button", { name: /Create project/ }));
    unmount();
    render(<MaterialCollection kind="list" catalogue={CATALOGUE} />);
    expect(screen.getByText("No saved lists yet")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).projects).toHaveLength(1);
  });

  it("sending a project keeps its name and notes in the enquiry message for the customer to review", async () => {
    server.resolveMaterialItemsAction.mockResolvedValue({ ok: true, source: "LIVE", products: {} });
    render(<MaterialCollection kind="project" catalogue={[]} />);
    type(/^New project name/, "Ground floor");
    fireEvent.click(screen.getByRole("button", { name: /Create project/ }));
    const notes = screen.getByLabelText(/^Notes/);
    fireEvent.change(notes, { target: { value: "Slab next month" } });
    fireEvent.blur(notes);
    type(/^Material\*?$/, "Waterproofing");
    fireEvent.click(screen.getByRole("button", { name: /Add to project/ }));
    fireEvent.click(screen.getByRole("button", { name: /Send this project as an enquiry/ }));
    await waitFor(() =>
      expect(
        within(dialog()).getByRole("button", { name: "Continue to enquiry form" }),
      ).toBeEnabled(),
    );
    fireEvent.click(within(dialog()).getByRole("button", { name: "Continue to enquiry form" }));
    const msg = JSON.parse(sessionStorage.getItem(PREFILL_KEY)!).message as string;
    expect(msg).toContain("Project: Ground floor");
    expect(msg).toContain("Notes: Slab next month");
    expect(msg).toContain("- Waterproofing: 1");
  });
});
