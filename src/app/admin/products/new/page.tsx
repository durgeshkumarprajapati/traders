import { PlaceholderPage, placeholderMetadata } from "@/components/common/placeholder-page";

export const metadata = placeholderMetadata("New product");

export default function Page() {
  return <PlaceholderPage title="New product" description="Create a product." phase="Phase 9" />;
}
