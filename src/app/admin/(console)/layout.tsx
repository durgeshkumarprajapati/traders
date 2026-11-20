import type { ReactNode } from "react";
import { connection } from "next/server";
import { requireAdminSession } from "@/lib/auth/admin";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default async function AdminConsoleLayout({ children }: { children: ReactNode }) {
  await connection();
  const admin = await requireAdminSession();

  return (
    <div className="flex min-h-screen">
      <AdminSidebar admin={admin} />
      <main id="main-content" tabIndex={-1} className="flex-1 p-page-margin outline-none">
        {children}
      </main>
    </div>
  );
}
