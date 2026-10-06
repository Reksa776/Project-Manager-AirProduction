import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white hover:bg-[#2559d0] focus-visible:outline-brand disabled:hover:bg-brand",
  secondary:
    "bg-white text-ink border border-line-strong hover:bg-app focus-visible:outline-brand",
  outline:
    "bg-transparent text-ink border border-line-strong hover:bg-white focus-visible:outline-brand",
  ghost:
    "bg-transparent text-ink-soft hover:bg-app hover:text-ink focus-visible:outline-brand",
  danger:
    "bg-[#dc2626] text-white hover:bg-[#b91c1c] focus-visible:outline-[#dc2626]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
