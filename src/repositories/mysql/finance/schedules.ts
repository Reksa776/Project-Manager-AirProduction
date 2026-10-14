import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb, type Database } from "@/db";
import { cashflows, clientPayments, vendorPayments } from "@/db/schema";
import type { Amount } from "@/domain/money";
import type {
  CreateClientPaymentScheduleInput,
  CreateVendorPaymentScheduleInput,
} from "@/domain/inputs";
import type { ClientPaymentSchedule, VendorPaymentSchedule } from "@/domain/types";
import { isClientPaymentTerm, isVendorPaymentType } from "@/domain/validation";
import type {
  CanonicalClientPaymentScheduleRepository,
  CanonicalVendorPaymentScheduleRepository,
} from "@/repositories/contract";
import {
  RepositoryError,
  RepositoryInUseError,
  RepositoryNotFoundError,
} from "@/repositories/mysql/errors";
import {
  rowToClientPaymentSchedule,
  rowToVendorPaymentSchedule,
} from "@/repositories/mysql/finance/mapping";
import { requirePositiveAmount } from "@/repositories/mysql/finance/values";

/**
 * Repository jadwal pembayaran (OBLIGASI) untuk client & vendor.
 *
 * Penting:
 * - Membuat/mengubah jadwal TIDAK membuat/mengubah kas. Kas hanya lewat
 *   `cashflows` (lihat cashflows.ts + service finance).
 * - Menghapus/mengubah `jobId` ditolak bila sudah ada kas yang merujuk jadwal
 *   tersebut (mencegah orphan / salah-atribusi).
 * - `status` TIDAK disimpan; selalu diturunkan di service dari cashflow.
 *
 * P0C-3: setiap repository dibuat lewat factory yang menerima resolver koneksi
 * sehingga factory kanonik dapat menyuntikkan koneksi yang sama. Singleton lama
 * tetap ada (resolusi lazy lewat `getDb()`, tidak membuka koneksi saat import).
 */

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

async function countPaymentsForReference(
  db: Database,
  referenceType: "client_payment" | "vendor_payment",
  referenceId: string,
): Promise<number> {
  const rows = await db
    .select({ id: cashflows.id })
    .from(cashflows)
    .where(
      and(eq(cashflows.referenceType, referenceType), eq(cashflows.referenceId, referenceId)),
    );
  return rows.length;
}

