import { getRepositories } from "@/repositories";
import { buildLookup, resolveCounterparty } from "@/services/shared";
import type {
  DashboardData,
  DashboardSummary,
  IncomingEditingItem,
  IncomingWeddingItem,
} from "@/services/types";

function today(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Data untuk halaman Dashboard.
 *
 * - `incomingWeddings` diturunkan dari `jobs.executionDate` (job Wedding yang
 *   belum lewat), diurutkan dari tanggal terdekat.
 * - `incomingEditing` diturunkan dari `deliveries.deadline` (delivery yang belum
 *   selesai), diurutkan dari deadline terdekat.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const repos = getRepositories();
  const [jobs, clients, vendors, venues, deliveries] = await Promise.all([
    repos.jobs.getAll(),
    repos.clients.getAll(),
    repos.vendors.getAll(),
    repos.venues.getAll(),
    repos.deliveries.getAll(),
  ]);

  const clientMap = buildLookup(clients);
  const vendorMap = buildLookup(vendors);
  const venueMap = buildLookup(venues);
  const jobMap = buildLookup(jobs);

  const summary: DashboardSummary = {
    totalJobs: jobs.length,
    notStarted: jobs.filter((job) => job.status === "NOT_STARTED").length,
    inProgress: jobs.filter((job) => job.status === "IN_PROGRESS").length,
    completed: jobs.filter((job) => job.status === "COMPLETED").length,
  };

  const startOfToday = today();
  const incomingWeddings: IncomingWeddingItem[] = jobs
    .filter(
      (job) =>
        job.category === "WEDDING" && job.executionDate >= startOfToday,
    )
    .sort((a, b) => a.executionDate.localeCompare(b.executionDate))
    .map((job) => ({
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      counterpartyName: resolveCounterparty(job, clientMap, vendorMap).name,
      venueName: job.venueId ? venueMap.get(job.venueId)?.name : undefined,
      executionDate: job.executionDate,
      status: job.status,
    }));

  const incomingEditing: IncomingEditingItem[] = deliveries
    .filter((delivery) => delivery.status !== "COMPLETED")
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

  return { summary, incomingWeddings, incomingEditing };
}
