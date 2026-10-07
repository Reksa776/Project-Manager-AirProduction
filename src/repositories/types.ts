import type {
  Admin,
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
 * Kontrak repository.
 *
 * UI hanya berbicara dengan Service, dan Service hanya berbicara dengan
 * interface di file ini. Implementasi konkret (mock saat ini, Google Sheets
 * pada phase berikutnya) dapat ditukar tanpa mengubah UI.
 */

export interface ReadRepository<T> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
}

/**
 * Repository yang mendukung operasi tulis (create/update/delete).
 *
 * `create` menghasilkan ID baru dan timestamp (bila entity menyimpannya);
 * `update` memakai ID immutable dan ID yang tidak ditemukan menghasilkan
 * error eksplisit; `delete` menghapus baris data (bukan header) dan ID
 * yang tidak ditemukan menghasilkan error eksplisit.
 */
export interface WritableRepository<T, TCreate = Omit<T, "id">> extends ReadRepository<T> {
  create(data: TCreate): Promise<T>;
  update(id: string, data: TCreate): Promise<T>;
  delete(id: string): Promise<void>;
}

export interface JobRepository extends ReadRepository<Job> {
  getByJobNumber(jobNumber: string): Promise<Job | null>;
  create(data: Omit<Job, "id" | "createdAt" | "updatedAt">): Promise<Job>;
  update(id: string, data: Omit<Job, "id" | "createdAt" | "updatedAt">): Promise<Job>;
  delete(id: string): Promise<void>;
}

export type ClientRepository = WritableRepository<Client>;
export type VendorRepository = WritableRepository<Vendor>;
export type VenueRepository = WritableRepository<Venue>;
export type CrewRepository = WritableRepository<Crew>;
export type AdminRepository = ReadRepository<Admin>;

export interface DeliveryRepository extends WritableRepository<Delivery> {
  getByJobId(jobId: string): Promise<Delivery[]>;
}

export interface JobCrewRepository extends WritableRepository<JobCrew> {
  getByJobId(jobId: string): Promise<JobCrew[]>;
}

export interface ClientPaymentRepository extends WritableRepository<ClientPayment> {
  getByJobId(jobId: string): Promise<ClientPayment[]>;
}

export interface VendorPaymentRepository extends WritableRepository<VendorPayment> {
  getByJobId(jobId: string): Promise<VendorPayment[]>;
}

export interface ExpenseRepository extends WritableRepository<Expense> {
  getByJobId(jobId: string): Promise<Expense[]>;
}

/** Kumpulan seluruh repository yang dibutuhkan aplikasi. */
export interface DataRepositories {
  jobs: JobRepository;
  clients: ClientRepository;
  vendors: VendorRepository;
  venues: VenueRepository;
  crew: CrewRepository;
  deliveries: DeliveryRepository;
  jobCrews: JobCrewRepository;
  clientPayments: ClientPaymentRepository;
  vendorPayments: VendorPaymentRepository;
  expenses: ExpenseRepository;
  admins: AdminRepository;
}
