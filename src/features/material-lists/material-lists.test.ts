import { act } from "@testing-library/react";
import { enquiryList, ENQUIRY_LIST_KEY } from "@/features/enquiries/enquiry-list-store";
import { PREFILL_KEY, buildEnquiryMessage, stageEnquiry, takeEnquiryPrefill } from "./handoff";
import { migrate, materialStore as store, parseStored } from "./store";
import { LIMITS, STORAGE_KEY, type MaterialItem } from "./types";

const item = (over: Partial<MaterialItem> = {}): Omit<MaterialItem, "id"> => ({
  productId: "p1",
  name: "Cement PPC 50 kg",
  quantity: 20,
  unit: "Bag",
  notes: "",
  source: "MANUAL",
  ...over,
});
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
/** Forget in-memory state, then read once (the store loads lazily on first read). */
const fresh = () => {
  act(() => store._reset());
  store.acknowledgeRecovery();
};
const read = async () =>
  (await import("./store")).parseStored(localStorage.getItem(STORAGE_KEY)).state;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  act(() => {
    store._reset();
    enquiryList._reset();
  });
});
afterEach(() => vi.restoreAllMocks());

describe("lists", () => {
  it("create, rename, notes, duplicate, delete", () => {
    const id = store.createList("  Monthly cement  ")!;
    expect((stored().lists as { name: string }[])[0].name).toBe("Monthly cement");
    expect(store.rename("list", id, "Site A")).toBe(true);
    expect(store.setNotes("list", id, "for slab")).toBe(true);
    store.addItem("list", id, item());
    const copy = store.duplicate("list", id)!;
    const s = stored();
    expect(s.lists).toHaveLength(2);
    const [a, b] = s.lists;
    expect(b.id).toBe(copy);
    expect(b.name).toBe("Site A (copy)");
    expect(b.items[0].id).not.toBe(a.items[0].id); // the copy is independent
    store.delete("list", id);
    expect(stored().lists).toHaveLength(1);
    expect(stored().lists[0].id).toBe(copy);
  });

  it("an empty / blank name falls back to a sensible default, and names are bounded", () => {
    store.createList("   ");
    store.createList("x".repeat(500));
    const names = stored().lists.map((l: { name: string }) => l.name);
    expect(names[0]).toBe("My list");
    expect(names[1]).toHaveLength(LIMITS.name);
  });

  it("adds items, merges the same catalogue product (quantities add), keeps custom items separate", () => {
    const id = store.createList("L")!;
    store.addItem("list", id, item({ quantity: 10 }));
    store.addItem("list", id, item({ quantity: 5 }));
    store.addItem(
      "list",
      id,
      item({ productId: null, name: "Custom thing", quantity: 3, unit: "pcs" }),
    );
    store.addItem(
      "list",
      id,
      item({ productId: null, name: "Custom thing", quantity: 3, unit: "pcs" }),
    );
    const items = stored().lists[0].items;
    expect(items).toHaveLength(3);
    expect(items[0].quantity).toBe(15);
  });

  it("updates quantity (rejecting invalid values), edits notes, removes items", () => {
    const id = store.createList("L")!;
    store.addItem("list", id, item());
    const itemId = stored().lists[0].items[0].id;
    for (const bad of [0, -1, Number.NaN, Infinity, LIMITS.maxQuantity + 1])
      expect(store.updateItem("list", id, itemId, { quantity: bad })).toBe(false);
    expect(store.updateItem("list", id, itemId, { quantity: 42.5, notes: "n" })).toBe(true);
    expect(stored().lists[0].items[0]).toMatchObject({
      quantity: 42.5,
      notes: "n",
      source: "MANUAL",
    });
    store.removeItem("list", id, itemId);
    expect(stored().lists[0].items).toEqual([]);
  });

  it("an edited ESTIMATED quantity becomes MANUAL (so it is never mislabelled as a calculator figure)", () => {
    const id = store.createList("L")!;
    store.addItem("list", id, item({ source: "ESTIMATED" }));
    const itemId = stored().lists[0].items[0].id;
    expect(stored().lists[0].items[0].source).toBe("ESTIMATED");
    store.updateItem("list", id, itemId, { quantity: 99 });
    expect(stored().lists[0].items[0].source).toBe("MANUAL");
  });

  it("a catalogue item's name and unit cannot be edited locally (they come from the catalogue)", () => {
    const id = store.createList("L")!;
    store.addItem("list", id, item());
    const itemId = stored().lists[0].items[0].id;
    store.updateItem("list", id, itemId, { name: "Hacked", unit: "Ton" });
    expect(stored().lists[0].items[0]).toMatchObject({ name: "Cement PPC 50 kg", unit: "Bag" });
  });

  it("enforces the limits (lists, items per list)", () => {
    for (let i = 0; i < LIMITS.lists; i++) expect(store.createList(`L${i}`)).not.toBeNull();
    expect(store.createList("one too many")).toBeNull();
    const id = stored().lists[0].id;
    for (let i = 0; i < LIMITS.itemsPerList; i++)
      expect(store.addItem("list", id, item({ productId: `p${i}` }))).toBe(true);
    expect(store.addItem("list", id, item({ productId: "extra" }))).toBe(false);
    expect(stored().lists[0].items).toHaveLength(LIMITS.itemsPerList);
  });

  it("returns false / null for unknown ids instead of throwing", () => {
    expect(store.rename("list", "nope", "x")).toBe(false);
    expect(store.addItem("list", "nope", item())).toBe(false);
    expect(store.duplicate("list", "nope")).toBeNull();
    expect(() => store.delete("list", "nope")).not.toThrow();
  });
});

