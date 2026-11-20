import { fireEvent, render, screen } from "@testing-library/react";
import { Badge, CountBadge, EnquiryStatusBadge, StockBadge } from "./index";
import { Button, ButtonLink, buttonVariants } from "./button";
import { Field, Input, Select } from "./form-controls";
import { AlertModal, Modal } from "./modal";
import { Notification } from "./notification";
import { Pagination, Breadcrumbs } from "./navigation-aids";
import { Table, TBody, Td, Th, THead, Tr } from "./table";
import { Tabs } from "./tabs";

describe("Button", () => {
  it("defaults to type=button, primary, md", () => {
    render(<Button>Save</Button>);
    const b = screen.getByRole("button", { name: "Save" });
    expect(b).toHaveAttribute("type", "button");
    expect(b).toHaveClass("bg-primary", "h-10");
  });
  it.each(["primary", "secondary", "outline", "ghost", "destructive", "link"] as const)(
    "variant %s renders",
    (v) => {
      expect(buttonVariants({ variant: v })).toBeTruthy();
    },
  );
  it("renders link buttons with the same styling", () => {
    render(
      <ButtonLink href="/x" variant="secondary">
        Go
      </ButtonLink>,
    );
    expect(screen.getByRole("link", { name: "Go" })).toHaveClass(
      "bg-secondary",
      "text-on-secondary",
    );
  });
});

describe("Badges", () => {
  it("caps count", () => {
    render(<CountBadge count={150} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
  it("maps statuses to palette tones", () => {
    render(
      <>
        <StockBadge status="OUT_OF_STOCK" />
        <EnquiryStatusBadge status="QUOTATION_SENT" />
        <Badge tone="success" appearance="outline">
          x
        </Badge>
      </>,
    );
    expect(screen.getByText("Out of Stock")).toHaveClass("bg-error");
    expect(screen.getByText("Quotation Sent")).toHaveClass("bg-info");
    expect(screen.getByText("x")).toHaveClass("border-success");
  });
});

describe("Form controls", () => {
  it("wires label, helper and error to the control", () => {
    render(
      <Field label="Mobile" required helper="Help" error="Bad number">
        {(p) => <Input {...p} />}
      </Field>,
    );
    const input = screen.getByLabelText(/Mobile/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Bad number");
  });
  it("shows helper when no error", () => {
    render(
      <Field label="Name" helper="Help text">
        {(p) => <Input {...p} />}
      </Field>,
    );
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Help text");
  });
  it("toggles password visibility", () => {
    render(<Input type="password" aria-label="pw" />);
    const input = screen.getByLabelText("pw");
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });
  it("renders a select", () => {
    render(
      <Select aria-label="cat">
        <option>A</option>
      </Select>,
    );
    expect(screen.getByRole("combobox", { name: "cat" })).toBeInTheDocument();
  });
});

describe("Modal", () => {
  it("opens the native dialog and closes via the close button", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open={false} onClose={onClose} title="T">
        body
      </Modal>,
    );
    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
    rerender(
      <Modal open onClose={onClose} title="T">
        body
      </Modal>,
    );
    expect(document.querySelector("dialog")).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
  it("alert modal confirms", () => {
    const onConfirm = vi.fn();
    render(
      <AlertModal
        open
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Archive?"
        confirmLabel="Confirm Archive"
      />,
    );
    expect(document.querySelector("dialog")).toHaveAttribute("role", "alertdialog");
    fireEvent.click(screen.getByRole("button", { name: "Confirm Archive" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe("Tabs", () => {
  const items = [
    { id: "a", label: "A", content: <p>Panel A</p> },
    { id: "b", label: "B", content: <p>Panel B</p> },
    { id: "c", label: "C", content: <p>Panel C</p> },
  ];
  it("supports arrow, Home and End keys with roving tabindex", () => {
    render(<Tabs label="t" items={items} />);
    const a = screen.getByRole("tab", { name: "A" });
    a.focus();
    fireEvent.keyDown(a, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "B" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "B" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(screen.getByRole("tab", { name: "B" }), { key: "End" });
    expect(screen.getByText("Panel C")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tab", { name: "C" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("Notification", () => {
  it("uses alert role for errors and status for success", () => {
    render(
      <>
        <Notification tone="error">e</Notification>
        <Notification tone="success">s</Notification>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("e");
    expect(screen.getByRole("status")).toHaveTextContent("s");
  });
  it("dismisses", () => {
    const f = vi.fn();
    render(
      <Notification tone="info" onDismiss={f}>
        i
      </Notification>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(f).toHaveBeenCalled();
  });
});

describe("Table / navigation", () => {
  it("renders semantic table with scoped headers", () => {
    render(
      <Table>
        <THead>
          <Tr>
            <Th>Item</Th>
          </Tr>
        </THead>
        <TBody>
          <Tr interactive>
            <Td>x</Td>
          </Tr>
        </TBody>
      </Table>,
    );
    expect(screen.getByRole("columnheader", { name: "Item" })).toHaveAttribute("scope", "col");
  });
  it("pagination marks current page and hides when single page", () => {
    const { container, rerender } = render(
      <Pagination page={2} pageCount={5} hrefFor={(p) => `?p=${p}`} />,
    );
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Next/ })).toHaveAttribute("href", "?p=3");
    rerender(<Pagination page={1} pageCount={1} hrefFor={() => ""} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("breadcrumbs mark the current page", () => {
    render(<Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Now" }]} />);
    expect(screen.getByText("Now")).toHaveAttribute("aria-current", "page");
  });
});
