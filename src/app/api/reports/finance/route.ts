import { getFinanceOverview } from "@/services/job-service";
import { requireAuthenticatedAdmin } from "@/lib/auth";
import { createExcelWorkbook, excelDownloadResponse } from "@/lib/excel-report";
import {
  CASHFLOW_CATEGORY_LABEL,
  CASHFLOW_DIRECTION_LABEL,
  CLIENT_PAYMENT_TERM_LABEL,
  PAYMENT_STATUS_LABEL,
  VENDOR_PAYMENT_TYPE_LABEL,
} from "@/lib/labels";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAuthenticatedAdmin();
  const overview = await getFinanceOverview();
  const workbook = createExcelWorkbook([
    {
      name: "Cashflow",
      headers: ["Date", "Direction", "Category", "Job", "Description", "Amount"],
      rows: overview.cashflows.map((flow) => [
        flow.occurredOn,
        CASHFLOW_DIRECTION_LABEL[flow.direction],
        CASHFLOW_CATEGORY_LABEL[flow.category],
        flow.jobLabel,
        flow.description,
        Number(flow.amount),
      ]),
    },
    {
      name: "Client Schedules",
      headers: ["Job ID", "Installment", "Scheduled Amount", "Paid Amount", "Due Date", "Status", "Notes"],
      rows: overview.clientSchedules.map((schedule) => [
        schedule.jobId,
        CLIENT_PAYMENT_TERM_LABEL[schedule.term],
        Number(schedule.amount),
        Number(schedule.paidAmount),
        schedule.dueDate ?? "",
        PAYMENT_STATUS_LABEL[schedule.status],
        schedule.notes ?? "",
      ]),
    },
    {
      name: "Vendor Schedules",
      headers: ["Job ID", "Type", "Scheduled Amount", "Paid Amount", "Due Date", "Status", "Notes"],
      rows: overview.vendorSchedules.map((schedule) => [
        schedule.jobId,
        VENDOR_PAYMENT_TYPE_LABEL[schedule.type],
        Number(schedule.amount),
        Number(schedule.paidAmount),
        schedule.dueDate ?? "",
        PAYMENT_STATUS_LABEL[schedule.status],
        schedule.notes ?? "",
      ]),
    },
    {
      name: "Summary",
      headers: ["Metric", "Amount"],
      rows: [
        ["Income", Number(overview.totals.income)],
        ["Expense", Number(overview.totals.expense)],
        ["Net", Number(overview.totals.net)],
      ],
    },
  ]);
  return excelDownloadResponse(workbook, "air-production-finance-report.xls");
}
