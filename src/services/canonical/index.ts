import type { Database } from "@/db";
import { getDb } from "@/db";
import type { FinancialOperations, MySqlRepositories } from "@/repositories/contract";
import {
  createCanonicalMySqlRepositories,
  type CanonicalMySqlFactoryOptions,
  type CanonicalMySqlRepositories,
} from "@/repositories/mysql/canonical";
import {
  createFinancialService,
  type FinancialService,
} from "@/services/finance-service";
import { createAdminSessionService, type CanonicalAdminSessionService } from "./admin-sessions";
import { createDeliveryService, type CanonicalDeliveryService } from "./deliveries";
import { createJobService, type CanonicalJobService } from "./jobs";
import { createMasterService, type CanonicalMasterService } from "./masters";

/**
 * SERVICE LAYER KANONIK (Contract v2) — P0C-3.
 *
 * BATAS KOMPATIBILITAS LEGACY ↔ KANONIK
 * - Modul di folder ini HANYA bergantung pada Contract v2
 *   (`src/repositories/contract`) dan domain kanonik (`src/domain/**`).
 * - Tidak ada impor ke kontrak legacy (`src/repositories/types.ts`), domain lama
 *   (`src/lib/types.ts`), repository Google, atau Server Action/UI.
 * - Karena itu penukaran sumber data (Google → MySQL) di kemudian hari cukup
 *   dengan menyediakan agregat Contract v2 + `FinancialOperations`, tanpa
 *   menyentuh halaman/action yang sudah aktif.
 *
 * Dependency injection eksplisit: repository dan operasi finansial diterima
 * sebagai parameter (`createCanonicalServices`) sehingga dapat diuji secara
 * terisolasi dengan koneksi apa pun, termasuk database test.
 */

export { CanonicalServiceError } from "./errors";
export type { CanonicalAdminSessionService } from "./admin-sessions";
export type { CanonicalDeliveryService } from "./deliveries";
export type { CanonicalCounterparty, CanonicalJobDetail, CanonicalJobService } from "./jobs";
export type { CanonicalMasterService, CrewDirectoryEntry } from "./masters";

export { createAdminSessionService, createDeliveryService, createJobService, createMasterService };

/**
 * Service kanonik yang bergantung pada repository kanonik.
 *
 * `services.financial` adalah instance finansial KONKRET (bukan hanya tipe
 * `FinancialOperations`) supaya helper turunan (`getJobFinancialSummary`,
 * `deriveCrewSettlement`) tetap tersedia bagi pemanggil kanonik. Ia tetap
 * memenuhi `FinancialOperations` dan TIDAK ada operasi finansial yang
 * dilewati/diduplikasi di sini.
 */
export interface CanonicalServices {
  master: CanonicalMasterService;
  jobs: CanonicalJobService;
  deliveries: CanonicalDeliveryService;
  adminSessions: CanonicalAdminSessionService;
  financial: FinancialService;
}

export interface CanonicalServiceDependencies {
  repositories: MySqlRepositories;
  financial: FinancialService;
}

export function createCanonicalServices(
  dependencies: CanonicalServiceDependencies,
): CanonicalServices {
  const { repositories, financial } = dependencies;
  return {
    master: createMasterService(repositories),
    jobs: createJobService(repositories),
    deliveries: createDeliveryService(repositories),
    adminSessions: createAdminSessionService(repositories),
    financial,
  };
}

/** Bootstrap lengkap backend MySQL kanonik (repository + service). */
export interface MySqlApplication {
  repositories: CanonicalMySqlRepositories;
  /** Instance finansial konkret; memenuhi `FinancialOperations`. */
  financial: FinancialService;
  services: CanonicalServices;
}

/**
 * Membangun backend MySQL kanonik lengkap dengan SATU koneksi yang disuntikkan.
 *
 * PENTING: fungsi ini TIDAK dipanggil oleh runtime aplikasi. `getRepositories()`
 * tetap mengembalikan `googleRepositories`; bootstrap ini hanya dipakai test
 * integrasi dan kode isolasi sampai fase aktivasi (P0E).
 * `database` default `getDb()` dan dipanggil per operasi (bukan saat import).
 */
export function createMySqlApplication(
  options: CanonicalMySqlFactoryOptions = {},
): MySqlApplication {
  const resolveDb: () => Database = options.database ?? getDb;
  const repositories = createCanonicalMySqlRepositories({ database: resolveDb });
  const financial = createFinancialService(resolveDb);
  const services = createCanonicalServices({ repositories, financial });
  return { repositories, financial, services };
}

/** Alias tipe eksplisit untuk `financial` ketika hanya kontrak yang dibutuhkan. */
export type CanonicalFinancialOperations = FinancialOperations;
