"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

type DialogShellProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  role?: "dialog" | "alertdialog";
  drawer?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/** Shared native-<dialog> shell: focus trap, Esc to close and inert background come from the platform. */
function DialogShell({
  open,
  onClose,
  title,
  description,
  role = "dialog",
  drawer,
  children,
  footer,
  className,
}: DialogShellProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      data-drawer={drawer ? "" : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      className={cn(
        "bg-surface p-0 text-on-surface shadow-overlay backdrop:bg-on-surface/50",
        drawer
          ? "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[min(100%,28rem)] border-l border-border"
          : "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-md border border-border",
        className,
      )}
    >
      <div className={cn("flex flex-col", drawer && "h-full")}>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-gutter-md border-b border-border bg-surface p-gutter-md">
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <h2 id={titleId} className="text-headline-sm">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-body-md text-on-surface-variant">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="-m-1 size-10 pointer-coarse:size-11"
            aria-label="Close"
            onClick={onClose}
          >
            <X aria-hidden className="size-4" />
          </Button>
        </header>
        {children && (
          <div
            className={cn(
              "p-gutter-md",
              drawer &&
                "min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]",
            )}
          >
            {children}
          </div>
        )}
        {footer && (
          <footer className="flex flex-wrap justify-end gap-gutter-sm border-t border-border p-gutter-md">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}

type ModalBase = { open: boolean; onClose: () => void; title: string; description?: string };

/** Standard modal: arbitrary content + footer actions. */
export function Modal(props: ModalBase & { children?: ReactNode; footer?: ReactNode }) {
  return <DialogShell {...props} />;
}

/** Side drawer (RECONSTRUCTED from spec `modal-drawer`; used for mobile admin nav / detail panels). */
export function Drawer(props: ModalBase & { children?: ReactNode; footer?: ReactNode }) {
  return <DialogShell {...props} drawer />;
}

/** Alert/confirm modal for destructive or irreversible actions (e.g. archive product). */
export function AlertModal({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  destructive = true,
  pending,
}: ModalBase & {
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
  pending?: boolean;
}) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      role="alertdialog"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            onClick={onConfirm}
            disabled={pending}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
