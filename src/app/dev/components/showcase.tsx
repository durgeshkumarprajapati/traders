"use client";

import { useState, type ReactNode } from "react";
import { MessageCircle, Plus, Search, Settings, ShoppingBag, Phone, Inbox } from "lucide-react";
import { PageContainer, PageHeading } from "@/components/common/container";
import {
  AlertModal,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  CountBadge,
  Drawer,
  DotBadge,
  EmptyState,
  EnquiryStatusBadge,
  Field,
  Input,
  InteractiveCard,
  Modal,
  Notification,
  Pagination,
  Radio,
  Select,
  Skeleton,
  Spinner,
  StockBadge,
  TBody,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  THead,
  ToastProvider,
  Tr,
  useToast,
  type EnquiryStatus,
  type Tone,
} from "@/components/ui";

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-section-sm">
      <h2 className="text-headline-md">{title}</h2>
      {note && <p className="mt-1 text-body-sm text-on-surface-variant">{note}</p>}
      <div className="mt-gutter-md">{children}</div>
    </section>
  );
}

const tones: Tone[] = ["primary", "secondary", "success", "warning", "error", "info", "neutral"];
const statuses: EnquiryStatus[] = [
  "NEW",
  "CONTACTED",
  "QUOTATION_SENT",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
];

function ToastDemo() {
  const { notify } = useToast();
  return (
    <div className="flex flex-wrap gap-gutter-sm">
      {(["success", "error", "warning", "info"] as const).map((t) => (
        <Button key={t} variant="outline" onClick={() => notify(t, `This is a ${t} toast.`)}>
          Toast: {t}
        </Button>
      ))}
    </div>
  );
}

