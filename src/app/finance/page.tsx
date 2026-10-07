import { PageHeader } from "@/components/ui";
import { FinanceCrud } from "@/components/finance/finance-crud";
import {
  CLIENT_PAYMENT_TERM_LABEL,
  EXPENSE_CATEGORIES,
  PAYMENT_STATUS_LABEL,
  VENDOR_PAYMENT_TYPE_LABEL,
} from "@/lib/labels";
import type {
  ClientPaymentTerm,
  PaymentStatus,
  VendorPaymentType,
} from "@/lib/types";
import {
  createClientPaymentAction,
  createExpenseAction,
  createVendorPaymentAction,
  deleteClientPaymentAction,
  deleteExpenseAction,
  deleteVendorPaymentAction,
  updateClientPaymentAction,
  updateExpenseAction,
  updateVendorPaymentAction,
} from "@/app/actions/finance-actions";
import { getFinanceOverview } from "@/services/master-service";
import { getJobListItems } from "@/services/job-service";
import { formatCurrency } from "@/lib/utils";

export const metadata = {
  title: "Finance · Air Production DB",
};

function selectOptions<T extends string>(labels: Record<T, string>): Array<{ value: T; label: string }> {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

const TERM_OPTIONS = selectOptions<ClientPaymentTerm>(CLIENT_PAYMENT_TERM_LABEL);
const TYPE_OPTIONS = selectOptions<VendorPaymentType>(VENDOR_PAYMENT_TYPE_LABEL);
const STATUS_OPTIONS = selectOptions<PaymentStatus>(PAYMENT_STATUS_LABEL);
/** Filter membandingkan nilai label (kolom tampilan), bukan nilai enum mentah. */
const STATUS_FILTER_OPTIONS = STATUS_OPTIONS.map((o) => ({ value: o.label, label: o.label }));
const EXPENSE_CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }));

