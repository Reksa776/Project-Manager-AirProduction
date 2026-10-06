import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
}

export function Input({
  label,
  hint,
  error,
  leading,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-ink-soft"
        >
          {label}
        </label>
      ) : null}
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
            {leading}
          </span>
        ) : null}
        <input
          id={inputId}
          className={cn(
            "h-10 w-full rounded-lg border border-line-strong bg-white px-3 text-sm text-ink",
            "placeholder:text-ink-muted",
            "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
            "disabled:cursor-not-allowed disabled:bg-app",
            leading ? "pl-9" : null,
            error && "border-[#f04438] focus:ring-[#f04438]/20",
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-xs text-[#b42318]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