function Body() {
  const [modal, setModal] = useState(false);
  const [alert, setAlert] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [selected, setSelected] = useState<string[]>(["a"]);
  const rows = [
    { id: "a", name: "Sample product A", rate: "₹100 / unit" },
    { id: "b", name: "Sample product B", rate: "₹200 / unit" },
  ];

  return (
    <PageContainer>
      <PageHeading
        title="Component showcase"
        description="Phase 1 — development only. Sample values are placeholders, not business data."
      />

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-gutter-sm">
          <Button>Primary</Button>
          <Button variant="secondary">Request Quotation</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Search">
            <Search aria-hidden className="size-4" />
          </Button>
          <Button variant="secondary">
            <MessageCircle aria-hidden className="size-4" /> With icon
          </Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-gutter-sm">
          {tones.map((t) => (
            <Badge key={t} tone={t}>
              {t}
            </Badge>
          ))}
          {tones.map((t) => (
            <Badge key={`o-${t}`} tone={t} appearance="outline">
              {t}
            </Badge>
          ))}
        </div>
        <div className="mt-gutter-md flex flex-wrap items-center gap-gutter-md">
          <CountBadge count={12} /> <CountBadge count={128} tone="primary" />
          <DotBadge tone="success">Active</DotBadge> <DotBadge tone="error">Inactive</DotBadge>
          <StockBadge status="IN_STOCK" /> <StockBadge status="LIMITED_STOCK" />{" "}
          <StockBadge status="OUT_OF_STOCK" />
        </div>
        <div className="mt-gutter-md flex flex-wrap gap-gutter-sm">
          {statuses.map((s) => (
            <EnquiryStatusBadge key={s} status={s} />
          ))}
        </div>
      </Section>

      <Section title="Cards" note="Reconstructed — no card sticker sheet supplied.">
        <div className="grid gap-gutter-md md:grid-cols-3">
          <Card>
            <CardBody>
              <CardTitle>Elevated card</CardTitle>
              <p className="mt-1 text-body-md text-on-surface-variant">
                Hairline border, no drop shadow.
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Action card</CardTitle>
            </CardHeader>
            <CardBody className="text-body-md text-on-surface-variant">
              Footer holds actions.
            </CardBody>
            <CardFooter>
              <Button size="sm">Save</Button>
              <Button size="sm" variant="outline">
                Cancel
              </Button>
            </CardFooter>
          </Card>
          <InteractiveCard href="/dev/components">
            <CardTitle>Interactive card</CardTitle>
            <p className="mt-1 text-body-md text-on-surface-variant">Whole card is a link.</p>
          </InteractiveCard>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid max-w-3xl gap-gutter-md md:grid-cols-2">
          <Field label="Full name" required helper="As on your business card.">
            {(p) => <Input placeholder="Your name" {...p} />}
          </Field>
          <Field label="Search">
            {(p) => <Input icon={<Search />} placeholder="Search materials" {...p} />}
          </Field>
          <Field label="Password">
            {(p) => <Input type="password" defaultValue="secret" {...p} />}
          </Field>
          <Field label="Mobile number" required error="Enter a valid 10-digit mobile number.">
            {(p) => <Input defaultValue="123" {...p} />}
          </Field>
          <Field label="Category">
            {(p) => (
              <Select {...p}>
                <option>Select…</option>
                <option>Option A</option>
              </Select>
            )}
          </Field>
          <Field label="Disabled">
            {(p) => <Input disabled value="Read only" readOnly {...p} />}
          </Field>
          <Field label="Message" className="md:col-span-2">
            {(p) => <Textarea placeholder="Describe your requirement" {...p} />}
          </Field>
          <div className="flex flex-col gap-gutter-sm">
            <Checkbox label="In Stock" defaultChecked /> <Checkbox label="Limited Stock" />
          </div>
          <div className="flex flex-col gap-gutter-sm">
            <Radio name="sort" label="Featured first" defaultChecked />{" "}
            <Radio name="sort" label="Price: low to high" />
          </div>
        </div>
      </Section>

      <Section title="Modals & drawer">
        <div className="flex flex-wrap gap-gutter-sm">
          <Button variant="outline" onClick={() => setModal(true)}>
            Standard modal
          </Button>
          <Button variant="outline" onClick={() => setAlert(true)}>
            Alert modal
          </Button>
          <Button variant="outline" onClick={() => setDrawer(true)}>
            Drawer
          </Button>
        </div>
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="Add category"
          description="Create a product category."
          footer={
            <>
              <Button variant="outline" onClick={() => setModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModal(false)}>Create</Button>
            </>
          }
        >
          <Field label="Category name">{(p) => <Input {...p} />}</Field>
        </Modal>
        <AlertModal
          open={alert}
          onClose={() => setAlert(false)}
          onConfirm={() => setAlert(false)}
          title="Archive product?"
          description="Customers will no longer be able to browse or request a quotation for this item."
          confirmLabel="Confirm Archive"
        />
        <Drawer
          open={drawer}
          onClose={() => setDrawer(false)}
          title="Drawer"
          description="Side panel (reconstructed)."
        >
          <p className="text-body-md">Drawer content.</p>
        </Drawer>
      </Section>

      <Section title="Tables">
        <Table>
          <THead>
            <Tr>
              <Th className="w-10">
                <span className="sr-only">Select</span>
              </Th>
              <Th>Item</Th>
              <Th>Rate</Th>
              <Th>Status</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <Tr key={r.id} interactive selected={selected.includes(r.id)}>
                <Td>
                  <Checkbox
                    aria-label={`Select ${r.name}`}
                    label=""
                    checked={selected.includes(r.id)}
                    onChange={() =>
                      setSelected((s) =>
                        s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id],
                      )
                    }
                  />
                </Td>
                <Td>{r.name}</Td>
                <Td>{r.rate}</Td>
                <Td>
                  <StockBadge status="IN_STOCK" />
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section title="Tabs">
        <Tabs
          label="Settings sections"
          items={[
            {
              id: "g",
              label: "General",
              icon: <Settings />,
              content: <p>General settings panel.</p>,
            },
            { id: "c", label: "Contact", icon: <Phone />, content: <p>Contact settings panel.</p> },
            { id: "o", label: "Orders", icon: <ShoppingBag />, content: <p>Another panel.</p> },
          ]}
        />
      </Section>

      <Section title="Notifications">
        <div className="grid max-w-2xl gap-gutter-sm">
          <Notification tone="success" title="Saved">
            Product information updated.
          </Notification>
          <Notification tone="error" title="Could not save">
            Please try again.
          </Notification>
          <Notification tone="warning" title="Rates may be stale">
            Last refreshed a while ago.
          </Notification>
          <Notification tone="info">Prices are indicative and subject to change.</Notification>
        </div>
        <div className="mt-gutter-md">
          <ToastDemo />
        </div>
      </Section>

      <Section title="Loading, empty & navigation">
        <div className="flex items-center gap-gutter-md">
          <Spinner />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="mt-gutter-md grid gap-gutter-md md:grid-cols-2">
          <EmptyState
            icon={<Inbox />}
            title="No enquiries yet"
            description="New enquiries will appear here."
            action={
              <Button size="sm">
                <Plus aria-hidden className="size-4" /> Add
              </Button>
            }
          />
          <EmptyState
            tone="error"
            title="Could not load products"
            description="Please try again shortly."
          />
        </div>
        <div className="mt-gutter-md space-y-gutter-md">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Products", href: "/products" },
              { label: "Sample product" },
            ]}
          />
          <Pagination page={3} pageCount={9} hrefFor={(p) => `?page=${p}`} />
        </div>
      </Section>
    </PageContainer>
  );
}

export function Showcase() {
  return (
    <ToastProvider>
      <Body />
    </ToastProvider>
  );
}