function normalizeOptionalDate(value: string | undefined): string | null {
  if (!hasValue(value)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RepositoryError(`Tanggal '${value}' tidak valid (harus YYYY-MM-DD).`);
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/* Client payment schedule                                                     */
/* -------------------------------------------------------------------------- */

function validateClientSchedule(data: CreateClientPaymentScheduleInput): {
  amount: Amount;
  term: CreateClientPaymentScheduleInput["term"];
} {
  if (!hasValue(data.jobId)) throw new RepositoryError("jobId wajib diisi.");
  if (!isClientPaymentTerm(data.term)) {
    throw new RepositoryError(`Term client payment tidak valid: '${data.term}'.`);
  }
  return { amount: requirePositiveAmount(data.amount, "clientPayment.amount"), term: data.term };
}

async function getClientScheduleById(
  db: Database,
  id: string,
): Promise<ClientPaymentSchedule | null> {
  const rows = await db.select().from(clientPayments).where(eq(clientPayments.id, id)).limit(1);
  return rows[0] ? rowToClientPaymentSchedule(rows[0]) : null;
}

async function listClientSchedules(
  db: Database,
  jobId?: string,
): Promise<ClientPaymentSchedule[]> {
  const rows = await db
    .select()
    .from(clientPayments)
    .where(hasValue(jobId) ? eq(clientPayments.jobId, jobId) : undefined);
  return rows.map(rowToClientPaymentSchedule);
}

async function createClientSchedule(
  db: Database,
  data: CreateClientPaymentScheduleInput,
): Promise<ClientPaymentSchedule> {
  const { amount, term } = validateClientSchedule(data);
  const id = randomUUID();
  await db.insert(clientPayments).values({
    id,
    jobId: data.jobId,
    term,
    amount,
    dueDate: normalizeOptionalDate(data.dueDate),
    paidDate: normalizeOptionalDate(data.paidDate),
    notes: hasValue(data.notes) ? data.notes : null,
  });
  const created = await getClientScheduleById(db, id);
  if (!created) throw new RepositoryError("Gagal membaca ulang jadwal client yang baru dibuat.");
  return created;
}

async function updateClientSchedule(
  db: Database,
  id: string,
  data: CreateClientPaymentScheduleInput,
): Promise<ClientPaymentSchedule> {
  const existingRows = await db
    .select()
    .from(clientPayments)
    .where(eq(clientPayments.id, id))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) throw new RepositoryNotFoundError("client_payments", id);

  const { amount, term } = validateClientSchedule(data);
  if (existing.jobId !== data.jobId) {
    const paid = await countPaymentsForReference(db, "client_payment", id);
    if (paid > 0) {
      throw new RepositoryInUseError(
        "client_payments",
        id,
        "jadwal sudah memiliki pembayaran tercatat; memindahkan ke job lain akan salah-atribusi.",
      );
    }
  }

  await db
    .update(clientPayments)
    .set({
      jobId: data.jobId,
      term,
      amount,
      dueDate: normalizeOptionalDate(data.dueDate),
      paidDate: normalizeOptionalDate(data.paidDate),
      notes: hasValue(data.notes) ? data.notes : null,
    })
    .where(eq(clientPayments.id, id));
  const updated = await getClientScheduleById(db, id);
  if (!updated) throw new RepositoryError("Gagal membaca ulang jadwal client yang diperbarui.");
  return updated;
}

async function deleteClientSchedule(db: Database, id: string): Promise<void> {
  const existing = await getClientScheduleById(db, id);
  if (!existing) throw new RepositoryNotFoundError("client_payments", id);
  const paid = await countPaymentsForReference(db, "client_payment", id);
  if (paid > 0) {
    throw new RepositoryInUseError(
      "client_payments",
      id,
      "ada kas yang merujuk jadwal ini; menghapus akan membuat catatan kas yatim.",
    );
  }
  await db.delete(clientPayments).where(eq(clientPayments.id, id));
}

/** Factory jadwal pembayaran client. `resolveDb` dipanggil per operasi. */
export function createClientPaymentScheduleRepository(
  resolveDb: () => Database,
): CanonicalClientPaymentScheduleRepository {
  return {
    getAll: () => listClientSchedules(resolveDb()),
    getById: (id) => getClientScheduleById(resolveDb(), id),
    getByJobId: (jobId) => listClientSchedules(resolveDb(), jobId),
    create: (data) => createClientSchedule(resolveDb(), data),
    update: (id, data) => updateClientSchedule(resolveDb(), id, data),
    delete: (id) => deleteClientSchedule(resolveDb(), id),
  };
}

export const mysqlClientPaymentSchedules: CanonicalClientPaymentScheduleRepository =
  createClientPaymentScheduleRepository(getDb);

/* -------------------------------------------------------------------------- */
/* Vendor payment schedule                                                     */
/* -------------------------------------------------------------------------- */

function validateVendorSchedule(data: CreateVendorPaymentScheduleInput): {
  amount: Amount;
  type: CreateVendorPaymentScheduleInput["type"];
} {
  if (!hasValue(data.jobId)) throw new RepositoryError("jobId wajib diisi.");
  if (!isVendorPaymentType(data.type)) {
    throw new RepositoryError(`Tipe vendor payment tidak valid: '${data.type}'.`);
  }
  return { amount: requirePositiveAmount(data.amount, "vendorPayment.amount"), type: data.type };
}

async function getVendorScheduleById(
  db: Database,
  id: string,
): Promise<VendorPaymentSchedule | null> {
  const rows = await db.select().from(vendorPayments).where(eq(vendorPayments.id, id)).limit(1);
  return rows[0] ? rowToVendorPaymentSchedule(rows[0]) : null;
}

async function listVendorSchedules(
  db: Database,
  jobId?: string,
): Promise<VendorPaymentSchedule[]> {
  const rows = await db
    .select()
    .from(vendorPayments)
    .where(hasValue(jobId) ? eq(vendorPayments.jobId, jobId) : undefined);
  return rows.map(rowToVendorPaymentSchedule);
}

async function createVendorSchedule(
  db: Database,
  data: CreateVendorPaymentScheduleInput,
): Promise<VendorPaymentSchedule> {
  const { amount, type } = validateVendorSchedule(data);
  const id = randomUUID();
  await db.insert(vendorPayments).values({
    id,
    jobId: data.jobId,
    type,
    amount,
    dueDate: normalizeOptionalDate(data.dueDate),
    paidDate: normalizeOptionalDate(data.paidDate),
    notes: hasValue(data.notes) ? data.notes : null,
  });
  const created = await getVendorScheduleById(db, id);
  if (!created) throw new RepositoryError("Gagal membaca ulang jadwal vendor yang baru dibuat.");
  return created;
}

async function updateVendorSchedule(
  db: Database,
  id: string,
  data: CreateVendorPaymentScheduleInput,
): Promise<VendorPaymentSchedule> {
  const existingRows = await db
    .select()
    .from(vendorPayments)
    .where(eq(vendorPayments.id, id))
    .limit(1);
  const existing = existingRows[0];
  if (!existing) throw new RepositoryNotFoundError("vendor_payments", id);

  const { amount, type } = validateVendorSchedule(data);
  if (existing.jobId !== data.jobId) {
    const paid = await countPaymentsForReference(db, "vendor_payment", id);
    if (paid > 0) {
      throw new RepositoryInUseError(
        "vendor_payments",
        id,
        "jadwal sudah memiliki pembayaran tercatat; memindahkan ke job lain akan salah-atribusi.",
      );
    }
  }

  await db
    .update(vendorPayments)
    .set({
      jobId: data.jobId,
      type,
      amount,
      dueDate: normalizeOptionalDate(data.dueDate),
      paidDate: normalizeOptionalDate(data.paidDate),
      notes: hasValue(data.notes) ? data.notes : null,
    })
    .where(eq(vendorPayments.id, id));
  const updated = await getVendorScheduleById(db, id);
  if (!updated) throw new RepositoryError("Gagal membaca ulang jadwal vendor yang diperbarui.");
  return updated;
}

async function deleteVendorSchedule(db: Database, id: string): Promise<void> {
  const existing = await getVendorScheduleById(db, id);
  if (!existing) throw new RepositoryNotFoundError("vendor_payments", id);
  const paid = await countPaymentsForReference(db, "vendor_payment", id);
  if (paid > 0) {
    throw new RepositoryInUseError(
      "vendor_payments",
      id,
      "ada kas yang merujuk jadwal ini; menghapus akan membuat catatan kas yatim.",
    );
  }
  await db.delete(vendorPayments).where(eq(vendorPayments.id, id));
}

/** Factory jadwal pembayaran vendor. `resolveDb` dipanggil per operasi. */
export function createVendorPaymentScheduleRepository(
  resolveDb: () => Database,
): CanonicalVendorPaymentScheduleRepository {
  return {
    getAll: () => listVendorSchedules(resolveDb()),
    getById: (id) => getVendorScheduleById(resolveDb(), id),
    getByJobId: (jobId) => listVendorSchedules(resolveDb(), jobId),
    create: (data) => createVendorSchedule(resolveDb(), data),
    update: (id, data) => updateVendorSchedule(resolveDb(), id, data),
    delete: (id) => deleteVendorSchedule(resolveDb(), id),
  };
}

export const mysqlVendorPaymentSchedules: CanonicalVendorPaymentScheduleRepository =
  createVendorPaymentScheduleRepository(getDb);