describe("projects", () => {
  it("create, edit details and measurements, add items, duplicate, delete", () => {
    const id = store.createProject({
      name: "Boundary wall",
      type: "BOUNDARY_WALL",
      location: "Plot 12",
      notes: "north side",
    })!;
    store.updateProject(id, {
      type: "HOUSE",
      location: "Plot 14",
      measurements: [{ label: "Length", value: "30 ft" }],
    });
    store.addItem("project", id, item({ source: "ESTIMATED" }));
    const copy = store.duplicate("project", id)!;
    const p = stored().projects;
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({
      name: "Boundary wall",
      type: "HOUSE",
      location: "Plot 14",
      measurements: [{ label: "Length", value: "30 ft" }],
    });
    expect(p[1].id).toBe(copy);
    store.delete("project", id);
    expect(stored().projects).toHaveLength(1);
  });

  it("lists and projects are independent collections (deleting one never touches the other)", () => {
    const l = store.createList("L")!;
    const p = store.createProject({ name: "P", type: "ROOM" })!;
    store.delete("list", l);
    expect(stored().lists).toHaveLength(0);
    expect(stored().projects).toHaveLength(1);
    store.delete("project", p);
    expect(stored().projects).toHaveLength(0);
  });
});

describe("persistence", () => {
  it("survives a page reload (state is rebuilt from storage)", () => {
    const id = store.createList("Persisted")!;
    store.addItem("list", id, item());
    act(() => store._reset()); // simulates a fresh page load
    store.rename("list", id, "Persisted 2");
    expect(stored().lists[0]).toMatchObject({ name: "Persisted 2" });
    expect(stored().lists[0].items).toHaveLength(1);
  });

  it("stores a versioned document with no prices, stock or tokens", () => {
    const id = store.createList("L")!;
    store.addItem("list", id, item());
    const text = localStorage.getItem(STORAGE_KEY)!;
    expect(stored().version).toBe(1);
    expect(text).not.toMatch(/price|stock|token|rate|email|mobile/i);
  });

  it("keeps working in memory when storage is unavailable, and says so", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(store.createList("Memory only")).not.toBeNull();
    const { materialStore } = await import("./store");
    expect(materialStore).toBe(store);
  });
});

