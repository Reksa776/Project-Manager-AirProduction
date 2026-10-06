import { getRepositories } from "@/repositories";
import { buildLookup, resolveCounterparty } from "@/services/shared";
import type {
  JobCrewAssignment,
  JobDetail,
  JobListItem,
} from "@/services/types";

/**
 * Service untuk entity Job.
 *
 * Semua fungsi bersifat async agar implementasi Google Sheets dapat
 * ditukarkan tanpa mengubah komponen UI.
 */

/** Daftar Job dalam bentuk view model, diurutkan dari job terbaru. */
export async function getJobListItems(): Promise<JobListItem[]> {
  const repos = getRepositories();
  const [jobs, clients, vendors, venues] = await Promise.all([
    repos.jobs.getAll(),
    repos.clients.getAll(),
    repos.vendors.getAll(),
    repos.venues.getAll(),
  ]);

  const clientMap = buildLookup(clients);
  const vendorMap = buildLookup(vendors);
  const venueMap = buildLookup(venues);

  return jobs
    .map<JobListItem>((job) => ({
      id: job.id,
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      category: job.category,
      counterparty: resolveCounterparty(job, clientMap, vendorMap),
      venueName: job.venueId ? venueMap.get(job.venueId)?.name : undefined,
      executionDate: job.executionDate,
      status: job.status,
    }))
    .sort((a, b) => b.jobNumber.localeCompare(a.jobNumber));
}

/** Detail lengkap satu Job berdasarkan `jobNumber`. */
export async function getJobDetail(jobNumber: string): Promise<JobDetail | null> {
  const repos = getRepositories();
  const job = await repos.jobs.getByJobNumber(jobNumber);
  if (!job) return null;

  const [clients, vendors, venues, jobCrews, crew, deliveries, clientPayments, vendorPayments, expenses] =
    await Promise.all([
      repos.clients.getAll(),
      repos.vendors.getAll(),
      repos.venues.getAll(),
      repos.jobCrews.getByJobId(job.id),
      repos.crew.getAll(),
      repos.deliveries.getByJobId(job.id),
      repos.clientPayments.getByJobId(job.id),
      repos.vendorPayments.getByJobId(job.id),
      repos.expenses.getByJobId(job.id),
    ]);

  const crewMap = buildLookup(crew);
  const assignments: JobCrewAssignment[] = jobCrews.map((assignment) => ({
    assignment,
    crew: crewMap.get(assignment.crewId) ?? null,
  }));

  return {
    job,
    counterparty: resolveCounterparty(
      job,
      buildLookup(clients),
      buildLookup(vendors),
    ),
    venue: job.venueId
      ? (venues.find((venue) => venue.id === job.venueId) ?? null)
      : null,
    assignments,
    deliveries: [...deliveries].sort((a, b) =>
      a.deadline.localeCompare(b.deadline),
    ),
    clientPayments: [...clientPayments].sort((a, b) =>
      a.term.localeCompare(b.term),
    ),
    vendorPayments: [...vendorPayments].sort((a, b) =>
      a.type.localeCompare(b.type),
    ),
    expenses: [...expenses].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
