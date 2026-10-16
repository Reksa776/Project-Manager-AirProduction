import { getPackages } from "@/services/master-service";
import { getJobListItems } from "@/services/job-service";
import { requireAuthenticatedAdmin } from "@/lib/auth";
import { createExcelWorkbook, excelDownloadResponse } from "@/lib/excel-report";
import { JOB_CATEGORY_LABEL, JOB_STATUS_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAuthenticatedAdmin();
  const [jobs, packages] = await Promise.all([getJobListItems(), getPackages()]);
  const packageNames = new Map(packages.map((item) => [item.id, item.name]));
  const workbook = createExcelWorkbook([{
    name: "Jobs Report",
    headers: ["Job Number", "Job Name", "Client / Vendor", "Package", "Category", "Event Date", "Status", "Location", "Notes"],
    rows: jobs.map((job) => [
      job.jobNumber,
      job.jobName,
      job.counterparty.name,
      job.packageId ? packageNames.get(job.packageId) ?? "" : "",
      JOB_CATEGORY_LABEL[job.category],
      job.executionDate,
      JOB_STATUS_LABEL[job.status],
      job.location ?? "",
      job.notes ?? "",
    ]),
  }]);
  return excelDownloadResponse(workbook, "air-production-jobs-report.xls");
}
