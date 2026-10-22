import { Card } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

export interface ReceivableSummaryData {
  outstanding: string;
  unpaid: number;
  partiallyPaid: number;
  overdue: number;
}

function SummaryCard({
  title,
  description,
  data,
  tone,
}: {
  title: string;
  description: string;
  data: ReceivableSummaryData;
  tone: "blue" | "violet";
}) {
  const accent = tone === "blue" ? "text-[#3978c5]" : "text-[#7454a6]";
  return (
    <Card className="min-w-0 overflow-hidden border border-line bg-white shadow-[0_2px_12px_rgba(27,39,57,0.045)]">
      <div className={`h-1 ${tone === "blue" ? "bg-[#3978c5]" : "bg-[#9274bd]"}`} />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <p className="mt-1 text-xs text-ink-muted">{description}</p>
          </div>
          <span className={`text-lg leading-none ${accent}`} aria-hidden="true">↗</span>
        </div>

        <p className="mt-5 break-words text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
          {formatCurrency(data.outstanding)}
        </p>
        <p className="mt-1 text-xs text-ink-muted">Total sisa pembayaran</p>

        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 sm:gap-3">
          <Metric label="Belum bayar" value={data.unpaid} tone="amber" />
          <Metric label="Sebagian" value={data.partiallyPaid} tone="blue" />
          <Metric label="Terlambat" value={data.overdue} tone="rose" />
        </div>
      </div>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "amber" | "blue" | "rose" }) {
  const toneClass = {
    amber: "text-[#b7791f]",
    blue: "text-[#3978c5]",
    rose: "text-[#bd5264]",
  }[tone];
  return (
    <div className="min-w-0">
      <p className={`text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
      <p className="break-words text-[10px] leading-4 text-ink-soft sm:text-xs">{label}</p>
    </div>
  );
}

export function ReceivableSummary({
  receivables,
  payables,
}: {
  receivables: ReceivableSummaryData;
  payables: ReceivableSummaryData;
}) {
  return (
    <section aria-label="Ringkasan piutang dan utang" className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
      <SummaryCard title="Piutang Usaha" description="Pembayaran yang masih perlu diterima dari klien." data={receivables} tone="blue" />
      <SummaryCard title="Utang Usaha" description="Pembayaran yang masih perlu diselesaikan ke vendor." data={payables} tone="violet" />
    </section>
  );
}
