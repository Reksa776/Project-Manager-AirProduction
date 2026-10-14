import type { InferSelectModel } from "drizzle-orm";

import {
  admins,
  clientPayments,
  clients,
  crew,
  deliveries,
  jobCrews,
  jobs,
  vendorPayments,
  vendors,
} from "@/db/schema";
import { parseAmount } from "@/domain/money";
import { RepositoryError } from "@/repositories/mysql/errors";
import {
  CLIENT_PAYMENT_TERM,
  DELIVERY_STATUS,
  JOB_CATEGORY,
  JOB_STATUS,
  VENDOR_PAYMENT_TYPE,
  type Admin,
  type Client,
  type ClientPayment,
  type ClientPaymentTerm,
  type Crew,
  type Delivery,
  type DeliveryStatus,
  type Job,
  type JobCategory,
  type JobCrew,
  type JobStatus,
  type PaymentStatus,
  type Vendor,
  type VendorPayment,
  type VendorPaymentType,
} from "@/lib/types";

/**
 * Mapping murni dari baris MySQL (hasil Drizzle select) ke domain type.
 *
 * Prinsip:
 * - Nilai NULL → `undefined` untuk field opsional domain.
 * - Enum divalidasi terhadap allow-list domain; nilai tak dikenal → error
 *   eksplisit (tidak ada casting buta).
 * - Tidak ada default bisnis yang dikarang saat read.
 * - Field yang tidak punya representasi di skema TIDAK ditambahkan ke domain.
 */

export type ClientRow = InferSelectModel<typeof clients>;
export type VendorRow = InferSelectModel<typeof vendors>;
export type CrewRow = InferSelectModel<typeof crew>;
export type AdminRow = InferSelectModel<typeof admins>;
export type JobRow = InferSelectModel<typeof jobs>;
export type DeliveryRow = InferSelectModel<typeof deliveries>;
export type JobCrewRow = InferSelectModel<typeof jobCrews>;
export type ClientPaymentRow = InferSelectModel<typeof clientPayments>;
export type VendorPaymentRow = InferSelectModel<typeof vendorPayments>;

function opt(value: string | null | undefined): string | undefined {
  return value === null || value === undefined ? undefined : value;
}

function assertEnum<T extends string>(
  value: string,
  allowed: Record<string, T>,
  field: string,
): T {
  const values = Object.values(allowed) as readonly string[];
  if (!values.includes(value)) {
    throw new RepositoryError(
      `Nilai kolom '${field}' tidak valid: '${value}'. Nilai yang diizinkan: ${values.join(", ")}.`,
    );
  }
  return value as T;
}

/**
 * P0C-2: kolom uang (`decimal`) sekarang dibaca sebagai string agar presisi
 * terjaga. Kontrak LEGACY masih memakai `number`, jadi di sini dikonversi
 * secara eksplisit untuk kompatibilitas domain lama.
 */
export function decimalToNumber(value: string, field: string): number {
  const parsed = Number(value);
  if (typeof value !== "string" || !Number.isFinite(parsed)) {
    throw new RepositoryError(`Nilai angka kolom '${field}' tidak valid: ${String(value)}.`);
  }
  return parsed;
}

/** Konversi nilai legacy (`number`) ke string desimal kanonik untuk kolom uang. */
export function numberToDecimal(value: number, field: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RepositoryError(`Nilai '${field}' harus berupa angka valid.`);
  }
  try {
    return parseAmount(value);
  } catch {
    throw new RepositoryError(`Nilai '${field}' tidak valid: ${String(value)}.`);
  }
}

export function rowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    contactPerson: opt(row.contactPerson),
    phone: opt(row.phone),
    email: opt(row.email),
    address: opt(row.address),
    notes: opt(row.notes),
  };
}

export function rowToVendor(row: VendorRow): Vendor {
  return {
    id: row.id,
    name: row.name,
    contactPerson: opt(row.contactPerson),
    phone: opt(row.phone),
    email: opt(row.email),
    notes: opt(row.notes),
  };
}

/** `roleName` berasal dari join ke `crew_roles` (skema ternormalisasi). */
export function rowToCrew(row: CrewRow, roleName: string): Crew {
  return {
    id: row.id,
    name: row.name,
    role: roleName,
    defaultPayment: decimalToNumber(row.defaultPayment, "crew.default_payment"),
    phone: opt(row.phone),
    notes: opt(row.notes),
  };
}

export function rowToAdmin(row: AdminRow): Admin {
  return { id: row.id, name: row.name, email: row.email };
}

/**
 * CATATAN: `jobs.legacy_venue_name` sengaja TIDAK dipetakan ke domain —
 * konsep Venue dihapus, dan kolom ini hanya arsip historis. `Job.venueId`
 * tidak memiliki kolom di skema MySQL → selalu `undefined` saat read.
 */
export function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    jobNumber: row.jobNumber,
    jobName: row.jobName,
    category: assertEnum<JobCategory>(row.category, JOB_CATEGORY, "jobs.category"),
    clientId: opt(row.clientId),
    vendorId: opt(row.vendorId),
    venueId: undefined,
    executionDate: row.executionDate,
    status: assertEnum<JobStatus>(row.status, JOB_STATUS, "jobs.status"),
    location: opt(row.location),
    notes: opt(row.notes),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToDelivery(row: DeliveryRow): Delivery {
  return {
    id: row.id,
    jobId: row.jobId,
    name: row.name,
    deliveryType: opt(row.deliveryType),
    quantity: row.quantity === null ? undefined : row.quantity,
    deadline: row.deadline,
    status: assertEnum<DeliveryStatus>(row.status, DELIVERY_STATUS, "deliveries.status"),
    deliveredAt: opt(row.deliveredAt),
    notes: opt(row.notes),
  };
}

/**
 * `roleName` = override role assignment bila ada, jika tidak role master crew.
 * `actualPayment` dipetakan dari `agreed_amount` (lihat catatan di index.ts/P0B report).
 */
export function rowToJobCrew(
  row: JobCrewRow,
  roleName: string,
  paymentStatus?: PaymentStatus,
): JobCrew {
  return {
    id: row.id,
    jobId: row.jobId,
    crewId: row.crewId,
    role: roleName,
    actualPayment: decimalToNumber(row.agreedAmount, "job_crews.agreed_amount"),
    paymentStatus,
    notes: opt(row.notes),
  };
}

export function rowToClientPayment(
  row: ClientPaymentRow,
  status: PaymentStatus,
): ClientPayment {
  return {
    id: row.id,
    jobId: row.jobId,
    term: assertEnum<ClientPaymentTerm>(
      row.term,
      CLIENT_PAYMENT_TERM,
      "client_payments.term",
    ),
    amount: decimalToNumber(row.amount, "client_payments.amount"),
    dueDate: opt(row.dueDate),
    paidDate: opt(row.paidDate),
    status,
    notes: opt(row.notes),
  };
}

export function rowToVendorPayment(
  row: VendorPaymentRow,
  status: PaymentStatus,
): VendorPayment {
  return {
    id: row.id,
    jobId: row.jobId,
    type: assertEnum<VendorPaymentType>(
      row.type,
      VENDOR_PAYMENT_TYPE,
      "vendor_payments.type",
    ),
    amount: decimalToNumber(row.amount, "vendor_payments.amount"),
    dueDate: opt(row.dueDate),
    paidDate: opt(row.paidDate),
    status,
    notes: opt(row.notes),
  };
}
