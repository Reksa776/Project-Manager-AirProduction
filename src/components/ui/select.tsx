import type { SelectHTMLAttributes } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  options,
  placeholder,
  className,
  id,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={selectId} className="text-xs font-medium text-ink-soft">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "h-10 w-full appearance-none rounded-lg border border-line-strong bg-white pl-3 pr-9 text-sm text-ink",
            "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20",
            "disabled:cursor-not-allowed disabled:bg-app",
            className,
          )}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevronDown"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
        />
      </div>
    </div>
  );
}
