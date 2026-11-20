"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Link that sets `aria-current="page"` on the active route. Wrap lists of these in <Suspense> (dynamic-param routes). */
export function NavLink({
  href,
  exact = false,
  className,
  ...props
}: ComponentProps<typeof Link> & { href: string; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        className,
        "aria-[current=page]:text-primary aria-[current=page]:underline aria-[current=page]:underline-offset-4",
      )}
      {...props}
    />
  );
}
