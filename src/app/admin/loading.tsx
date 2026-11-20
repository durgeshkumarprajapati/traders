import { Spinner } from "@/components/ui/feedback";

export default function AdminLoading() {
  return (
    <div className="p-section-sm">
      <Spinner label="Loading admin page" />
    </div>
  );
}
