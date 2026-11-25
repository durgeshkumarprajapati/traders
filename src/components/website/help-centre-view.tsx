"use client";

import { useState } from "react";
import Link from "next/link";
import { Compass, HelpCircle, Search } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form-controls";
import { t } from "@/features/i18n/dictionary";
import { useLocale } from "@/features/i18n/store";
import { tourStore } from "@/features/tours/store";

interface FaqItem {
  category: string;
  question: string;
  answer: string;
  href?: string;
  hrefLabel?: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    category: "Searching & Prices",
    question: "How do I search for building materials like cement, steel, or bricks?",
    answer:
      "Go to Products and type the English or local name (such as sariya, eent, reti, or cement). You can also use Voice Search if your browser supports it.",
    href: "/products",
    hrefLabel: "Browse Products",
  },
  {
    category: "Searching & Prices",
    question: "How do I check the latest price if a product says Rate on Request?",
    answer:
      "Open the product page, choose 'Latest price', enter your quantity, and click WhatsApp enquiry or Request Callback. Our team will share today's confirmed rate.",
    href: "/products",
    hrefLabel: "Open Product Catalogue",
  },
  {
    category: "Calculators & Planning",
    question: "How do I calculate approximately how much material I need for a room or wall?",
    answer:
      "Open our Project Cost & Material Estimator, select Room, Wall, or Floor, and enter your measurements in feet. It shows an approximate breakdown with wastage.",
    href: "/tools/cost-estimator",
    hrefLabel: "Open Cost Estimator",
  },
  {
    category: "Calculators & Planning",
    question: "What is the Project Material Planner?",
    answer:
      "The Project Planner lets you combine multiple calculated items into one list and send it directly to Sagar Traders for a quotation.",
    href: "/tools/project-planner",
    hrefLabel: "Open Project Planner",
  },
  {
    category: "Enquiries & Quotations",
    question: "How do I create a Bulk Enquiry for multiple materials?",
    answer:
      "Click 'Add to enquiry list' on any product, then visit Bulk Enquiry to review your list, enter your delivery location, and submit one combined request.",
    href: "/bulk-enquiry",
    hrefLabel: "Go to Bulk Enquiry",
  },
  {
    category: "Enquiries & Quotations",
    question: "How do I accept or request changes on a Quotation?",
    answer:
      "Open the secure quotation link sent to you by Sagar Traders. Review the items and total, download the PDF if needed, and click Accept Quotation or Request Changes.",
    href: "/track-enquiry",
    hrefLabel: "Track Enquiry",
  },
  {
    category: "Delivery & Orders",
    question: "How do I check if delivery is available to my site?",
    answer:
      "Use the Delivery Coverage check page to submit your town/site area and material requirements, or call our team directly.",
    href: "/delivery-check",
    hrefLabel: "Check Delivery Coverage",
  },
  {
    category: "Delivery & Orders",
    question: "How do I track my order and confirm delivery?",
    answer:
      "Open the secure order tracking link shared with you. You can see the live stage, expected delivery date, confirm delivery, or report an issue.",
    href: "/track-enquiry",
    hrefLabel: "Track Enquiry / Order",
  },
  {
    category: "Delivery & Orders",
    question: "How do I reorder materials from a previous order?",
    answer:
      "Open your previous order tracking link and click 'Reorder These Materials' to load those items into a fresh enquiry with current catalogue rates.",
  },
  {
    category: "Support",
    question: "How can I contact Sagar Traders directly?",
    answer:
      "You can call us, send a WhatsApp message, or request a callback from the Contact page or header bar.",
    href: "/contact",
    hrefLabel: "Contact Sagar Traders",
  },
];

export function HelpCentreView() {
  const locale = useLocale();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? FAQ_ITEMS.filter(
        (f) =>
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q),
      )
    : FAQ_ITEMS;

  return (
    <div className="space-y-gutter-lg">
      <div className="flex flex-wrap items-center justify-between gap-gutter-md">
        <div>
          <h1 className="text-headline-xl text-primary">{t(locale, "help.title")}</h1>
          <p className="mt-1 text-body-lg text-on-surface-variant">{t(locale, "help.subtitle")}</p>
        </div>
        <Button type="button" size="md" onClick={() => tourStore.start("welcome-overview")}>
          <Compass aria-hidden className="size-4" />
          {t(locale, "controls.takeTour")}
        </Button>
      </div>

      <Card className="p-gutter-md">
        <div className="relative">
          <Input
            icon={<Search />}
            type="search"
            aria-label="Search FAQs"
            placeholder={t(locale, "help.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-gutter-xl text-center">
          <HelpCircle aria-hidden className="mx-auto size-8 text-on-surface-variant" />
          <p className="mt-2 text-title-md text-on-surface">No matching questions found</p>
          <div className="mt-3">
            <ButtonLink href="/contact" variant="outline">
              Contact Our Team
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <div className="space-y-gutter-sm">
          {filtered.map((item) => (
            <Card key={item.question} className="p-gutter-md space-y-2">
              <p className="text-label-sm font-semibold text-secondary">{item.category}</p>
              <h2 className="text-title-lg font-bold text-primary">{item.question}</h2>
              <p className="text-body-md text-on-surface">{item.answer}</p>
              {item.href && (
                <Link
                  href={item.href}
                  className="inline-block text-label-md font-semibold text-primary hover:underline"
                >
                  {item.hrefLabel ?? "Open"} →
                </Link>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
