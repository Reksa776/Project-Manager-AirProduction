import type { CreateJobInput } from "@/domain/inputs";
import type {
  Cashflow,
  ClientPaymentSchedule,
  Delivery,
  Job,
  JobCrewAssignment,
  VendorPaymentSchedule,
} from "@/domain/types";
import type { MySqlRepositories } from "@/repositories/contract";
import { CanonicalServiceError } from "./errors";

/**
 * Service Job KANONIK (Contract v2).
 *
 * BATAS KOMPATIBILITAS: hanya memakai `MySqlRepositories`. Komposisi detail job
 * menyatukan OBLIGASI (jadwal client/vendor, kesepakatan crew), DELIVERABLE
 * (delivery), dan KAS (`cashflows`) dari repository kanonik — tanpa menyentuh
 * kontrak legacy maupun Google Sheets.
 */

export interface CanonicalCounterparty {
  type: "CLIENT" | "VENDOR";
  id: string;
  name: string;
}

export interface CanonicalJobDetail {
  job: Job;
  counterparty: CanonicalCounterparty;
  clientPaymentSchedules: ClientPaymentSchedule[];
  vendorPaymentSchedules: VendorPaymentSchedule[];
  crewAssignments: JobCrewAssignment[];
  deliveries: Delivery[];
  cashflows: Cashflow[];
}

export interface CanonicalJobService {
  listJobs(): Promise<Job[]>;
  getJobById(id: string): Promise<Job | null>;
  getJobByNumber(jobNumber: string): Promise<Job | null>;
  createJob(input: CreateJobInput): Promise<Job>;
  updateJob(id: string, input: CreateJobInput): Promise<Job>;
  deleteJob(id: string): Promise<void>;
  /** Detail job terkomposisi (job + counterparty + obligasi + kas). */
  getJobDetail(jobId: string): Promise<CanonicalJobDetail>;
}

export function createJobService(repositories: MySqlRepositories): CanonicalJobService {
  const {
    jobs,
    clients,
    vendors,
    clientPaymentSchedules,
    vendorPaymentSchedules,
    jobCrewAssignments,
    deliveries,
    cashflows,
  } = repositories;

  async function resolveCounterparty(job: Job): Promise<CanonicalCounterparty> {
    if (job.clientId) {
      const client = await clients.getById(job.clientId);
      if (!client) {
        throw new CanonicalServiceError(
          `Job '${job.id}' merujuk client '${job.clientId}' yang tidak ada.`,
        );
      }
      return { type: "CLIENT", id: client.id, name: client.name };
    }
    if (job.vendorId) {
      const vendor = await vendors.getById(job.vendorId);
      if (!vendor) {
        throw new CanonicalServiceError(
          `Job '${job.id}' merujuk vendor '${job.vendorId}' yang tidak ada.`,
        );
      }
      return { type: "VENDOR", id: vendor.id, name: vendor.name };
    }
    throw new CanonicalServiceError(
      `Job '${job.id}' tidak memiliki client maupun vendor (melanggar aturan XOR).`,
    );
  }

  return {
    async listJobs() {
      const all = await jobs.getAll();
      return [...all].sort(
        (a, b) =>
          a.executionDate.localeCompare(b.executionDate) ||
          a.jobNumber.localeCompare(b.jobNumber),
      );
    },
    getJobById: (id) => jobs.getById(id),
    getJobByNumber: (jobNumber) => jobs.getByJobNumber(jobNumber),
    createJob: (input) => jobs.create(input),
    updateJob: (id, input) => jobs.update(id, input),
    deleteJob: (id) => jobs.delete(id),

    async getJobDetail(jobId) {
      const job = await jobs.getById(jobId);
      if (!job) {
        throw new CanonicalServiceError(`Job '${jobId}' tidak ditemukan.`);
      }
      const counterparty = await resolveCounterparty(job);
      const [clientSchedules, vendorSchedules, assignments, jobDeliveries, jobCashflows] =
        await Promise.all([
          clientPaymentSchedules.getByJobId(jobId),
          vendorPaymentSchedules.getByJobId(jobId),
          jobCrewAssignments.getByJobId(jobId),
          deliveries.getByJobId(jobId),
          cashflows.getByJobId(jobId),
        ]);
      return {
        job,
        counterparty,
        clientPaymentSchedules: clientSchedules,
        vendorPaymentSchedules: vendorSchedules,
        crewAssignments: assignments,
        deliveries: jobDeliveries,
        cashflows: jobCashflows,
      };
    },
  };
}
