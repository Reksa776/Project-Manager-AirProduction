import { getDb, type Database } from "@/db";
import type { MySqlRepositories } from "@/repositories/contract";
import {
  createFinanceRepositories,
  type MySqlCashflowRepository,
} from "@/repositories/mysql/finance";
import { createAdminRepository, createSessionRepository } from "./admin-sessions";
import { createDeliveryRepository } from "./deliveries";
import { createJobRepository } from "./jobs";
import { createPackageRepository } from "./packages";
import {
  createClientRepository,
  createCrewRepository,
  createCrewRoleRepository,
  createVendorRepository,
} from "./masters";

/**
 * FACTORY REPOSITORY MYSQL KANONIK (Contract v2).
 *
 * Membangun SELURUH anggota `MySqlRepositories` (12 repository) dengan satu
 * koneksi yang disuntikkan:
 * - `database` opsional: resolver koneksi. Default `getDb()` (dipanggil per
 *   operasi, BUKAN saat module import → tidak ada koneksi yang dibuka saat
 *   import, dan TIDAK ada fallback ke Google Sheets).
 * - Tidak ada implementasi placeholder yang melempar error: setiap method
 *   benar-benar menjalankan query.
 * - Tidak ada `any`/cast untuk menyembunyikan ketidakcocokan: bentuk aggregat
 *   diverifikasi oleh TypeScript terhadap `MySqlRepositories`.
 *
 * Factory ini HARUS dipanggil secara eksplisit oleh test atau kode integrasi
 * terisolasi. `getRepositories()` (runtime aplikasi) tetap Google Sheets.
 */

/** Agregat kanonik: Contract v2 + repository cashflow yang diperluas. */
export interface CanonicalMySqlRepositories extends MySqlRepositories {
  cashflows: MySqlCashflowRepository;
}

export interface CanonicalMySqlFactoryOptions {
  /** Resolver koneksi (mis. `() => injectedDb`). Default: `getDb`. */
  database?: () => Database;
}

/**
 * Method wajib per anggota Contract v2. Dipakai sebagai matriks implementasi
 * yang dapat diverifikasi (test) dan sebagai dokumentasi tunggal bentuk kontrak.
 */
export const CONTRACT_V2_METHODS = {
  jobs: ["getAll", "getById", "getByJobNumber", "create", "update", "delete"],
  packages: ["getAll", "getById", "create", "update", "delete"],
  clients: ["getAll", "getById", "create", "update", "delete"],
  vendors: ["getAll", "getById", "create", "update", "delete"],
  crew: ["getAll", "getById", "create", "update", "delete"],
  crewRoles: ["getAll", "getById", "create", "update", "delete"],
  deliveries: ["getAll", "getById", "getByJobId", "create", "update", "delete"],
  jobCrewAssignments: ["getAll", "getById", "getByJobId", "create", "update", "delete"],
  clientPaymentSchedules: ["getAll", "getById", "getByJobId", "create", "update", "delete"],
  vendorPaymentSchedules: ["getAll", "getById", "getByJobId", "create", "update", "delete"],
  cashflows: ["getAll", "getById", "getByJobId", "create"],
  admins: ["getAll", "getById"],
  sessions: ["getAll", "getById", "getByTokenHash"],
} as const satisfies Record<keyof MySqlRepositories, readonly string[]>;

export function createCanonicalMySqlRepositories(
  options: CanonicalMySqlFactoryOptions = {},
): CanonicalMySqlRepositories {
  const resolveDb: () => Database = options.database ?? getDb;
  const finance = createFinanceRepositories(resolveDb);

  return {
    jobs: createJobRepository(resolveDb),
    packages: createPackageRepository(resolveDb),
    clients: createClientRepository(resolveDb),
    vendors: createVendorRepository(resolveDb),
    crew: createCrewRepository(resolveDb),
    crewRoles: createCrewRoleRepository(resolveDb),
    deliveries: createDeliveryRepository(resolveDb),
    jobCrewAssignments: finance.jobCrewAssignments,
    clientPaymentSchedules: finance.clientPaymentSchedules,
    vendorPaymentSchedules: finance.vendorPaymentSchedules,
    cashflows: finance.cashflows,
    admins: createAdminRepository(resolveDb),
    sessions: createSessionRepository(resolveDb),
  };
}
