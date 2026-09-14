import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

import { cn } from "../../lib/cn";
import { Button } from "./button";

export type ConfirmationDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  tone?: "primary" | "danger";
  children?: ReactNode;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function ConfirmationDialog({
  cancelLabel = "Volver",
  children,
  confirmLabel = "Confirmar",
  description,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  title,
  tone = "danger",
}: ConfirmationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  const pendingRef = useRef(pending);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
    pendingRef.current = pending;
  }, [onOpenChange, pending]);

  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => cancelButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pendingRef.current) {
        event.preventDefault();
        onOpenChangeRef.current(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = focusable.at(0);
      const last = focusable.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar confirmación"
        className="absolute inset-0 bg-ink-950/60 backdrop-blur-[2px]"
        disabled={pending}
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative w-full max-w-lg rounded-2xl border border-ink-100 bg-white p-5 shadow-lifted sm:p-6"
      >
        <button
          type="button"
          aria-label="Cerrar diálogo"
          className="absolute right-3 top-3 grid size-10 place-items-center rounded-xl text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50"
          disabled={pending}
          onClick={() => onOpenChange(false)}
        >
          <X aria-hidden="true" className="size-5" />
        </button>
        <div className="flex gap-3 pr-9">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full",
              tone === "danger"
                ? "bg-coral-100 text-coral-700"
                : "bg-brand-100 text-brand-800",
            )}
          >
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <h2 id={titleId} className="font-display text-xl font-bold text-ink-950">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm leading-6 text-ink-600">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={cancelButtonRef}
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            disabled={pending}
            aria-busy={pending}
            onClick={onConfirm}
          >
            {pending ? "Procesando…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
