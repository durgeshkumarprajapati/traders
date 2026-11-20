import Link from "next/link";
import { Suspense } from "react";
import { LogOut, User } from "lucide-react";
import { NavLink } from "@/components/common/nav-link";
import { Button } from "@/components/ui/button";
import { adminNav } from "@/config/navigation";
import { logoutAdminAction } from "@/features/auth/actions";
import type { AdminContext } from "@/lib/auth/admin";

const linkClass =
  "rounded px-3 py-2 transition-colors hover:bg-surface-muted aria-[current=page]:bg-surface-muted";

export function AdminSidebar({ admin }: { admin?: AdminContext }) {
  return (
    <aside className="w-sidebar shrink-0 border-r border-border bg-surface p-gutter-md flex flex-col justify-between min-h-screen">
      <div>
        <p className="mb-gutter-md text-title-lg text-primary font-bold">Sagar Traders Admin</p>
        <nav aria-label="Admin" className="flex flex-col gap-gutter-xs text-label-lg">
          <Suspense
            fallback={adminNav.map((i) => (
              <Link key={i.href} href={i.href} className={linkClass}>
                {i.label}
              </Link>
            ))}
          >
            {adminNav.map((i) => (
              <NavLink key={i.href} href={i.href} className={linkClass}>
                {i.label}
              </NavLink>
            ))}
          </Suspense>
        </nav>
      </div>

      <div className="pt-gutter-md border-t border-border mt-gutter-lg flex flex-col gap-gutter-sm">
        {admin && (
          <div className="flex items-center gap-gutter-xs px-2 py-1 text-on-surface-variant">
            <User aria-hidden className="size-4 shrink-0" />
            <div className="overflow-hidden">
              <p className="text-label-md font-medium text-on-surface truncate">
                {admin.fullName || "Administrator"}
              </p>
              <p className="text-body-sm text-on-surface-variant truncate" title={admin.email}>
                {admin.email}
              </p>
            </div>
          </div>
        )}
        <form action={logoutAdminAction}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-gutter-xs text-error hover:bg-error/10 hover:text-error border-border"
          >
            <LogOut aria-hidden className="size-4" />
            Sign Out
          </Button>
        </form>
      </div>
    </aside>
  );
}
