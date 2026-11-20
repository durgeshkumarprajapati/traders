import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/common/container";
import { Skeleton } from "@/components/ui/feedback";
import { ContactContent } from "@/components/website/contact-content";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact details and general enquiry form.",
};

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="space-y-gutter-md py-section-md" aria-busy="true">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-96 w-full" />
        </PageContainer>
      }
    >
      <ContactContent />
    </Suspense>
  );
}
