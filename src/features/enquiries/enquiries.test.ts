import { ENQUIRY_LIST_KEY, MAX_ENQUIRY_ITEMS, enquiryList } from "./enquiry-list-store";
import { bulkEnquirySchema, contactEnquirySchema, mobileSchema, toFieldErrors } from "./schemas";

const read = () => JSON.parse(localStorage.getItem(ENQUIRY_LIST_KEY) ?? "[]");

describe("enquiry schemas", () => {
  it("normalises valid mobile numbers and rejects invalid ones", () => {
    expect(mobileSchema.parse("98765 43210")).toBe("9876543210");
    expect(mobileSchema.parse("+91 98765-43210")).toBe("9876543210");
    for (const bad of ["", "12345", "5876543210", "98765432101", "abcdefghij"])
      expect(mobileSchema.safeParse(bad).success).toBe(false);
  });
  it("validates the contact enquiry with per-field messages", () => {
    const r = contactEnquirySchema.safeParse({
      name: "A",
      mobile: "1",
      email: "nope",
      message: "short",
    });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(Object.keys(toFieldErrors(r.error)).sort()).toEqual([
        "email",
        "message",
        "mobile",
        "name",
      ]);
    expect(
      contactEnquirySchema.safeParse({
        name: "Asha Rao",
        mobile: "9876543210",
        email: "",
        message: "I need a quotation please",
      }).success,
    ).toBe(true);
  });
  it("requires at least one item with a positive quantity for bulk enquiries", () => {
    const ok = {
      name: "Asha Rao",
      mobile: "9876543210",
      email: "",
      deliveryLocation: "Pune site",
      message: "",
      items: [{ productId: "p1", quantity: 2 }],
    };
    expect(bulkEnquirySchema.safeParse(ok).success).toBe(true);
    const empty = bulkEnquirySchema.safeParse({ ...ok, items: [] });
    expect(empty.success).toBe(false);
    if (!empty.success) expect(toFieldErrors(empty.error).items).toMatch(/at least one/i);
    expect(
      bulkEnquirySchema.safeParse({ ...ok, items: [{ productId: "p1", quantity: 0 }] }).success,
    ).toBe(false);
    expect(
      bulkEnquirySchema.safeParse({ ...ok, items: [{ productId: "p1", quantity: -1 }] }).success,
    ).toBe(false);
    expect(bulkEnquirySchema.safeParse({ ...ok, deliveryLocation: "" }).success).toBe(false);
  });
});

describe("enquiry list store", () => {
  beforeEach(() => {
    localStorage.clear();
    enquiryList._reset();
  });

  it("adds, merges quantities, updates and removes — storing only id and quantity", () => {
    enquiryList.add("p1");
    enquiryList.add("p1", 2);
    enquiryList.add("p2", 5);
    expect(read()).toEqual([
      { productId: "p1", quantity: 3 },
      { productId: "p2", quantity: 5 },
    ]);
    enquiryList.setQuantity("p2", 7.5);
    enquiryList.setQuantity("p2", 0); // invalid: ignored
    enquiryList.setQuantity("p2", Number.NaN); // invalid: ignored
    expect(read()[1]).toEqual({ productId: "p2", quantity: 7.5 });
    enquiryList.remove("p1");
    expect(read()).toEqual([{ productId: "p2", quantity: 7.5 }]);
    enquiryList.clear();
    expect(read()).toEqual([]);
    for (const row of [...read()])
      expect(Object.keys(row).sort()).toEqual(["productId", "quantity"]);
  });

  it("caps the list size", () => {
    for (let i = 0; i < MAX_ENQUIRY_ITEMS; i++) expect(enquiryList.add(`p${i}`)).toBe(true);
    expect(enquiryList.add("overflow")).toBe(false);
    expect(read()).toHaveLength(MAX_ENQUIRY_ITEMS);
  });

  it("ignores corrupted or hostile stored data", () => {
    localStorage.setItem(
      ENQUIRY_LIST_KEY,
      JSON.stringify([
        { productId: "ok", quantity: 2 },
        { productId: "ok", quantity: 3 },
        { productId: "", quantity: 1 },
        { productId: "neg", quantity: -1 },
        { productId: "str", quantity: "5" },
        null,
        7,
      ]),
    );
    enquiryList._reset();
    enquiryList.add("new");
    expect(read()).toEqual([
      { productId: "ok", quantity: 2 },
      { productId: "new", quantity: 1 },
    ]);
    localStorage.setItem(ENQUIRY_LIST_KEY, "{not json");
    enquiryList._reset();
    enquiryList.add("again");
    expect(read()).toEqual([{ productId: "again", quantity: 1 }]);
  });
});
