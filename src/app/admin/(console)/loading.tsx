import { Spinner } from "@/components/ui/feedback";

export default function AdminConsoleLoading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-section-sm">
      <Spinner label="Loading console view" />
    </div>
  );
}
