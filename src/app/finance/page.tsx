import { PageHeader } from "@/components/ui";
import { AppShell } from "@/components/layout/app-shell";
import { FinanceCrud } from "@/components/finance/finance-crud";
import {
  CASHFLOW_CATEGORY_LABEL,
  CASHFLOW_DIRECTION_LABEL,
  CLIENT_PAYMENT_TERM_LABEL,
  GENERAL_EXPENSE_CATEGORIES,
  PAYMENT_STATUS_LABEL,
  VENDOR_PAYMENT_TYPE_LABEL,
} from "@/lib/labels";
import {
  createClientScheduleAction,
  createVendorScheduleAction,
  recordClientPaymentAction,
  recordExpenseAction,
  recordVendorPaymentAction,
  updateClientScheduleAction,
  updateVendorScheduleAction,
} from "@/app/actions/finance-actions";
import { getJobListItems, getFinanceOverview } from "@/services/job-service";
import { formatCurrency } from "@/lib/utils";
import { requireAuthenticatedAdmin } from "@/lib/auth";

export const metadata = {
  title: "Finance · Air Production DB",
};

// Data MySQL dibaca saat runtime; tidak diprerender statis.
export const dynamic = "force-dynamic";

const CLIENT_TERM_OPTIONS = (
  Object.keys(CLIENT_PAYMENT_TERM_LABEL) as Array<keyof typeof CLIENT_PAYMENT_TERM_LABEL>
).map((value) => ({ value, label: CLIENT_PAYMENT_TERM_LABEL[value] }));

const VENDOR_TYPE_OPTIONS = (
  Object.keys(VENDOR_PAYMENT_TYPE_LABEL) as Array<keyof typeof VENDOR_PAYMENT_TYPE_LABEL>
).map((value) => ({ value, label: VENDOR_PAYMENT_TYPE_LABEL[value] }));

const EXPENSE_CATEGORY_OPTIONS = GENERAL_EXPENSE_CATEGORIES.map((value) => ({
  value,
  label: CASHFLOW_CATEGORY_LABEL[value],
}));

