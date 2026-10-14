/**
 * Repository finansial MySQL (Contract v2).
 *
 * Belum diaktifkan untuk aplikasi: `getRepositories()` tetap mengembalikan
 * `googleRepositories`. Modul ini dipakai oleh service finance (P0C-2) dan test.
 *
 * P0C-3: setiap repository tersedia sebagai factory dengan resolusi koneksi
 * eksplisit (`createX(resolveDb)`) sehingga factory kanonik dapat menyuntikkan
 * koneksi yang sama. Singleton lama dipertahankan (resolusi lazy `getDb()`).
 */

export {
  createCashflowRepository,
  insertCashflow,
  mysqlCashflows,
  sumPaidForReference,
} from "./cashflows";
export type { CashflowFilter, CashflowTotals, MySqlCashflowRepository } from "./cashflows";
export {
  createClientPaymentScheduleRepository,
  createVendorPaymentScheduleRepository,
  mysqlClientPaymentSchedules,
  mysqlVendorPaymentSchedules,
} from "./schedules";
export {
  createJobCrewAssignmentRepository,
  mysqlJobCrewAssignments,
} from "./job-crew-assignments";
export { cashflowFingerprint, isDuplicateEntryError } from "./idempotency";
export type { Executor } from "./executor";

import type { Database } from "@/db";
import {
  createCashflowRepository,
  mysqlCashflows,
  type MySqlCashflowRepository,
} from "./cashflows";
import {
  createClientPaymentScheduleRepository,
  createVendorPaymentScheduleRepository,
  mysqlClientPaymentSchedules,
  mysqlVendorPaymentSchedules,
} from "./schedules";
import {
  createJobCrewAssignmentRepository,
  mysqlJobCrewAssignments,
} from "./job-crew-assignments";

/** Kumpulan repository finansial kanonik (singleton lama, lazy `getDb()`). */
export const mysqlFinanceRepositories = {
  cashflows: mysqlCashflows,
  clientPaymentSchedules: mysqlClientPaymentSchedules,
  vendorPaymentSchedules: mysqlVendorPaymentSchedules,
  jobCrewAssignments: mysqlJobCrewAssignments,
} as const;

/** Bentuk agregat repository finansial kanonik. */
export interface FinanceRepositories {
  cashflows: MySqlCashflowRepository;
  clientPaymentSchedules: typeof mysqlClientPaymentSchedules;
  vendorPaymentSchedules: typeof mysqlVendorPaymentSchedules;
  jobCrewAssignments: typeof mysqlJobCrewAssignments;
}

/**
 * Membangun agregat repository finansial dengan koneksi yang disuntikkan.
 * `resolveDb` dipanggil per operasi → tidak ada koneksi yang dibuka saat import.
 */
export function createFinanceRepositories(resolveDb: () => Database): FinanceRepositories {
  return {
    cashflows: createCashflowRepository(resolveDb),
    clientPaymentSchedules: createClientPaymentScheduleRepository(resolveDb),
    vendorPaymentSchedules: createVendorPaymentScheduleRepository(resolveDb),
    jobCrewAssignments: createJobCrewAssignmentRepository(resolveDb),
  };
}
