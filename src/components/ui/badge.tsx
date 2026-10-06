import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "brand";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-[#f2f4f7] text-[#475467] ring-[#e4e7ec]",
  info: "bg-[#eff8ff] text-[#175cd3] ring-[#d1e9ff]",
  success: "bg-[#ecfdf3] text-[#027a48] ring-[#d1fadf]",
  warning: "bg-[#fffaeb] text-[#b54708] ring-[#fedf89]",
  danger: "bg-[#fef3f2] text-[#b42318] ring-[#fee4e2]",
  brand: "bg-brand-soft text-[#1d4ed8] ring-[#d1e0fb]",
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClasses[tone],
        className,
      )}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      ) : null}
      {children}
    </span>
  );
}