export default async function FinancePage() {
  const admin = await requireAuthenticatedAdmin();
  const [overview, jobs] = await Promise.all([getFinanceOverview(), getJobListItems()]);

  const jobOptions = jobs.map((job) => ({
    value: job.id,
    label: `${job.jobNumber} — ${job.jobName}`,
  }));

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

  const vendorScheduleRows = overview.vendorSchedules.map((schedule) => ({
    id: schedule.id,
    jobId: schedule.jobId,
    type: schedule.type,
    typeLabel: VENDOR_PAYMENT_TYPE_LABEL[schedule.type],
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

  const clientScheduleOptions = overview.clientSchedules.map((schedule) => ({
    value: schedule.id,
    label: `${schedule.jobId.slice(0, 8)} · ${CLIENT_PAYMENT_TERM_LABEL[schedule.term]} — ${formatCurrency(schedule.amount)} (${PAYMENT_STATUS_LABEL[schedule.status]})`,
  }));

  const vendorScheduleOptions = overview.vendorSchedules.map((schedule) => ({
    value: schedule.id,
    label: `${schedule.jobId.slice(0, 8)} · ${VENDOR_PAYMENT_TYPE_LABEL[schedule.type]} — ${formatCurrency(schedule.amount)} (${PAYMENT_STATUS_LABEL[schedule.status]})`,
  }));

  return (
    <AppShell adminName={admin.name}>
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Billing schedules and actual cash movements. Payment status is calculated from recorded cash, not stored separately."
        actions={<a href="/api/reports/finance" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#1a73e8] px-3 text-sm font-medium text-[#1967d2] transition-colors hover:bg-[#e8f0fe]"><span aria-hidden="true">↓</span> Download Excel</a>}
      />

      {/* Obligations: schedules (create + update; canonical has no schedule delete) */}
      <FinanceCrud
        title="Client Billing Schedule"
        description="Client billing schedule (Installment 1 = deposit; Installment 3 = final payment). Status is derived from cash records."
        entityLabel="Client Schedule"
        columns={[
          { key: "termLabel", label: "Installment" },
          { key: "amountLabel", label: "Scheduled Amount" },
          { key: "paidLabel", label: "Paid" },
          { key: "dueDate", label: "Due Date" },
          { key: "statusLabel", label: "Status" },
        ]}
        rows={clientScheduleRows}
        fields={[
          { key: "jobId", label: "Job", type: "select", options: jobOptions, placeholder: "-- Select Job --" },
          { key: "term", label: "Installment", type: "select", options: CLIENT_TERM_OPTIONS, defaultValue: "TERMIN_1" },
          { key: "amount", label: "Amount", type: "number", hint: "Example: 1,000,000" },
          { key: "dueDate", label: "Due Date (optional)", type: "date" },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
        totals={[
          { label: "Total Client Obligation", value: formatCurrency(
            overview.clientSchedules.reduce((sum, s) => sum + Number(s.amount), 0),
          ) },
        ]}
        createAction={createClientScheduleAction}
        updateAction={updateClientScheduleAction}
      />

      <FinanceCrud
        title="Vendor Payment Schedule"
        description="Vendor payment schedule (deposit and final payment). Status is derived from cash records."
        entityLabel="Vendor Schedule"
        columns={[
          { key: "typeLabel", label: "Type" },
          { key: "amountLabel", label: "Scheduled Amount" },
          { key: "paidLabel", label: "Paid" },
          { key: "dueDate", label: "Due Date" },
          { key: "statusLabel", label: "Status" },
        ]}
        rows={vendorScheduleRows}
        fields={[
          { key: "jobId", label: "Job", type: "select", options: jobOptions, placeholder: "-- Select Job --" },
          { key: "type", label: "Type", type: "select", options: VENDOR_TYPE_OPTIONS, defaultValue: "Deposit" },
          { key: "amount", label: "Amount", type: "number", hint: "Example: 400,000" },
          { key: "dueDate", label: "Due Date (optional)", type: "date" },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
        totals={[
          { label: "Total Vendor Obligation", value: formatCurrency(
            overview.vendorSchedules.reduce((sum, s) => sum + Number(s.amount), 0),
          ) },
        ]}
        createAction={createVendorScheduleAction}
        updateAction={updateVendorScheduleAction}
      />

      {/* Actual cash: create-only, idempotent, no edit/delete (canonical cashflow) */}
      <FinanceCrud
        title="Record Income (Payment Client)"
        description="Record actual client payments. The database prevents duplicate entries; cash records cannot be edited or deleted."
        entityLabel="Client Payment"
        columns={[{ key: "occurredOn", label: "Date" }]}
        rows={[]}
        fields={[
          { key: "scheduleId", label: "Client Schedule", type: "select", options: clientScheduleOptions, placeholder: "-- Select Schedule --" },
          { key: "amount", label: "Amount", type: "number", hint: "Example: 500,000" },
          { key: "occurredOn", label: "Date", type: "date" },
          { key: "description", label: "Description (optional)" },
          { key: "idempotencyKey", label: "Idempotency Key", type: "hidden", autoKey: true },
        ]}
        createAction={recordClientPaymentAction}
      />

      <FinanceCrud
        title="Record Vendor Payment"
        description="Record actual vendor payments. Cash records cannot be edited or deleted."
        entityLabel="Vendor Payment"
        columns={[{ key: "occurredOn", label: "Date" }]}
        rows={[]}
        fields={[
          { key: "scheduleId", label: "Vendor Schedule", type: "select", options: vendorScheduleOptions, placeholder: "-- Select Schedule --" },
          { key: "amount", label: "Amount", type: "number", hint: "Example: 400,000" },
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
