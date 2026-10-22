import type { Amount } from "@/domain/money";
import type {
  CreateCashflowInput,
  CreateClientInput,
  CreateClientPaymentScheduleInput,
  CreateCrewInput,
  CreateCrewRoleInput,
  CreateDeliveryInput,
  CreateJobCrewAssignmentInput,
  CreateJobInput,
  CreatePackageInput,
  CreateVendorInput,
  CreateVendorPaymentScheduleInput,
} from "@/domain/inputs";
import type {
  Admin,
  Cashflow,
  Client,
  ClientPaymentSchedule,
  Crew,
  CrewRole,
  Delivery,
  Job,
  JobCrewAssignment,
  PaymentStatus,
  Package,
  SessionRecord,
  Vendor,
  VendorPaymentSchedule,
} from "@/domain/types";

/**
 * KONTRAK REPOSITORY KANONIK (versi 2) — berorientasi MySQL.
 *
 * Terpisah dari kontrak lama (`src/repositories/types.ts`) yang masih melayani
 * Google Sheets. Kontrak ini:
 * - TIDAK memuat Venue (konsep dihapus; histori via `Job.legacyVenueName`).
 * - TIDAK memuat Expenses (digantikan `Cashflow`).
 * - Memisahkan OBLIGASI (`*PaymentSchedule`, `JobCrewAssignment.agreedAmount`)
 *   dari KAS (`Cashflow`).
 *
 * Belum diimplementasikan untuk aplikasi; implementasi live = P0C-2.
 */

export const REPOSITORY_CONTRACT_VERSION = 2 as const;

export interface ReadRepository<T> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | null>;
}

export interface WritableRepository<T, TCreate> extends ReadRepository<T> {
  create(data: TCreate): Promise<T>;
  update(id: string, data: TCreate): Promise<T>;
  delete(id: string): Promise<void>;
}

export interface CanonicalJobRepository extends ReadRepository<Job> {
  getByJobNumber(jobNumber: string): Promise<Job | null>;
  create(data: CreateJobInput): Promise<Job>;
  update(id: string, data: CreateJobInput): Promise<Job>;
  delete(id: string): Promise<void>;
}

export type CanonicalClientRepository = WritableRepository<Client, CreateClientInput>;
export type CanonicalPackageRepository = WritableRepository<Package, CreatePackageInput>;
export type CanonicalVendorRepository = WritableRepository<Vendor, CreateVendorInput>;
export type CanonicalCrewRoleRepository = WritableRepository<CrewRole, CreateCrewRoleInput>;
export type CanonicalCrewRepository = WritableRepository<Crew, CreateCrewInput>;

export interface CanonicalDeliveryRepository extends WritableRepository<Delivery, CreateDeliveryInput> {
  getByJobId(jobId: string): Promise<Delivery[]>;
}

export interface CanonicalJobCrewAssignmentRepository
  extends WritableRepository<JobCrewAssignment, CreateJobCrewAssignmentInput> {
  getByJobId(jobId: string): Promise<JobCrewAssignment[]>;
}

export interface CanonicalClientPaymentScheduleRepository
  extends WritableRepository<ClientPaymentSchedule, CreateClientPaymentScheduleInput> {
  getByJobId(jobId: string): Promise<ClientPaymentSchedule[]>;
}

export interface CanonicalVendorPaymentScheduleRepository
  extends WritableRepository<VendorPaymentSchedule, CreateVendorPaymentScheduleInput> {
  getByJobId(jobId: string): Promise<VendorPaymentSchedule[]>;
}

export interface CanonicalCashflowRepository extends ReadRepository<Cashflow> {
  getByJobId(jobId: string): Promise<Cashflow[]>;
  create(data: CreateCashflowInput): Promise<Cashflow>;
}

export type CanonicalAdminRepository = ReadRepository<Admin>;

/**
 * Sesi login. Repository persistence tetap read-only; lifecycle autentikasi
 * dikelola oleh `src/lib/auth.ts`.
 */
export interface CanonicalSessionRepository extends ReadRepository<SessionRecord> {
  getByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
}

export interface MySqlRepositories {
  jobs: CanonicalJobRepository;
  clients: CanonicalClientRepository;
  packages: CanonicalPackageRepository;
  vendors: CanonicalVendorRepository;
  crew: CanonicalCrewRepository;
  crewRoles: CanonicalCrewRoleRepository;
  deliveries: CanonicalDeliveryRepository;
  jobCrewAssignments: CanonicalJobCrewAssignmentRepository;
  clientPaymentSchedules: CanonicalClientPaymentScheduleRepository;
  vendorPaymentSchedules: CanonicalVendorPaymentScheduleRepository;
  cashflows: CanonicalCashflowRepository;
  admins: CanonicalAdminRepository;
  sessions: CanonicalSessionRepository;
}

