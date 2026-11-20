import Link from "next/link";
import { Suspense } from "react";
import { NavLink } from "@/components/common/nav-link";
import { adminNav } from "@/config/navigation";

const linkClass =
  "rounded px-3 py-2 transition-colors hover:bg-surface-muted aria-[current=page]:bg-surface-muted";

export function AdminSidebar() {
  return (
    <aside className="w-sidebar shrink-0 border-r border-border bg-surface p-gutter-md">
      <p className="mb-gutter-md text-title-lg text-primary">Sagar Traders Admin</p>
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
    </aside>
  );
}
