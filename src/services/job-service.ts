import { getRepositories } from "@/repositories";
import { buildLookup, resolveCounterparty } from "@/services/shared";
import type {
  JobCrewAssignment,
  JobDetail,
  JobListItem,
} from "@/services/types";
import type {
  ClientPayment,
  Delivery,
  Expense,
  Job,
  JobCrew,
  VendorPayment,
} from "@/lib/types";
import {
  CLIENT_PAYMENT_TERM,
  DELIVERY_STATUS,
  JOB_CATEGORY,
  JOB_STATUS,
  PAYMENT_STATUS,
  VENDOR_PAYMENT_TYPE,
} from "@/lib/types";

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

/* -------------------------------------------------------------------------- */
/* Job & relasi CRUD — service sebagai business layer.                         */
/* -------------------------------------------------------------------------- */

export interface JobInput {
  jobNumber: string;
  jobName: string;
  category: Job["category"];
  clientId?: string;
  vendorId?: string;
  venueId?: string;
  executionDate: string;
  status: Job["status"];
  location?: string;
  notes?: string;
}

function validateJobInput(input: JobInput): void {
  if (!input.jobNumber?.trim()) throw new Error("Job number wajib diisi.");
  if (!input.jobName?.trim()) throw new Error("Nama job wajib diisi.");
  if (!input.executionDate?.trim()) throw new Error("Tanggal eksekusi wajib diisi.");
  if (!Object.values(JOB_CATEGORY).includes(input.category)) {
    throw new Error("Kategori job tidak valid.");
  }
  if (!Object.values(JOB_STATUS).includes(input.status)) {
    throw new Error("Status job tidak valid.");
  }
  const hasClient = !!input.clientId;
  const hasVendor = !!input.vendorId;
  if (hasClient === hasVendor) {
    throw new Error("Job wajib memiliki clientId ATAU vendorId (tidak keduanya, tidak kosong).");
  }
}

async function assertRelationsExist(input: JobInput): Promise<void> {
  const repos = getRepositories();
  if (input.clientId && !(await repos.clients.getById(input.clientId))) {
    throw new Error(`Client '${input.clientId}' tidak ditemukan.`);
  }
  if (input.vendorId && !(await repos.vendors.getById(input.vendorId))) {
    throw new Error(`Vendor '${input.vendorId}' tidak ditemukan.`);
  }
  if (input.venueId && !(await repos.venues.getById(input.venueId))) {
    throw new Error(`Venue '${input.venueId}' tidak ditemukan.`);
  }
}

async function assertUniqueJobNumber(jobNumber: string, ignoreId?: string): Promise<void> {
  const jobs = await getRepositories().jobs.getAll();
  if (jobs.some((job) => job.jobNumber === jobNumber && job.id !== ignoreId)) {
    throw new Error(`Job number '${jobNumber}' sudah dipakai job lain.`);
  }
}

export async function createJob(input: JobInput): Promise<Job> {
  validateJobInput(input);
  await assertRelationsExist(input);
  await assertUniqueJobNumber(input.jobNumber);
  return getRepositories().jobs.create({
    ...input,
    jobNumber: input.jobNumber.trim(),
    jobName: input.jobName.trim(),
  });
}

export async function updateJob(id: string, input: JobInput): Promise<Job> {
  validateJobInput(input);
  const existing = await getRepositories().jobs.getById(id);
  if (!existing) {
    throw new Error(`Job dengan id '${id}' tidak ditemukan.`);
  }
  await assertRelationsExist(input);
  await assertUniqueJobNumber(input.jobNumber, id);
  return getRepositories().jobs.update(id, {
    ...input,
    jobNumber: input.jobNumber.trim(),
    jobName: input.jobName.trim(),
  });
}

export async function deleteJob(id: string): Promise<void> {
  return getRepositories().jobs.delete(id);
}

async function assertJobExists(jobId: string): Promise<void> {
  if (!(await getRepositories().jobs.getById(jobId))) {
    throw new Error(`Job '${jobId}' tidak ditemukan.`);
  }
}

/* JobCrew */

export async function createJobCrew(input: Omit<JobCrew, "id">): Promise<JobCrew> {
  await assertJobExists(input.jobId);
  if (!(await getRepositories().crew.getById(input.crewId))) {
    throw new Error(`Crew '${input.crewId}' tidak ditemukan.`);
  }
  if (!Number.isFinite(input.actualPayment) || input.actualPayment < 0) {
    throw new Error("Payment crew harus angka valid (>= 0).");
  }
  if (input.paymentStatus && !Object.values(PAYMENT_STATUS).includes(input.paymentStatus)) {
    throw new Error("Payment status crew tidak valid.");
  }
  return getRepositories().jobCrews.create(input);
}

export async function updateJobCrew(id: string, input: Omit<JobCrew, "id">): Promise<JobCrew> {
  await assertJobExists(input.jobId);
  if (!(await getRepositories().crew.getById(input.crewId))) {
    throw new Error(`Crew '${input.crewId}' tidak ditemukan.`);
  }
  if (!Number.isFinite(input.actualPayment) || input.actualPayment < 0) {
    throw new Error("Payment crew harus angka valid (>= 0).");
  }
  if (input.paymentStatus && !Object.values(PAYMENT_STATUS).includes(input.paymentStatus)) {
    throw new Error("Payment status crew tidak valid.");
  }
  return getRepositories().jobCrews.update(id, input);
}

