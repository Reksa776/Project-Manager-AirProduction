"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface DropdownItem {
  label: string;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}

export function Dropdown({ trigger, items, align = "right" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <div
        onClick={() => setOpen((value) => !value)}
        className="contents"
        role="presentation"
      >
        {trigger}
      </div>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-40 mt-1 min-w-44 overflow-hidden rounded-lg border border-line bg-panel py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onSelect?.();
                setOpen(false);
              }}
              className={cn(
                "block w-full px-3.5 py-2 text-left text-sm transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50",
                item.danger
                  ? "text-[#b42318] hover:bg-[#fef3f2]"
                  : "text-ink-soft hover:bg-app hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
