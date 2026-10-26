import type { Job } from "@/domain/types";
import {
  listClientsForRequest,
  listDeliveriesForRequest,
  listJobsForRequest,
  listVendorsForRequest,
} from "@/services/read-cache";
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
  const [jobs, clients, vendors, deliveries] = await Promise.all([
    listJobsForRequest(),
    listClientsForRequest(),
    listVendorsForRequest(),
    listDeliveriesForRequest(),
  ]);

  const clientMap = buildLookup(clients);
  const vendorMap = buildLookup(vendors);

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

  const deliveriesByJob = new Map<string, typeof deliveries>();
  for (const delivery of deliveries) {
    const list = deliveriesByJob.get(delivery.jobId) ?? [];
    list.push(delivery);
    deliveriesByJob.set(delivery.jobId, list);
  }
  const projectMonitoring: ProjectMonitoringItem[] = jobs.flatMap((job) => {
    const jobDeliveries = deliveriesByJob.get(job.id) ?? [];
    if (jobDeliveries.length === 0) return [];
    const completedDeliveries = jobDeliveries.filter((delivery) => delivery.status === "COMPLETED").length;
    const deadlines = jobDeliveries.filter((delivery) => delivery.status !== "COMPLETED").map((delivery) => delivery.deadline).sort();
    return [{
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      completedDeliveries,
      totalDeliveries: jobDeliveries.length,
      progressPercent: Math.round((completedDeliveries / jobDeliveries.length) * 100),
      nextDeadline: deadlines[0],
    }];
  }).sort((a, b) => (a.nextDeadline ?? "9999-12-31").localeCompare(b.nextDeadline ?? "9999-12-31"));

  return {
    summary,
    incomingWeddings,
    projectMonitoring,
    incomingEditing: projectMonitoring,
  };
}
