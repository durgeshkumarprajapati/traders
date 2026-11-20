"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form-controls";
import { Notification } from "@/components/ui/notification";
import { loginAdminAction } from "@/features/auth/actions";

export function LoginForm() {
  const searchParams = useSearchParams();
  const returnTo = searchParams?.get("returnTo") ?? undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});

    startTransition(async () => {
      const res = await loginAdminAction({
        email,
        password,
        returnTo,
      });

      if (!res.ok) {
        setGeneralError(res.error);
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        return;
      }

      // Hard redirect to ensure full session refresh and cookie ingestion across layouts
      window.location.href = res.redirectTo;
    });
  };

  return (
    <Card className="w-full shadow-none border-border">
      <CardHeader className="text-center">
        <CardTitle className="text-title-lg text-primary">Administrator Sign In</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-gutter-md">
          {generalError && (
            <Notification tone="error" title="Sign In Failed">
              {generalError}
            </Notification>
          )}

          <Field label="Email Address" required error={fieldErrors.email?.[0]}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="name@sagartraders.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                icon={<Mail aria-hidden className="size-4" />}
                required
              />
            )}
          </Field>

          <Field label="Password" required error={fieldErrors.password?.[0]}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                icon={<Lock aria-hidden className="size-4" />}
                required
              />
            )}
          </Field>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-gutter-xs"
            disabled={isPending}
          >
            {isPending ? (
              <span className="flex items-center gap-gutter-xs">
                <Spinner label="Signing in..." />
                <span>Signing in...</span>
              </span>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
