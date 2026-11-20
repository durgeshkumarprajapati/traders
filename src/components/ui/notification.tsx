"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export type NotificationTone = "success" | "error" | "warning" | "info";

const toneStyle: Record<NotificationTone, { icon: typeof Info; accent: string; text: string }> = {
  success: { icon: CircleCheck, accent: "border-l-success", text: "text-success" },
  error: { icon: CircleAlert, accent: "border-l-error", text: "text-error" },
  warning: { icon: TriangleAlert, accent: "border-l-warning", text: "text-warning" },
  info: { icon: Info, accent: "border-l-info", text: "text-info" },
};

/** RECONSTRUCTED: only a success toast exists in Stitch; other tones follow the same pattern. White surface, tone-coloured accent + icon, black text. */
export function Notification({
  tone,
  title,
  children,
  onDismiss,
  className,
  ...props
}: Omit<ComponentProps<"div">, "title"> & {
  tone: NotificationTone;
  title?: string;
  onDismiss?: () => void;
}) {
  const { icon: Icon, accent, text } = toneStyle[tone];
  return (
    <div
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-gutter-sm rounded border border-l-4 border-border bg-surface p-gutter-md",
        accent,
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", text)} />
      <div className="flex-1 text-body-md">
        {title && <p className="text-title-md">{title}</p>}
        {children && (
          <div className={cn(title && "mt-0.5 text-on-surface-variant")}>{children}</div>
        )}
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="-m-1 size-7"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <X aria-hidden className="size-4" />
        </Button>
      )}
    </div>
  );
}

type Toast = { id: number; tone: NotificationTone; message: string };
const ToastContext = createContext<{
  notify: (tone: NotificationTone, message: string) => void;
} | null>(null);

/** Mount once in a layout that needs toasts (admin). Toasts auto-dismiss after 5s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (tone: NotificationTone, message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, tone, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );
  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        className="fixed right-gutter-md bottom-gutter-md z-50 flex w-full max-w-sm flex-col gap-gutter-sm"
      >
        {toasts.map((t) => (
          <Notification
            key={t.id}
            tone={t.tone}
            onDismiss={() => dismiss(t.id)}
            className="shadow-overlay"
          >
            {t.message}
          </Notification>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