export async function deleteJobCrew(id: string): Promise<void> {
  return getRepositories().jobCrews.delete(id);
}

/* Delivery */

export async function createDelivery(input: Omit<Delivery, "id">): Promise<Delivery> {
  await assertJobExists(input.jobId);
  if (!input.name?.trim()) throw new Error("Nama delivery wajib diisi.");
  if (!input.deadline?.trim()) throw new Error("Deadline delivery wajib diisi.");
  if (!Object.values(DELIVERY_STATUS).includes(input.status)) {
    throw new Error("Status delivery tidak valid.");
  }
  if (input.quantity !== undefined && (!Number.isFinite(input.quantity) || input.quantity < 0)) {
    throw new Error("Quantity delivery harus angka valid (>= 0).");
  }
  return getRepositories().deliveries.create(input);
}

export async function updateDelivery(id: string, input: Omit<Delivery, "id">): Promise<Delivery> {
  await assertJobExists(input.jobId);
  if (!input.name?.trim()) throw new Error("Nama delivery wajib diisi.");
  if (!input.deadline?.trim()) throw new Error("Deadline delivery wajib diisi.");
  if (!Object.values(DELIVERY_STATUS).includes(input.status)) {
    throw new Error("Status delivery tidak valid.");
  }
  if (input.quantity !== undefined && (!Number.isFinite(input.quantity) || input.quantity < 0)) {
    throw new Error("Quantity delivery harus angka valid (>= 0).");
  }
  return getRepositories().deliveries.update(id, input);
}

export async function deleteDelivery(id: string): Promise<void> {
  return getRepositories().deliveries.delete(id);
}

/* Client payment */

export async function createClientPayment(input: Omit<ClientPayment, "id">): Promise<ClientPayment> {
  await assertJobExists(input.jobId);
  if (!Object.values(CLIENT_PAYMENT_TERM).includes(input.term)) {
    throw new Error("Termin client payment tidak valid.");
  }
  if (!Object.values(PAYMENT_STATUS).includes(input.status)) {
    throw new Error("Status pembayaran tidak valid.");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Amount harus angka valid (>= 0).");
  }
  return getRepositories().clientPayments.create(input);
}

export async function updateClientPayment(id: string, input: Omit<ClientPayment, "id">): Promise<ClientPayment> {
  await assertJobExists(input.jobId);
  if (!Object.values(CLIENT_PAYMENT_TERM).includes(input.term)) {
    throw new Error("Termin client payment tidak valid.");
  }
  if (!Object.values(PAYMENT_STATUS).includes(input.status)) {
    throw new Error("Status pembayaran tidak valid.");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Amount harus angka valid (>= 0).");
  }
  return getRepositories().clientPayments.update(id, input);
}

export async function deleteClientPayment(id: string): Promise<void> {
  return getRepositories().clientPayments.delete(id);
}

/* Vendor payment */

export async function createVendorPayment(input: Omit<VendorPayment, "id">): Promise<VendorPayment> {
  await assertJobExists(input.jobId);
  if (!Object.values(VENDOR_PAYMENT_TYPE).includes(input.type)) {
    throw new Error("Tipe vendor payment tidak valid.");
  }
  if (!Object.values(PAYMENT_STATUS).includes(input.status)) {
    throw new Error("Status pembayaran tidak valid.");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Amount harus angka valid (>= 0).");
  }
  return getRepositories().vendorPayments.create(input);
}

export async function updateVendorPayment(id: string, input: Omit<VendorPayment, "id">): Promise<VendorPayment> {
  await assertJobExists(input.jobId);
  if (!Object.values(VENDOR_PAYMENT_TYPE).includes(input.type)) {
    throw new Error("Tipe vendor payment tidak valid.");
  }
  if (!Object.values(PAYMENT_STATUS).includes(input.status)) {
    throw new Error("Status pembayaran tidak valid.");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Amount harus angka valid (>= 0).");
  }
  return getRepositories().vendorPayments.update(id, input);
}

export async function deleteVendorPayment(id: string): Promise<void> {
  return getRepositories().vendorPayments.delete(id);
}

/* Expense */

export async function createExpense(input: Omit<Expense, "id">): Promise<Expense> {
  await assertJobExists(input.jobId);
  if (!input.description?.trim()) throw new Error("Deskripsi expense wajib diisi.");
  if (!input.category?.trim()) throw new Error("Kategori expense wajib diisi.");
  if (!input.date?.trim()) throw new Error("Tanggal expense wajib diisi.");
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Amount harus angka valid (>= 0).");
  }
  return getRepositories().expenses.create(input);
}

export async function updateExpense(id: string, input: Omit<Expense, "id">): Promise<Expense> {
  await assertJobExists(input.jobId);
  if (!input.description?.trim()) throw new Error("Deskripsi expense wajib diisi.");
  if (!input.category?.trim()) throw new Error("Kategori expense wajib diisi.");
  if (!input.date?.trim()) throw new Error("Tanggal expense wajib diisi.");
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("Amount harus angka valid (>= 0).");
  }
  return getRepositories().expenses.update(id, input);
}

export async function deleteExpense(id: string): Promise<void> {
  return getRepositories().expenses.delete(id);
}
