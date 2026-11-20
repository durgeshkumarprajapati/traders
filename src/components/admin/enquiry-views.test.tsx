// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EnquiryListView } from "./enquiry-list-view";
import { EnquiryDetailView } from "./enquiry-detail-view";
import type { AdminEnquiryDetail, AdminEnquiryListResult } from "@/features/admin/types";
import * as adminActions from "@/features/admin/actions";

const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    refresh: mockRouterRefresh,
  }),
}));

const mockEnquiryListItem = {
  id: "enq-1",
  reference: "ENQ-2026-001001",
  type: "BULK" as const,
  status: "NEW" as const,
  customerName: "Ramesh Sharma",
  mobile: "9123456789",
  email: "ramesh@example.org",
  deliveryLocation: "Rewa Site",
  message: "Need 200 bags cement",
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-20T10:00:00.000Z",
  itemCount: 2,
};

const mockListResult: AdminEnquiryListResult = {
  enquiries: [mockEnquiryListItem],
  totalCount: 1,
  page: 1,
  pageSize: 15,
  totalPages: 1,
};

const mockDetail: AdminEnquiryDetail = {
  id: "enq-1",
  reference: "ENQ-2026-001001",
  type: "BULK",
  status: "NEW",
  customerName: "Ramesh Sharma",
  mobile: "9123456789",
  email: "ramesh@example.org",
  deliveryLocation: "Industrial Area, Rewa",
  message: "Require 200 bags cement and 2 tons TMT steel.",
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-20T10:00:00.000Z",
  items: [
    {
      id: "item-1",
      position: 1,
      productId: "prod-1",
      sku: "CEM-1",
      productName: "BuildPro PPC Cement",
      brandName: "BuildPro",
      unitCode: "BAG",
      unitLabel: "Bag",
      quantity: 200,
      listedPrice: 385,
      stockStatus: "IN_STOCK",
    },
    {
      id: "item-2",
      position: 2,
      productId: "prod-2",
      sku: "STL-1",
      productName: "DuraSteel Fe 550D 12mm",
      brandName: "DuraSteel",
      unitCode: "TON",
      unitLabel: "Ton",
      quantity: 2,
      listedPrice: 64500,
      stockStatus: "IN_STOCK",
    },
  ],
  notes: [
    {
      id: "note-1",
      enquiryId: "enq-1",
      authorId: "admin-1",
      authorEmail: "admin@sagartraders.in",
      authorName: "Store Admin",
      body: "Customer requested delivery by Saturday.",
      createdAt: "2026-11-20T10:15:00.000Z",
    },
  ],
  outbox: {
    id: "outbox-1",
    status: "SENT",
    attemptCount: 1,
    maxAttempts: 8,
    lastError: null,
    sentAt: "2026-11-20T10:01:00.000Z",
    nextAttemptAt: "2026-11-20T10:01:00.000Z",
  },
};

describe("EnquiryListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders enquiry rows with reference, customer details, and status badge", () => {
    render(<EnquiryListView initialData={mockListResult} />);
    expect(screen.getByText("Customer Enquiries")).toBeInTheDocument();
    expect(screen.getByText("ENQ-2026-001001")).toBeInTheDocument();
    expect(screen.getByText("Ramesh Sharma")).toBeInTheDocument();
    expect(screen.getByText("9123456789")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });

  it("renders empty state when no enquiries match", () => {
    const emptyResult: AdminEnquiryListResult = {
      enquiries: [],
      totalCount: 0,
      page: 1,
      pageSize: 15,
      totalPages: 0,
    };
    render(<EnquiryListView initialData={emptyResult} currentSearch="NonExistent" />);
    expect(screen.getByText("No enquiries found")).toBeInTheDocument();
  });

  it("updates search filters on submit", () => {
    render(<EnquiryListView initialData={mockListResult} />);
    const searchInput = screen.getByPlaceholderText(/e\.g\. ENQ-2026-001001/i);
    fireEvent.change(searchInput, { target: { value: "Sharma" } });
    fireEvent.click(screen.getByRole("button", { name: /apply filters/i }));

    expect(mockRouterPush).toHaveBeenCalledWith("/admin/enquiries?search=Sharma");
  });
});

describe("EnquiryDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders full customer details, requested items, and indicative total", () => {
    render(<EnquiryDetailView enquiry={mockDetail} />);
    expect(screen.getByText("ENQ-2026-001001")).toBeInTheDocument();
    expect(screen.getByText("Ramesh Sharma")).toBeInTheDocument();
    expect(screen.getByText("Industrial Area, Rewa")).toBeInTheDocument();
    expect(screen.getByText("Require 200 bags cement and 2 tons TMT steel.")).toBeInTheDocument();

    // Check items
    expect(screen.getByText("BuildPro PPC Cement")).toBeInTheDocument();
    expect(screen.getByText("DuraSteel Fe 550D 12mm")).toBeInTheDocument();
    expect(screen.getByText("200 Bag")).toBeInTheDocument();
    expect(screen.getByText("2 Ton")).toBeInTheDocument();

    // Indicative total: 200 * 385 (77,000) + 2 * 64500 (129,000) = 206,000
    expect(screen.getByText(/2,06,000/)).toBeInTheDocument();

    // Check outbox status
    expect(screen.getByText("SENT")).toBeInTheDocument();

    // Check notes
    expect(screen.getByText("Customer requested delivery by Saturday.")).toBeInTheDocument();
  });

  it("submits status transition when Save Status Change is clicked", async () => {
    vi.spyOn(adminActions, "updateEnquiryStatusAction").mockResolvedValue({
      ok: true,
      data: { id: "enq-1", status: "CONTACTED" },
    });

    render(<EnquiryDetailView enquiry={mockDetail} />);
    const select = screen.getByLabelText(/update enquiry status/i);
    fireEvent.change(select, { target: { value: "CONTACTED" } });

    const saveButton = screen.getByRole("button", { name: /save status change/i });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(adminActions.updateEnquiryStatusAction).toHaveBeenCalledWith("enq-1", "CONTACTED");
      expect(screen.getByText(/enquiry status updated to CONTACTED/i)).toBeInTheDocument();
    });
  });

  it("submits internal note when Add Note is clicked", async () => {
    vi.spyOn(adminActions, "addEnquiryNoteAction").mockResolvedValue({
      ok: true,
      data: { id: "note-2", body: "Called customer, quotation pending." },
    });

    render(<EnquiryDetailView enquiry={mockDetail} />);
    const textarea = screen.getByPlaceholderText(/record customer follow-up call/i);
    fireEvent.change(textarea, { target: { value: "Called customer, quotation pending." } });

    const addNoteButton = screen.getByRole("button", { name: /add note/i });
    expect(addNoteButton).not.toBeDisabled();
    fireEvent.click(addNoteButton);

    await waitFor(() => {
      expect(adminActions.addEnquiryNoteAction).toHaveBeenCalledWith(
        "enq-1",
        "Called customer, quotation pending.",
      );
      expect(screen.getByText(/internal staff note added/i)).toBeInTheDocument();
    });
  });
});
