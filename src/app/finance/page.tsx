import { PageHeader } from "@/components/ui";
import { AppShell } from "@/components/layout/app-shell";
import { FinanceCrud } from "@/components/finance/finance-crud";
import { ReceivableSummary, type ReceivableSummaryData } from "@/components/finance/receivable-summary";
import {
  CASHFLOW_CATEGORY_LABEL,
  CASHFLOW_DIRECTION_LABEL,
  CLIENT_PAYMENT_TERM_LABEL,
  GENERAL_EXPENSE_CATEGORIES,
  PAYMENT_STATUS_LABEL,
} from "@/lib/labels";
import {
  recordClientPaymentAction,
  recordExpenseAction,
  recordVendorPaymentAction,
} from "@/app/actions/finance-actions";
import { getJobListItems, getFinanceOverview } from "@/services/job-service";
import { formatCurrency } from "@/lib/utils";
import { sumAmounts, subtractAmounts, compareAmounts } from "@/domain/money";
import type { ClientScheduleView, VendorScheduleView } from "@/services/types";
import { requireAuthenticatedAdmin } from "@/lib/auth";

export const metadata = {
  title: "Finance · Air Production DB",
};

// Data MySQL dibaca saat runtime; tidak diprerender statis.
export const dynamic = "force-dynamic";

const EXPENSE_CATEGORY_OPTIONS = GENERAL_EXPENSE_CATEGORIES.map((value) => ({
  value,
  label: CASHFLOW_CATEGORY_LABEL[value],
}));

function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildPaymentSummary(
  schedules: Array<ClientScheduleView | VendorScheduleView>,
): ReceivableSummaryData {
  const today = jakartaToday();
  const outstandingAmounts = schedules.map((schedule) => {
    const remaining = subtractAmounts(schedule.amount, schedule.paidAmount);
    return remaining.startsWith("-") ? "0.00" : remaining;
  });

  return {
    outstanding: sumAmounts(outstandingAmounts),
    unpaid: schedules.filter((schedule) => schedule.status === "UNPAID").length,
    partiallyPaid: schedules.filter((schedule) => schedule.status === "PARTIAL").length,
    overdue: schedules.filter(
      (schedule) => schedule.status !== "PAID" && Boolean(schedule.dueDate) && schedule.dueDate! < today,
    ).length,
  };
}

