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
    "bg-ink text-white hover:bg-[#2e2e2e] focus-visible:outline-ink disabled:hover:bg-ink",
  secondary:
    "border border-line bg-panel text-ink hover:bg-app focus-visible:outline-ink",
  outline:
    "border border-line bg-transparent text-ink hover:bg-panel focus-visible:outline-ink",
  ghost:
    "bg-transparent text-ink-soft hover:bg-app hover:text-ink focus-visible:outline-ink",
  danger:
    "bg-[#b42318] text-white hover:bg-[#972018] focus-visible:outline-[#b42318]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-9 gap-2 px-3.5 text-sm",
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
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-45",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
