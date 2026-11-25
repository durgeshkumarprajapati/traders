import Link from "next/link";
import { HardHat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listContractors } from "@/features/contractors/server/contractors";

export const metadata = {
  title: "Contractor Programme | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminContractorsPage() {
  const contractors = await listContractors();

  return (
    <div className="space-y-gutter-lg">
      <div className="flex flex-wrap items-center justify-between gap-gutter-md">
        <div>
          <h1 className="text-headline-lg text-primary">
            Contractor &amp; Builder Relationship Programme
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Internal relationship management for repeat contractors, builders, and architects.
          </p>
        </div>
        <ButtonLink href="/admin/customers" variant="outline">
          All CRM Customers
        </ButtonLink>
      </div>

      {contractors.length === 0 ? (
        <Card className="p-gutter-xl text-center">
          <HardHat aria-hidden className="mx-auto size-8 text-on-surface-variant" />
          <p className="mt-2 text-title-md text-on-surface">No contractor profiles yet</p>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Mark any customer in CRM as a Contractor / Builder Programme member to manage their
            preferred material lists and commercial terms here.
          </p>
        </Card>
      ) : (
        <div className="space-y-gutter-sm">
          {contractors.map((c) => (
            <Card key={c.id} className="p-gutter-md">
              <div className="flex flex-wrap items-center justify-between gap-gutter-md">
                <div>
                  <div className="flex flex-wrap items-center gap-gutter-xs">
                    <Link
                      href={`/admin/contractors/${c.id}`}
                      className="text-title-lg font-semibold text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                    <Badge tone="info">{c.relationshipTier}</Badge>
                    <Badge tone={c.programmeStatus === "ACTIVE" ? "success" : "neutral"}>
                      {c.programmeStatus}
                    </Badge>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">
                    +91 {c.mobile}
                    {c.companyName ? ` • ${c.companyName}` : ""}
                    {c.serviceArea ? ` • Area: ${c.serviceArea}` : ""}
                  </p>
                </div>
                <ButtonLink href={`/admin/contractors/${c.id}`} variant="outline" size="sm">
                  Manage Programme
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
