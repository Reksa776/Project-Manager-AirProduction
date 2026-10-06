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
    <div className="rounded-xl border border-line bg-panel p-6 shadow-sm">
      <p className="text-[13px] font-medium text-ink-soft">{label}</p>
      <p className="mt-4 text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink">
        {value}
      </p>
      {hint ? <p className="mt-3 text-[12px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}
