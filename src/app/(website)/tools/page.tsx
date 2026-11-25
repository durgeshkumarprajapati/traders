import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeading } from "@/components/common/container";
import { Breadcrumbs } from "@/components/ui/navigation-aids";

export const metadata: Metadata = {
  title: "Construction Tools & Planning",
  description:
    "Free tools from Sagar Traders: material calculator, project planner, product comparison, saved material lists, delivery area check, rate alerts and a materials expert.",
  alternates: { canonical: "/tools" },
};

const TOOLS = [
  {
    href: "/tools/cost-estimator",
    title: "Project cost & material estimator",
    text: "Enter simple room, wall, or floor measurements in feet to estimate materials and indicative costs.",
  },
  {
    href: "/tools/material-calculator",
    title: "Material calculator",
    text: "Estimate concrete, cement, sand, aggregate, bricks, blocks and preliminary steel. Every formula is shown.",
  },
  {
    href: "/tools/project-planner",
    title: "Project planner",
    text: "Keep several projects and their material lists on this device, then send one as an enquiry.",
  },
  {
    href: "/compare",
    title: "Compare products",
    text: "Put up to three products side by side. Missing details are shown as “Not specified”.",
  },
  {
    href: "/my-material-lists",
    title: "My material lists",
    text: "Saved lists on this device, refreshed with current listed rates and availability.",
  },
  {
    href: "/delivery-check",
    title: "Delivery area check",
    text: "See whether your PIN code is in our listed area and ask about freight. Delivery is never guaranteed online.",
  },
  {
    href: "/ask-expert",
    title: "Ask a materials expert",
    text: "Send a question to our team. A person replies; nothing is answered automatically.",
  },
  {
    href: "/rate-alerts",
    title: "Rate alerts",
    text: "Get an email when a product's listed rate changes (when available).",
  },
] as const;

export default function ToolsPage() {
  return (
    <PageContainer className="pb-section-lg">
      <div className="pt-gutter-lg">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Tools" }]} />
      </div>
      <PageHeading
        title="Construction tools & planning"
        description="Planning aids for your project. Estimates are approximate and rates are indicative; Sagar Traders confirms prices and availability when you enquire."
      />
      <ul className="grid grid-cols-1 gap-gutter-md sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="block h-full rounded-md border border-border bg-surface p-gutter-md transition-colors hover:border-primary focus-visible:outline-2"
            >
              <h2 className="text-title-lg font-bold text-primary">{t.title}</h2>
              <p className="mt-1 text-body-md text-on-surface-variant">{t.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
