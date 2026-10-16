import type { Job } from "@/domain/types";
import { getApplication } from "@/services/runtime";
import { buildLookup, resolveCounterparty } from "@/services/shared";
import type {
  DashboardData,
  DashboardSummary,
  ProjectMonitoringItem,
  IncomingWeddingItem,
} from "@/services/types";

/**
 * Data Dashboard KANONIK (Contract v2).
 *
 * - `incomingWeddings` diturunkan dari `jobs.executionDate` (kategori WEDDING
 *   yang belum lewat), diurutkan dari tanggal terdekat.
 * - `projectMonitoring` menampilkan semua deliverable dari seluruh job,
 *   termasuk yang selesai, agar progres proyek bisa dipantau end-to-end.
 * - Venue TIDAK dibaca (venue bukan entity aktif; hanya `legacyVenueName`
 *   ditampilkan sebagai snapshot histori bila ada).
 * - Database kosong menghasilkan ringkasan nol dan daftar kosong (bukan data
 *   karangan).
 */

function today(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export async function getDashboardData(): Promise<DashboardData> {
  const app = getApplication();
  const [jobs, clients, vendors, deliveries] = await Promise.all([
    app.services.jobs.listJobs(),
    app.services.master.listClients(),
    app.services.master.listVendors(),
    app.services.deliveries.listDeliveries(),
  ]);

  const clientMap = buildLookup(clients);
  const vendorMap = buildLookup(vendors);
  const jobMap = buildLookup(jobs);

  const summary: DashboardSummary = {
    totalJobs: jobs.length,
    notStarted: jobs.filter((job) => job.status === "NOT_STARTED").length,
    inProgress: jobs.filter((job) => job.status === "IN_PROGRESS").length,
    completed: jobs.filter((job) => job.status === "COMPLETED").length,
  };

  const startOfToday = today();
  const counterpartyName = (job: Job): string =>
    resolveCounterparty(job, clientMap, vendorMap)?.name ?? "-";

  const incomingWeddings: IncomingWeddingItem[] = jobs
    .filter((job) => job.category === "WEDDING" && job.executionDate >= startOfToday)
    .sort((a, b) => a.executionDate.localeCompare(b.executionDate))
    .map((job) => ({
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      counterpartyName: counterpartyName(job),
      legacyVenueName: job.legacyVenueName,
      executionDate: job.executionDate,
      status: job.status,
    }));

  const projectMonitoring: ProjectMonitoringItem[] = deliveries
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .map((delivery) => {
      const job = jobMap.get(delivery.jobId);
      return {
        deliveryId: delivery.id,
        deliveryName: delivery.name,
        jobNumber: job?.jobNumber ?? "-",
        jobName: job?.jobName ?? "Job tidak dikenal",
        deadline: delivery.deadline,
        status: delivery.status,
      };
    });

  return {
    summary,
    incomingWeddings,
    projectMonitoring,
    incomingEditing: projectMonitoring,
  };
}
