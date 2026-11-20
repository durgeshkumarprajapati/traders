import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// NOTE: real authorization is added in Phase 7. Login page will get its own
// layout (route group) at that point so it renders without the sidebar.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1">
      <AdminSidebar />
      <main id="main-content" tabIndex={-1} className="flex-1 p-page-margin outline-none">
        {children}
      </main>
    </div>
  );
}
