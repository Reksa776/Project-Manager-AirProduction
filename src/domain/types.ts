import type { Amount } from "./money";

/**
 * Domain kanonik (P0C-1) — bentuk data yang konsisten dengan skema MySQL yang
 * sudah disetujui (13 tabel). Domain ini TERPISAH dari domain lama
 * (`src/lib/types.ts`) yang masih dipakai Google Sheets sampai migrasi selesai
 * (lihat `src/domain/legacy-compat.ts`).
 *
 * Perbedaan penting dari domain lama:
 * - Tidak ada `Venue`; histori via `Job.legacyVenueName`.
 * - Tidak ada `Expense`; pengeluaran = `Cashflow` (direction EXPENSE).
 * - Uang direpresentasikan sebagai `Amount` (string desimal), bukan number.
 * - Status pembayaran TIDAK disimpan; selalu dihitung dari `Cashflow`.
 * - `Crew` memakai `crewRoleId` (role ternormalisasi), bukan string bebas.
 * - `JobCrewAssignment` memisahkan kesepakatan (`agreedAmount`) dari kas.
 */

/* -------------------------------------------------------------------------- */
/* Enums (nilai identik dengan skema DB)                                       */
/* -------------------------------------------------------------------------- */

export const JOB_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const DELIVERY_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const JOB_CATEGORIES = [
  "WEDDING",
  "PREWEDDING",
  "CORPORATE",
  "EVENT",
  "OTHER",
] as const;
export type JobCategory = (typeof JOB_CATEGORIES)[number];

export const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CLIENT_PAYMENT_TERMS = ["TERMIN_1", "TERMIN_2", "TERMIN_3"] as const;
export type ClientPaymentTerm = (typeof CLIENT_PAYMENT_TERMS)[number];

export const VENDOR_PAYMENT_TYPES = ["DP", "PELUNASAN"] as const;
export type VendorPaymentType = (typeof VENDOR_PAYMENT_TYPES)[number];

export const CASHFLOW_DIRECTIONS = ["INCOME", "EXPENSE"] as const;
export type CashflowDirection = (typeof CASHFLOW_DIRECTIONS)[number];

export const CASHFLOW_CATEGORIES = [
  "CLIENT_PAYMENT",
  "CREW_PAYMENT",
  "VENDOR_PAYMENT",
  "TRANSPORT",
  "EQUIPMENT",
  "OTHER",
] as const;
export type CashflowCategory = (typeof CASHFLOW_CATEGORIES)[number];

export const CASHFLOW_REFERENCE_TYPES = [
  "client_payment",
  "vendor_payment",
  "job_crew",
] as const;
export type CashflowReferenceType = (typeof CASHFLOW_REFERENCE_TYPES)[number];

export const CASHFLOW_SOURCES = ["MANUAL", "MIGRATION"] as const;
export type CashflowSource = (typeof CASHFLOW_SOURCES)[number];

export const ADMIN_ROLES = ["OWNER", "ADMIN", "STAFF"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const CLIENT_TYPES = ["INDIVIDU", "PERUSAHAAN", "AGENCY", "LAINNYA"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

/* -------------------------------------------------------------------------- */
/* Entities                                                                    */
/* -------------------------------------------------------------------------- */

export interface CrewRole {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  clientType?: ClientType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Package {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Crew {
  id: string;
  name: string;
  /** FK ke `crew_roles`. Role tampilan berasal dari `CrewRole.name`. */
  crewRoleId: string;
  defaultPayment: Amount;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Job kanonik.
 * `legacyVenueName` = snapshot histori nama venue (Venue bukan entity aktif).
 * `venueId` sengaja TIDAK ada di sini.
 * `jobNumber` dipertahankan apa adanya (generator otomatis = P2A).
 */
export interface Job {
  id: string;
  jobNumber: string;
  jobName: string;
  category: JobCategory;
  clientId?: string;
  vendorId?: string;
  packageId?: string;
  executionDate: string;
  status: JobStatus;
  location?: string;
  notes?: string;
  legacyVenueName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Delivery {
  id: string;
  jobId: string;
  name: string;
  deliveryType?: string;
  quantity?: number;
  deadline: string;
  status: DeliveryStatus;
  deliveredAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Assignment crew pada job. HANYA memuat kesepakatan (obligasi), bukan kas.
 * `crewRoleId` = override per-job; `null` berarti mengikuti role master crew.
 * Nilai kas aktual TIDAK ada di sini — dihitung dari `Cashflow`.
 */
export interface JobCrewAssignment {
  id: string;
  jobId: string;
  crewId: string;
  crewRoleId: string | null;
  agreedAmount: Amount;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Jadwal tagihan client (obligasi), bukan kas.
 * TIDAK memiliki `status`: status dihitung dari `Cashflow`.
 */
export interface ClientPaymentSchedule {
  id: string;
  jobId: string;
  term: ClientPaymentTerm;
  amount: Amount;
  dueDate?: string;
  paidDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Jadwal tagihan vendor (obligasi), bukan kas.
 * TIDAK memiliki `status`: status dihitung dari `Cashflow`.
 */
export interface VendorPaymentSchedule {
  id: string;
  jobId: string;
  type: VendorPaymentType;
  amount: Amount;
  dueDate?: string;
  paidDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Satu-satunya sumber kebenaran uang.
 *
 * P0C-2: `job_id` kini **NULLABLE** sehingga biaya operasional tanpa Job dapat
 * dicatat tanpa membuat Job dummy. FK tetap RESTRICT untuk transaksi ber-Job.
 */
export interface Cashflow {
  id: string;
  /** Kosong = transaksi operasional tanpa Job. */
  jobId?: string;
  occurredOn: string;
  direction: CashflowDirection;
  category: CashflowCategory;
  amount: Amount;
  description: string;
  referenceType?: CashflowReferenceType;
  referenceId?: string;
  source: CashflowSource;
  createdAt: string;
  updatedAt: string;
}

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Sesi login; token cookie disimpan sebagai hash SHA-256. */
export interface SessionRecord {
  id: string;
  adminId: string;
  tokenHash: string;
  expiresAt: string;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}
