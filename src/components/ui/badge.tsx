import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "brand";

/** Warna semantik yang tetap soft, tanpa saturasi berlebihan. */
const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-[#f5f5f5] text-[#525252] ring-[#ebebeb]",
  info: "bg-[#f2f6fd] text-[#2f5fe0] ring-[#e2eafb]",
  success: "bg-[#f1f8f3] text-[#2f6b45] ring-[#e0f0e5]",
  warning: "bg-[#fdf7ee] text-[#8a5a1e] ring-[#f5e9d5]",
  danger: "bg-[#fdf3f2] text-[#a1352b] ring-[#f6e0dd]",
  brand: "bg-brand-soft text-[#2f5fe0] ring-[#e2eafb]",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot = false,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-[3px] text-[12px] font-medium leading-none ring-1 ring-inset",
        toneClasses[tone],
        className,
      )}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
      ) : null}
      {children}
    </span>
  );
}
