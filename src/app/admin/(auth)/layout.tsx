import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { getAuthenticatedAdmin } from "@/lib/auth/admin";

export default async function AdminAuthLayout({ children }: { children: ReactNode }) {
  await connection();

  // If already authenticated and active admin, redirect to console
  const admin = await getAuthenticatedAdmin();
  if (admin) {
    redirect("/admin/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-gutter-md">
      <div className="w-full max-w-md">
        <div className="mb-gutter-lg text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-gutter-xs text-label-md text-on-surface-variant hover:text-primary transition-colors"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back to Sagar Traders
          </Link>
          <h1 className="mt-gutter-md text-headline-sm font-bold text-primary">
            Sagar Traders Admin
          </h1>
          <p className="mt-gutter-xs text-body-md text-on-surface-variant">
            Sign in to access the administrator console
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
