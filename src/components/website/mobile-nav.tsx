"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { NavLink } from "@/components/common/nav-link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Drawer } from "@/components/ui/modal";
import { websiteNav } from "@/config/navigation";
import type { ReactNode } from "react";

/** Mobile navigation drawer (below `md`). Focus returns to the menu button when the dialog closes. */
export function MobileNav({ actions }: { actions?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="md:hidden"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden className="size-5" />
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Menu">
        <ButtonLink
          href="/bulk-enquiry"
          size="lg"
          className="mb-gutter-md w-full"
          onClick={() => setOpen(false)}
        >
          Get a quick quote
        </ButtonLink>
        <nav aria-label="Mobile" className="flex flex-col gap-gutter-xs text-title-md">
          {websiteNav.map((i) => (
            <NavLink
              key={i.href}
              href={i.href}
              exact={i.href === "/"}
              className="flex min-h-12 items-center rounded px-3 py-3 hover:bg-surface-muted"
              onClick={() => setOpen(false)}
            >
              {i.label}
            </NavLink>
          ))}
        </nav>
        {actions && (
          <div className="mt-gutter-lg flex flex-col gap-gutter-sm border-t border-border pt-gutter-lg">
            {actions}
          </div>
        )}
      </Drawer>
    </>
  );
}
