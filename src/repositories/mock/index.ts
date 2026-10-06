import {
  clientPayments,
  expenses,
  vendorPayments,
} from "@/data/mock/finance";
import { admins } from "@/data/mock/admins";
import { clients } from "@/data/mock/clients";
import { crew } from "@/data/mock/crew";
import { deliveries } from "@/data/mock/deliveries";
import { jobCrews } from "@/data/mock/job-crews";
import { jobs } from "@/data/mock/jobs";
import { vendors } from "@/data/mock/vendors";
import { venues } from "@/data/mock/venues";
import type { DataRepositories, ReadRepository } from "@/repositories/types";
import type {
  Client,
  ClientPayment,
  Crew,
  Delivery,
  Expense,
  Job,
  JobCrew,
  Vendor,
  VendorPayment,
  Venue,
} from "@/lib/types";

/** Repository read-only generik di atas array in-memory. */
function createReadRepository<T extends { id: string }>(
  source: readonly T[],
): ReadRepository<T> {
  return {
    async getAll() {
      return [...source];
    },
    async getById(id) {
      return source.find((item) => item.id === id) ?? null;
    },
  };
}

/** Repository read-only yang mendukung pencarian berdasarkan `jobId`. */
function createByJobIdRepository<T extends { id: string; jobId: string }>(
  source: readonly T[],
): ReadRepository<T> & { getByJobId(jobId: string): Promise<T[]> } {
  return {
    ...createReadRepository(source),
    async getByJobId(jobId) {
      return source.filter((item) => item.jobId === jobId);
    },
  };
}

const jobRepository: DataRepositories["jobs"] = {
  ...createReadRepository<Job>(jobs),
  async getByJobNumber(jobNumber) {
    return jobs.find((job) => job.jobNumber === jobNumber) ?? null;
  },
};

/**
 * Implementasi repository berbasis mock data.
 *
 * Ini adalah satu-satunya tempat data mock dibaca oleh lapisan repository.
 * Ketika Google Sheets diimplementasikan, cukup tambahkan implementasi baru
 * di folder `repositories/` tanpa mengubah service maupun UI.
 */
export const mockRepositories: DataRepositories = {
  jobs: jobRepository,
  clients: createReadRepository<Client>(clients),
  vendors: createReadRepository<Vendor>(vendors),
  venues: createReadRepository<Venue>(venues),
  crew: createReadRepository<Crew>(crew),
  deliveries: createByJobIdRepository<Delivery>(deliveries),
  jobCrews: createByJobIdRepository<JobCrew>(jobCrews),
  clientPayments: createByJobIdRepository<ClientPayment>(clientPayments),
  vendorPayments: createByJobIdRepository<VendorPayment>(vendorPayments),
  expenses: createByJobIdRepository<Expense>(expenses),
  admins: createReadRepository(admins),
};
