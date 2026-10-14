export function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5 shadow-[0_2px_12px_rgba(56,36,31,0.035)] transition-shadow hover:shadow-[0_8px_24px_rgba(56,36,31,0.07)] sm:p-6">
      <p className="text-[13px] font-medium text-ink-soft">{label}</p>
      <p className="mt-5 text-[32px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-ink">
        {value}
      </p>
      {hint ? <p className="mt-3 text-[12px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}
