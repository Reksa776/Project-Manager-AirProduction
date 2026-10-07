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
import type { DataRepositories } from "@/repositories/types";
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

/**
 * Implementasi repository berbasis mock data (in-memory, mutable).
 *
 * Mock dipakai sebagai fallback/testing. create/update/delete bekerja di
 * memori saja (tidak persisten antar restart). Admin tetap read-only
 * karena password management belum scope.
 */

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-MOCK-${Date.now().toString(36).toUpperCase()}-${idCounter}`;
}

/** Salin array agar mutasi mock tidak mengubah sumber data mock awal. */
const store = {
  jobs: [...jobs],
  clients: [...clients],
  vendors: [...vendors],
  venues: [...venues],
  crew: [...crew],
  deliveries: [...deliveries],
  jobCrews: [...jobCrews],
  clientPayments: [...clientPayments],
  vendorPayments: [...vendorPayments],
  expenses: [...expenses],
  admins: [...admins],
};

function createInMemoryWriteRepository<T extends { id: string }>(
  list: T[],
  prefix: string,
  prepare?: (data: Omit<T, "id">) => T,
) {
  return {
    async getAll() {
      return [...list];
    },
    async getById(id: string) {
      return list.find((item) => item.id === id) ?? null;
    },
    async create(data: Omit<T, "id">) {
      const id = generateId(prefix);
      const entity = prepare
        ? prepare(data)
        : ({ ...data, id } as T);
      if (!list.some((item) => item.id === id)) {
        list.push(entity);
      }
      return entity;
    },
    async update(id: string, data: Omit<T, "id">) {
      const index = list.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new Error(`Mock repository: record dengan id '${id}' tidak ditemukan (operation update).`);
      }
      const updated = { ...list[index], ...data, id };
      list[index] = updated;
      return updated;
    },
    async delete(id: string) {
      const index = list.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new Error(`Mock repository: record dengan id '${id}' tidak ditemukan (operation delete).`);
      }
      list.splice(index, 1);
    },
  };
}

export const mockRepositories: DataRepositories = {
  jobs: {
    ...createInMemoryWriteRepository<Job>(store.jobs, "JOB", (data) => {
      const job = data as Omit<Job, "id">;
      const now = new Date().toISOString();
      return {
        ...job,
        id: generateId("JOB"),
        createdAt: now,
        updatedAt: now,
      } as Job;
    }),
    async getByJobNumber(jobNumber) {
      return store.jobs.find((job) => job.jobNumber === jobNumber) ?? null;
    },
    async create(data) {
      const hasClient = !!data.clientId;
      const hasVendor = !!data.vendorId;
      if (hasClient === hasVendor) {
        throw new Error("Mock repository: job wajib memiliki clientId ATAU vendorId.");
      }
      if (store.jobs.some((job) => job.jobNumber === data.jobNumber)) {
        throw new Error(`Mock repository: job_number '${data.jobNumber}' sudah dipakai.`);
      }
      const now = new Date().toISOString();
      const entity: Job = { ...data, id: generateId("JOB"), createdAt: now, updatedAt: now };
      store.jobs.push(entity);
      return entity;
    },
    async update(id, data) {
      const index = store.jobs.findIndex((job) => job.id === id);
      if (index === -1) {
        throw new Error(`Mock repository: record dengan id '${id}' tidak ditemukan (operation update).`);
      }
      const hasClient = !!data.clientId;
      const hasVendor = !!data.vendorId;
      if (hasClient === hasVendor) {
        throw new Error("Mock repository: job wajib memiliki clientId ATAU vendorId.");
      }
      if (store.jobs.some((job) => job.jobNumber === data.jobNumber && job.id !== id)) {
        throw new Error(`Mock repository: job_number '${data.jobNumber}' sudah dipakai.`);
      }
      const updated: Job = {
        ...data,
        id,
        createdAt: store.jobs[index].createdAt,
        updatedAt: new Date().toISOString(),
      };
      store.jobs[index] = updated;
      return updated;
    },
  },
  clients: createInMemoryWriteRepository<Client>(store.clients, "CLI"),
  vendors: createInMemoryWriteRepository<Vendor>(store.vendors, "VND"),
  venues: createInMemoryWriteRepository<Venue>(store.venues, "VNU"),
  crew: createInMemoryWriteRepository<Crew>(store.crew, "CRW"),
  deliveries: {
    ...createInMemoryWriteRepository<Delivery>(store.deliveries, "DLV"),
    async getByJobId(jobId) {
      return store.deliveries.filter((item) => item.jobId === jobId);
    },
  },
  jobCrews: {
    ...createInMemoryWriteRepository<JobCrew>(store.jobCrews, "JC"),
    async getByJobId(jobId) {
      return store.jobCrews.filter((item) => item.jobId === jobId);
    },
  },
  clientPayments: {
    ...createInMemoryWriteRepository<ClientPayment>(store.clientPayments, "CP"),
    async getByJobId(jobId) {
      return store.clientPayments.filter((item) => item.jobId === jobId);
    },
  },
  vendorPayments: {
    ...createInMemoryWriteRepository<VendorPayment>(store.vendorPayments, "VP"),
    async getByJobId(jobId) {
      return store.vendorPayments.filter((item) => item.jobId === jobId);
    },
  },
  expenses: {
    ...createInMemoryWriteRepository<Expense>(store.expenses, "EXP"),
    async getByJobId(jobId) {
      return store.expenses.filter((item) => item.jobId === jobId);
    },
  },
  admins: {
    async getAll() {
      return [...store.admins];
    },
    async getById(id) {
      return store.admins.find((admin) => admin.id === id) ?? null;
    },
  },
};
