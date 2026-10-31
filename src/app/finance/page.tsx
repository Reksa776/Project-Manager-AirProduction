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
import { compareAmounts, sumAmounts, subtractAmounts } from "@/domain/money";
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
  const remainingAmount = (amount: string, paidAmount: string) =>
    compareAmounts(amount, paidAmount) <= 0 ? "0.00" : subtractAmounts(amount, paidAmount);

  const clientScheduleRows = overview.clientSchedules.map((schedule) => ({
    id: schedule.id,
    clientName: jobById.get(schedule.jobId)?.counterparty.name ?? "Client tidak dikenal",
    jobLabel: jobById.get(schedule.jobId)?.jobName ?? "Job tidak dikenal",
    termLabel: CLIENT_PAYMENT_TERM_LABEL[schedule.term],
    amountLabel: formatCurrency(schedule.amount),
    paidLabel: formatCurrency(schedule.paidAmount),
    remainingLabel: formatCurrency(remainingAmount(schedule.amount, schedule.paidAmount)),
    dueDate: schedule.dueDate ?? "",
    statusLabel: PAYMENT_STATUS_LABEL[schedule.status],
  }));

  const vendorScheduleRows = overview.vendorSchedules.map((schedule) => ({
    id: schedule.id,
    vendorName: jobById.get(schedule.jobId)?.counterparty.name ?? "Vendor tidak dikenal",
    jobLabel: jobById.get(schedule.jobId)?.jobName ?? "Job tidak dikenal",
    termLabel: schedule.notes ?? schedule.type,
    amountLabel: formatCurrency(schedule.amount),
    paidLabel: formatCurrency(schedule.paidAmount),
    remainingLabel: formatCurrency(remainingAmount(schedule.amount, schedule.paidAmount)),
    dueDate: schedule.dueDate ?? "",
    statusLabel: PAYMENT_STATUS_LABEL[schedule.status],
  }));

  const clientPaymentDefaultsByRow = Object.fromEntries(overview.clientSchedules
    .filter((schedule) => compareAmounts(schedule.amount, schedule.paidAmount) > 0)
    .map((schedule) => [schedule.id, {
      scheduleId: schedule.id,
      amount: remainingAmount(schedule.amount, schedule.paidAmount),
      occurredOn: jakartaToday(),
      description: `${CLIENT_PAYMENT_TERM_LABEL[schedule.term]} payment`,
    }]));
  const vendorPaymentDefaultsByRow = Object.fromEntries(overview.vendorSchedules
    .filter((schedule) => compareAmounts(schedule.amount, schedule.paidAmount) > 0)
    .map((schedule) => [schedule.id, {
      scheduleId: schedule.id,
      amount: remainingAmount(schedule.amount, schedule.paidAmount),
      occurredOn: jakartaToday(),
      description: schedule.notes ?? schedule.type,
    }]));
  const paymentFields = [
    { key: "scheduleId", label: "Schedule", type: "hidden" as const },
    { key: "amount", label: "Payment Amount", type: "number" as const, hint: "Amount is prefilled with the remaining balance. You can change it for a partial payment." },
    { key: "occurredOn", label: "Payment Date", type: "date" as const },
    { key: "description", label: "Description (optional)" },
    { key: "idempotencyKey", label: "Idempotency Key", type: "hidden" as const, autoKey: true },
  ];

  const cashRows = overview.cashflows.map((flow) => ({
    id: flow.id,
    occurredOn: flow.occurredOn,
    directionLabel: CASHFLOW_DIRECTION_LABEL[flow.direction],
    categoryLabel: CASHFLOW_CATEGORY_LABEL[flow.category],
    description: flow.description,
    amountLabel: formatCurrency(flow.amount),
    jobLabel: flow.jobLabel,
  }));

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

      {/* Billing schedules are generated by job creation and read-only here. */}
      <FinanceCrud
        title="Client Billing Schedule"
        description="Jadwal dibuat otomatis dari job. Catat pembayaran langsung pada termin yang dibayar."
        entityLabel="Client Schedule"
        columns={[
          { key: "clientName", label: "Client" },
          { key: "jobLabel", label: "Job" },
          { key: "termLabel", label: "Installment" },
          { key: "amountLabel", label: "Scheduled Amount" },
          { key: "paidLabel", label: "Paid" },
          { key: "remainingLabel", label: "Remaining" },
          { key: "dueDate", label: "Due Date" },
          { key: "statusLabel", label: "Status" },
        ]}
        rows={clientScheduleRows}
        emptyTitle="Belum ada billing schedule client"
        emptyDescription="Billing schedule muncul otomatis setelah job client dibuat menggunakan paket dengan harga client."
        fields={paymentFields}
        rowPaymentAction={recordClientPaymentAction}
        paymentDefaultsByRow={clientPaymentDefaultsByRow}
        totals={[
          { label: "Total Client Obligation", value: formatCurrency(
            overview.clientSchedules.reduce((sum, s) => sum + Number(s.amount), 0),
          ) },
        ]}
      />

      <FinanceCrud
        title="Vendor Billing Schedule"
        description="Jadwal dibuat otomatis dari job vendor. Catat pembayaran langsung pada termin yang dibayar."
        entityLabel="Vendor Schedule"
        columns={[
          { key: "vendorName", label: "Vendor" },
          { key: "jobLabel", label: "Job" },
          { key: "termLabel", label: "Installment" },
          { key: "amountLabel", label: "Scheduled Amount" },
          { key: "paidLabel", label: "Paid" },
          { key: "remainingLabel", label: "Remaining" },
          { key: "dueDate", label: "Due Date" },
          { key: "statusLabel", label: "Status" },
        ]}
        rows={vendorScheduleRows}
        emptyTitle="Belum ada billing schedule vendor"
        emptyDescription="Billing schedule muncul otomatis setelah job vendor dibuat menggunakan paket dengan harga vendor."
        fields={paymentFields}
        rowPaymentAction={recordVendorPaymentAction}
        paymentDefaultsByRow={vendorPaymentDefaultsByRow}
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
