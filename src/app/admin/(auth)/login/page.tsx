import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/login-form";
import { Spinner } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Admin Sign In | Sagar Traders",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-gutter-lg">
          <Spinner label="Loading sign-in..." />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