/* -------------------------------------------------------------------------- */
/* Financial operation contracts (types only; no implementation in P0C-1)      */
/* -------------------------------------------------------------------------- */

/**
 * ATURAN TRANSAKSI (locked, untuk P0C-2):
 * - Mencatat kas = SATU transaksi yang menyisipkan tepat satu baris `cashflows`
 *   (dan, bila relevan, memperbarui `paid_date` pada jadwal tagihan). Gagal →
 *   ROLLBACK; tidak boleh ada baris kas yatim.
 * - Mencatat pembayaran TIDAK mengubah/menghapus jadwal (obligasi tetap).
 */

/**
 * Pencegahan duplikasi (locked):
 * - Setiap operasi pencatatan kas wajib memilih tepat satu referensi
 *   (`client_payment` | `vendor_payment` | `job_crew`).
 * - `idempotencyKey` deterministik (lihat `paymentIdempotencyKey`) dipakai
 *   aplikasi untuk deteksi pengulangan. Skema saat ini belum memiliki kolom/
 *   UNIQUE index idempotensi → keputusan skema = prasyarat P0C-2.
 * - `(referenceType, referenceId)` sebaiknya UNIQUE untuk satu pencatatan lunas.
 */
export interface IdempotencyRequirement {
  idempotencyKey: string;
}

export interface RecordClientPaymentInput extends IdempotencyRequirement {
  scheduleId: string;
  amount: Amount;
  occurredOn: string;
  description?: string;
}

export interface RecordVendorPaymentInput extends IdempotencyRequirement {
  scheduleId: string;
  amount: Amount;
  occurredOn: string;
  description?: string;
}

export interface RecordCrewPaymentInput extends IdempotencyRequirement {
  assignmentId: string;
  amount: Amount;
  occurredOn: string;
  description?: string;
}

export interface RecordGeneralExpenseInput extends IdempotencyRequirement {
  /** Kosong = biaya operasional tanpa Job (P0C-2: `cashflows.job_id` nullable). */
  jobId?: string;
  category: "TRANSPORT" | "EQUIPMENT" | "OTHER" | "INTERNET" | "ELECTRICITY" | "SALARY" | "RENT" | "SUPPLIES";
  amount: Amount;
  occurredOn: string;
  description: string;
}

export interface RecordPaymentResult {
  cashflowId: string;
  referenceType: "client_payment" | "vendor_payment" | "job_crew";
  referenceId: string;
  paidAmount: Amount;
  remainingAmount: Amount;
  status: PaymentStatus;
}

export interface PaymentHistoryQuery {
  jobId?: string;
  referenceType?: "client_payment" | "vendor_payment" | "job_crew";
  referenceId?: string;
  from?: string;
  to?: string;
}

/**
 * Kontrak operasi finansial (belum diimplementasikan).
 * Memisahkan OBLIGASI (schedule) dari KAS (cashflow).
 */
export interface FinancialOperations {
  createClientPaymentSchedule(data: CreateClientPaymentScheduleInput): Promise<ClientPaymentSchedule>;
  createVendorPaymentSchedule(data: CreateVendorPaymentScheduleInput): Promise<VendorPaymentSchedule>;
  updateClientPaymentSchedule(
    id: string,
    data: CreateClientPaymentScheduleInput,
  ): Promise<ClientPaymentSchedule>;
  updateVendorPaymentSchedule(
    id: string,
    data: CreateVendorPaymentScheduleInput,
  ): Promise<VendorPaymentSchedule>;
  recordClientPayment(data: RecordClientPaymentInput): Promise<RecordPaymentResult>;
  recordVendorPayment(data: RecordVendorPaymentInput): Promise<RecordPaymentResult>;
  recordCrewPayment(data: RecordCrewPaymentInput): Promise<RecordPaymentResult>;
  recordGeneralExpense(data: RecordGeneralExpenseInput): Promise<Cashflow>;
  readCashflows(query: PaymentHistoryQuery): Promise<Cashflow[]>;
  deriveClientPaymentStatus(scheduleId: string): Promise<PaymentStatus>;
  deriveCrewSettlement(assignmentId: string): Promise<{
    agreedAmount: Amount;
    paidAmount: Amount;
    remainingAmount: Amount;
    status: PaymentStatus;
  }>;
}
