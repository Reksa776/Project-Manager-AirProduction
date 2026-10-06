import { Icon, type IconName } from "@/components/icons";
import { cn } from "@/lib/utils";

export type SummaryTone = "neutral" | "warning" | "info" | "success";

const toneClasses: Record<SummaryTone, string> = {
  neutral: "bg-[#f2f4f7] text-[#475467]",
  warning: "bg-[#fffaeb] text-[#b54708]",
  info: "bg-[#eff8ff] text-[#175cd3]",
  success: "bg-[#ecfdf3] text-[#027a48]",
};

export function SummaryCard({
  label,
  value,
  icon,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: number;
  icon: IconName;
  tone?: SummaryTone;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            toneClasses[tone],
          )}
        >
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
      </div>
      {hint ? <p className="mt-3 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
