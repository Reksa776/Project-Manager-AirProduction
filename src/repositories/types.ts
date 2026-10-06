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

export interface JobRepository extends ReadRepository<Job> {
  getByJobNumber(jobNumber: string): Promise<Job | null>;
}

export type ClientRepository = ReadRepository<Client>;
export type VendorRepository = ReadRepository<Vendor>;
export type VenueRepository = ReadRepository<Venue>;
export type CrewRepository = ReadRepository<Crew>;
export type AdminRepository = ReadRepository<Admin>;

export interface DeliveryRepository extends ReadRepository<Delivery> {
  getByJobId(jobId: string): Promise<Delivery[]>;
}

export interface JobCrewRepository extends ReadRepository<JobCrew> {
  getByJobId(jobId: string): Promise<JobCrew[]>;
}

export interface ClientPaymentRepository extends ReadRepository<ClientPayment> {
  getByJobId(jobId: string): Promise<ClientPayment[]>;
}

export interface VendorPaymentRepository extends ReadRepository<VendorPayment> {
  getByJobId(jobId: string): Promise<VendorPayment[]>;
}

export interface ExpenseRepository extends ReadRepository<Expense> {
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