export default async function FinancePage() {
  const [{ clientPayments, vendorPayments, expenses }, jobs] = await Promise.all([
    getFinanceOverview(),
    getJobListItems(),
  ]);

  const jobOptions = jobs.map((j) => ({ value: j.id, label: `${j.jobNumber} — ${j.jobName}` }));

  const clientRows = clientPayments.map((p) => ({
    id: p.id,
    jobNumber: p.jobNumber,
    clientName: p.clientName,
    termLabel: CLIENT_PAYMENT_TERM_LABEL[p.term],
    amountLabel: formatCurrency(p.amount),
    dueDate: p.dueDate ?? "",
    paidDate: p.paidDate ?? "",
    statusLabel: PAYMENT_STATUS_LABEL[p.status],
    jobId: p.jobId,
    term: p.term,
    amount: String(p.amount),
    status: p.status,
    notes: p.notes ?? "",
  }));

  const vendorRows = vendorPayments.map((p) => ({
    id: p.id,
    jobNumber: p.jobNumber,
    vendorName: p.vendorName,
    typeLabel: VENDOR_PAYMENT_TYPE_LABEL[p.type],
    amountLabel: formatCurrency(p.amount),
    dueDate: p.dueDate ?? "",
    paidDate: p.paidDate ?? "",
    statusLabel: PAYMENT_STATUS_LABEL[p.status],
    jobId: p.jobId,
    type: p.type,
    amount: String(p.amount),
    status: p.status,
    notes: p.notes ?? "",
  }));

  const expenseRows = expenses.map((e) => ({
    id: e.id,
    date: e.date,
    jobNumber: e.jobNumber,
    description: e.description,
    category: e.category,
    amountLabel: formatCurrency(e.amount),
    jobId: e.jobId,
    amount: String(e.amount),
    notes: e.notes ?? "",
  }));

  const clientTotal = clientPayments.reduce((sum, p) => sum + p.amount, 0);
  const vendorTotal = vendorPayments.reduce((sum, p) => sum + p.amount, 0);
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Daftar pembayaran client, pembayaran vendor, dan expense yang tercatat pada job."
      />

      <FinanceCrud
        title="Pembayaran Client"
        description="Termin 1 = DP, Termin 2, dan Termin 3 = Pelunasan."
        entityLabel="Client Payment"
        columns={[
          { key: "jobNumber", label: "Job" },
          { key: "clientName", label: "Client" },
          { key: "termLabel", label: "Termin" },
          { key: "amountLabel", label: "Jumlah" },
          { key: "dueDate", label: "Jatuh Tempo" },
          { key: "statusLabel", label: "Status" },
        ]}
        rows={clientRows}
        fields={[
          { key: "jobId", label: "Job", type: "select", options: jobOptions },
          { key: "term", label: "Termin", type: "select", options: TERM_OPTIONS },
          { key: "amount", label: "Jumlah", type: "number", hint: "Contoh: 1000000 atau 1.000.000" },
          { key: "dueDate", label: "Jatuh Tempo", type: "date" },
          { key: "paidDate", label: "Tanggal Bayar", type: "date" },
          { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
          { key: "notes", label: "Catatan", type: "textarea" },
        ]}
        filter={{ key: "statusLabel", options: STATUS_FILTER_OPTIONS }}
        totals={[{ label: "Total Client Payments", value: formatCurrency(clientTotal) }]}
        createAction={createClientPaymentAction}
        updateAction={updateClientPaymentAction}
        deleteAction={deleteClientPaymentAction}
      />

      <FinanceCrud
        title="Pembayaran Vendor"
        description="Pembayaran ke vendor terdiri dari DP dan Pelunasan."
        entityLabel="Vendor Payment"
        columns={[
          { key: "jobNumber", label: "Job" },
          { key: "vendorName", label: "Vendor" },
          { key: "typeLabel", label: "Jenis" },
          { key: "amountLabel", label: "Jumlah" },
          { key: "dueDate", label: "Jatuh Tempo" },
          { key: "statusLabel", label: "Status" },
        ]}
        rows={vendorRows}
        fields={[
          { key: "jobId", label: "Job", type: "select", options: jobOptions },
          { key: "type", label: "Jenis", type: "select", options: TYPE_OPTIONS },
          { key: "amount", label: "Jumlah", type: "number", hint: "Contoh: 1000000 atau 1.000.000" },
          { key: "dueDate", label: "Jatuh Tempo", type: "date" },
          { key: "paidDate", label: "Tanggal Bayar", type: "date" },
          { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
          { key: "notes", label: "Catatan", type: "textarea" },
        ]}
        filter={{ key: "statusLabel", options: STATUS_FILTER_OPTIONS }}
        totals={[{ label: "Total Vendor Payments", value: formatCurrency(vendorTotal) }]}
        createAction={createVendorPaymentAction}
        updateAction={updateVendorPaymentAction}
        deleteAction={deleteVendorPaymentAction}
      />

      <FinanceCrud
        title="Expense"
        description="Pengeluaran operasional yang tercatat pada job."
        entityLabel="Expense"
        columns={[
          { key: "date", label: "Tanggal" },
          { key: "jobNumber", label: "Job" },
          { key: "description", label: "Deskripsi" },
          { key: "category", label: "Kategori" },
          { key: "amountLabel", label: "Jumlah" },
        ]}
        rows={expenseRows}
        fields={[
          { key: "jobId", label: "Job", type: "select", options: jobOptions },
          { key: "category", label: "Kategori", type: "select", options: EXPENSE_CATEGORY_OPTIONS },
          { key: "description", label: "Deskripsi" },
          { key: "amount", label: "Jumlah", type: "number", hint: "Contoh: 250000" },
          { key: "date", label: "Tanggal Expense", type: "date" },
          { key: "notes", label: "Catatan", type: "textarea" },
        ]}
        filter={{ key: "category", options: EXPENSE_CATEGORY_OPTIONS }}
        totals={[{ label: "Total Expense", value: formatCurrency(expenseTotal) }]}
        createAction={createExpenseAction}
        updateAction={updateExpenseAction}
        deleteAction={deleteExpenseAction}
      />
    </div>
  );
}