describe("recovery and migration", () => {
  const good = {
    id: "l1",
    name: "Good",
    notes: "",
    items: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  it("corrupt JSON is set aside (not destroyed) and the store starts empty, flagged as recovered", () => {
    const r = parseStored("{not json");
    expect(r.state).toMatchObject({ lists: [], projects: [], status: "recovered" });
    expect(r.backup).toEqual({ key: `${STORAGE_KEY}-corrupt`, value: "{not json" });
    localStorage.setItem(STORAGE_KEY, "{not json");
    fresh();
    expect(localStorage.getItem(`${STORAGE_KEY}-corrupt`)).toBe("{not json");
  });

  it.each([
    ["a number", "42"],
    ["a string", '"hello"'],
    ["null", "null"],
    ["a negative version", '{"version":-1}'],
    ["a fractional version", '{"version":1.5}'],
  ])("%s is treated as unreadable", (_n, text) => {
    expect(parseStored(text).state.status).toBe("recovered");
  });

  it("keeps the valid records and drops only the invalid ones", () => {
    const text = JSON.stringify({
      version: 1,
      lists: [
        good,
        { id: "bad", name: "", items: [] },
        {
          ...good,
          id: "l2",
          items: [
            {
              id: "i",
              productId: "p",
              name: "x",
              quantity: -5,
              unit: "",
              notes: "",
              source: "MANUAL",
            },
          ],
        },
        "garbage",
        null,
      ],
      projects: [{ ...good, id: "p1", type: "NOT_A_TYPE" }],
    });
    const { state } = parseStored(text);
    expect(state.lists.map((l) => l.id)).toEqual(["l1"]);
    expect(state.projects).toEqual([]);
    expect(state.status).toBe("recovered");
  });

  it("drops duplicate ids and oversized fields", () => {
    const { state } = parseStored(
      JSON.stringify({
        version: 1,
        lists: [good, good, { ...good, id: "big", name: "x".repeat(81) }],
        projects: [],
      }),
    );
    expect(state.lists.map((l) => l.id)).toEqual(["l1"]);
  });

  it("migrates the older unversioned shapes forward", () => {
    expect(migrate([good])).toEqual({ version: 1, lists: [good], projects: [] });
    expect(migrate({ lists: [good] })).toEqual({ version: 1, lists: [good], projects: [] });
    expect(parseStored(JSON.stringify([good])).state.lists).toHaveLength(1);
    expect(parseStored(JSON.stringify({ lists: [good] })).state.status).toBe("ok");
  });

  it("data written by a NEWER app version is backed up and never overwritten", () => {
    const future = JSON.stringify({ version: 99, lists: [good], extra: "new things" });
    localStorage.setItem(STORAGE_KEY, future);
    fresh();
    expect(localStorage.getItem(`${STORAGE_KEY}-future`)).toBe(future);
    store.createList("added with the old app");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(future); // untouched
  });

  it("an empty or missing value is simply empty", () => {
    expect(parseStored(null).state.status).toBe("empty");
    expect(parseStored("").state.status).toBe("empty");
  });

  it("acknowledging a recovery clears the notice without touching the data", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, lists: [good, "junk"], projects: [] }),
    );
    fresh();
    store.acknowledgeRecovery();
    expect((await read()).lists).toHaveLength(1);
  });
});

describe("handing a list to the existing bulk-enquiry flow", () => {
  const mi = (over: Partial<MaterialItem>): MaterialItem => ({
    id: Math.random().toString(36),
    productId: "p1",
    name: "N",
    quantity: 2,
    unit: "Bag",
    notes: "",
    source: "MANUAL",
    ...over,
  });

  it("catalogue items go to the enquiry list as id + quantity ONLY; custom items become labelled text", () => {
    const r = stageEnquiry(
      [
        mi({ productId: "p1", quantity: 10 }),
        mi({ productId: "p2", quantity: 3 }),
        mi({ productId: null, name: "Waterproofing work", quantity: 1, unit: "job" }),
      ],
      { heading: "Project: House", notes: "ground floor" },
    );
    expect(r).toEqual({ added: 2, custom: 1, skippedFull: 0 });
    expect(JSON.parse(localStorage.getItem(ENQUIRY_LIST_KEY)!)).toEqual([
      { productId: "p1", quantity: 10 },
      { productId: "p2", quantity: 3 },
    ]);
    const msg = takeEnquiryPrefill()!;
    expect(msg).toContain("Project: House");
    expect(msg).toContain("Notes: ground floor");
    expect(msg).toContain("not matched to catalogue products");
    expect(msg).toContain("- Waterproofing work: 1 job");
  });

  it("nothing is submitted and no names, units or prices reach the enquiry list", () => {
    stageEnquiry([mi({ name: "Cement PPC", unit: "Bag" })]);
    const raw = localStorage.getItem(ENQUIRY_LIST_KEY)!;
    expect(raw).not.toMatch(/Cement|Bag|name|unit|price/i);
  });

  it("the prefill is read once and then gone; malformed prefill is ignored", () => {
    stageEnquiry([mi({ productId: null, name: "X", quantity: 1, unit: "" })]);
    expect(takeEnquiryPrefill()).toContain("- X: 1");
    expect(takeEnquiryPrefill()).toBeNull();
    sessionStorage.setItem(PREFILL_KEY, "{broken");
    expect(takeEnquiryPrefill()).toBeNull();
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify({ message: 123 }));
    expect(takeEnquiryPrefill()).toBeNull();
  });

  it("no message is staged when there is nothing custom and no heading", () => {
    stageEnquiry([mi({ productId: "p1" })]);
    expect(takeEnquiryPrefill()).toBeNull();
  });

  it("the message never exceeds the bulk form's 1000-character limit", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      mi({
        productId: null,
        name: `Custom requirement number ${i} with a long description`,
        quantity: i + 1,
        unit: "pcs",
      }),
    );
    expect(buildEnquiryMessage({ heading: "H", custom: many }).length).toBeLessThanOrEqual(1000);
  });

  it("reports items skipped because the enquiry list is full", () => {
    const many = Array.from({ length: 52 }, (_, i) => mi({ productId: `p${i}` }));
    const r = stageEnquiry(many);
    expect(r.added).toBe(50);
    expect(r.skippedFull).toBe(2);
  });
});
