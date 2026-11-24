"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { NavLink } from "@/components/common/nav-link";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/modal";
import { adminNav } from "@/config/navigation";

const linkClass =
  "flex min-h-11 items-center rounded px-3 py-2 text-label-lg transition-colors hover:bg-surface-muted aria-[current=page]:bg-surface-muted aria-[current=page]:font-bold";

/**
 * Admin navigation below `lg`: a sticky top bar with a menu button that opens the same navigation in a
 * drawer. The drawer closes after navigating, on Escape (native <dialog>) and on backdrop click; focus is
 * trapped while open and returns to the menu button. `footer` (account + sign-out) is server-rendered.
 */
export function AdminMobileNav({ footer }: { footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-gutter-md border-b border-border bg-surface px-gutter-md lg:hidden print:hidden">
      <Link
        href="/admin/dashboard"
        className="min-w-0 truncate text-title-lg font-bold text-primary"
      >
        Sagar Traders Admin
      </Link>
      <Button
        variant="outline"
        size="icon"
        aria-label="Open admin menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden className="size-5" />
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Admin menu">
        <nav aria-label="Admin mobile" className="flex flex-col gap-gutter-xs">
          {adminNav.map((i) => (
            <NavLink
              key={i.href}
              href={i.href}
              className={linkClass}
              onClick={() => setOpen(false)}
            >
              {i.label}
            </NavLink>
          ))}
        </nav>
        {footer && open && (
          <div className="mt-gutter-lg flex flex-col gap-gutter-sm border-t border-border pt-gutter-md">
            {footer}
          </div>
        )}
      </Drawer>
    </div>
  );
}