export default async function FinancePage() {
  const admin = await requireAuthenticatedAdmin();
  const [overview, jobs] = await Promise.all([getFinanceOverview(), getJobListItems()]);

  const jobOptions = jobs.map((job) => ({
    value: job.id,
    label: `${job.jobNumber} — ${job.jobName}`,
  }));
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  const clientScheduleRows = overview.clientSchedules.map((schedule) => ({
    id: schedule.id,
    jobId: schedule.jobId,
    term: schedule.term,
    termLabel: CLIENT_PAYMENT_TERM_LABEL[schedule.term],
    amount: schedule.amount,
    amountLabel: formatCurrency(schedule.amount),
    paidLabel: formatCurrency(schedule.paidAmount),
    dueDate: schedule.dueDate ?? "",
    statusLabel: PAYMENT_STATUS_LABEL[schedule.status],
    notes: schedule.notes ?? "",
  }));

  const cashRows = overview.cashflows.map((flow) => ({
    id: flow.id,
    occurredOn: flow.occurredOn,
    directionLabel: CASHFLOW_DIRECTION_LABEL[flow.direction],
    categoryLabel: CASHFLOW_CATEGORY_LABEL[flow.category],
    description: flow.description,
    amountLabel: formatCurrency(flow.amount),
    jobLabel: flow.jobLabel,
  }));

  const clientScheduleAmounts: Record<string, string> = {};
  const clientScheduleOptions = overview.clientSchedules.flatMap((schedule) => {
    const job = jobById.get(schedule.jobId);
    if (!job || compareAmounts(schedule.amount, schedule.paidAmount) <= 0) return [];
    const remaining = subtractAmounts(schedule.amount, schedule.paidAmount);
    clientScheduleAmounts[schedule.id] = remaining;
    return [{ value: schedule.id, label: `${job.counterparty.name} · ${job.jobName} · ${CLIENT_PAYMENT_TERM_LABEL[schedule.term]} · ${formatCurrency(remaining)}` }];
  });

  const vendorScheduleAmounts: Record<string, string> = {};
  const vendorScheduleOptions = overview.vendorSchedules.flatMap((schedule) => {
    const job = jobById.get(schedule.jobId);
    if (!job || compareAmounts(schedule.amount, schedule.paidAmount) <= 0) return [];
    const remaining = subtractAmounts(schedule.amount, schedule.paidAmount);
    vendorScheduleAmounts[schedule.id] = remaining;
    return [{ value: schedule.id, label: `${job.counterparty.name} · ${job.jobName} · ${schedule.notes ?? schedule.type} · ${formatCurrency(remaining)}` }];
  });

  return (
    <AppShell adminName={admin.name}>
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Billing schedules and actual cash movements. Payment status is calculated from recorded cash, not stored separately."
        actions={<a href="/api/reports/finance" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#1a73e8] px-3 text-sm font-medium text-[#1967d2] transition-colors hover:bg-[#e8f0fe]"><span aria-hidden="true">↓</span> Download Excel</a>}
      />

      <ReceivableSummary
        receivables={buildPaymentSummary(overview.clientSchedules)}
      />

      {/* Automatically generated client obligations, read-only here. */}
      <FinanceCrud
        title="Client Billing Schedule"
        description="Schedule dibuat otomatis saat job disimpan: DP minimal 10%, pembayaran kedua 40%, pelunasan pada H+3."
        entityLabel="Client Schedule"
        columns={[
          { key: "termLabel", label: "Installment" },
          { key: "amountLabel", label: "Scheduled Amount" },
          { key: "paidLabel", label: "Paid" },
          { key: "dueDate", label: "Due Date" },
          { key: "statusLabel", label: "Status" },
        ]}
        rows={clientScheduleRows}
        fields={[]}
        totals={[
          { label: "Total Client Obligation", value: formatCurrency(
            overview.clientSchedules.reduce((sum, s) => sum + Number(s.amount), 0),
          ) },
        ]}
      />

      {/* Actual cash: create-only, idempotent, no edit/delete (canonical cashflow) */}
      <FinanceCrud
        title="Record Client Billing Payment"
        description="Record actual client payments. The database prevents duplicate entries; cash records cannot be edited or deleted."
        entityLabel="Client Payment"
        columns={[{ key: "occurredOn", label: "Date" }]}
        rows={[]}
        fields={[
          { key: "scheduleId", label: "Client / Job / Termin", type: "select", options: clientScheduleOptions, amountByOption: clientScheduleAmounts, placeholder: "-- Select Schedule --" },
          { key: "amount", label: "Amount", type: "number", hint: "Terisi otomatis dari schedule; ubah jika DP client dibayar lebih besar." },
          { key: "occurredOn", label: "Date", type: "date" },
          { key: "description", label: "Description (optional)" },
          { key: "idempotencyKey", label: "Idempotency Key", type: "hidden", autoKey: true },
        ]}
        createAction={recordClientPaymentAction}
      />

      <FinanceCrud
        title="Vendor Billing Payment"
        description="Record actual vendor payments. Cash records cannot be edited or deleted."
        entityLabel="Vendor Payment"
        columns={[{ key: "occurredOn", label: "Date" }]}
        rows={[]}
        fields={[
          { key: "scheduleId", label: "Vendor / Job / Termin", type: "select", options: vendorScheduleOptions, amountByOption: vendorScheduleAmounts, placeholder: "-- Select Schedule --" },
          { key: "amount", label: "Amount (sisa tagihan)", type: "number", readOnly: true, hint: "Terisi otomatis dari sisa schedule yang dipilih." },
          { key: "occurredOn", label: "Date", type: "date" },
          { key: "description", label: "Description (optional)" },
          { key: "idempotencyKey", label: "Idempotency Key", type: "hidden", autoKey: true },
        ]}
        createAction={recordVendorPaymentAction}
      />

      <FinanceCrud
        title="Operating Expenses"
        description="Catat beban (internet, listrik, gaji, sewa), peralatan, dan perlengkapan. Job bersifat opsional."
        entityLabel="Expense"
        columns={[{ key: "occurredOn", label: "Date" }]}
        rows={[]}
        fields={[
          { key: "jobId", label: "Job (optional)", type: "select", options: [{ value: "", label: "-- Tanpa Job --" }, ...jobOptions] },
          { key: "category", label: "Kategori", type: "select", options: EXPENSE_CATEGORY_OPTIONS, defaultValue: "INTERNET" },
          { key: "description", label: "Keterangan" },
          { key: "amount", label: "Nominal", type: "number", hint: "Contoh: 250000" },
          { key: "occurredOn", label: "Tanggal", type: "date" },
          { key: "idempotencyKey", label: "Idempotency Key", type: "hidden", autoKey: true },
        ]}
        createAction={recordExpenseAction}
      />

      {/* Read-only cash ledger */}
      <FinanceCrud
        title="Cashflow"
        description="All recorded cash movements. This is the source of truth for money and cannot be edited from the UI."
        entityLabel="Cashflow"
        columns={[
          { key: "occurredOn", label: "Date" },
          { key: "directionLabel", label: "Direction" },
          { key: "categoryLabel", label: "Category" },
          { key: "jobLabel", label: "Job" },
          { key: "description", label: "Description" },
          { key: "amountLabel", label: "Amount" },
        ]}
        rows={cashRows}
        fields={[]}
        filter={{
          key: "directionLabel",
          options: [
            { value: "Income", label: "Income" },
            { value: "Expense", label: "Expense" },
          ],
        }}
        totals={[
          { label: "Income", value: formatCurrency(overview.totals.income) },
          { label: "Expense", value: formatCurrency(overview.totals.expense) },
          { label: "Net", value: formatCurrency(overview.totals.net) },
        ]}
      />
    </div>
    </AppShell>
  );
}
