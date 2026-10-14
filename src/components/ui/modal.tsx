"use client";

import { useEffect, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/20 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-lg",
          sizeClasses[size],
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6 sm:py-5">
          <div className="space-y-1">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
              {title}
            </h2>
            {description ? (
              <p className="text-[13px] text-ink-soft">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-app hover:text-ink"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {children ? <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div> : null}

        {footer ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-4 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
