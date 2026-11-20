import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { requireAdminSession } from "@/lib/auth/admin";
import { AdminAccount, AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";

export default async function AdminConsoleLayout({ children }: { children: ReactNode }) {
  await connection();
  const admin = await requireAdminSession();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Suspense fallback={null}>
        <AdminMobileNav footer={<AdminAccount admin={admin} />} />
      </Suspense>
      <AdminSidebar admin={admin} />
      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 flex-1 p-gutter-md outline-none sm:p-page-margin"
      >
        {children}
      </main>
    </div>
  );
}
