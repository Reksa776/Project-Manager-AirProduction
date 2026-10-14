/**
 * Repository MySQL KANONIK (Contract v2) — P0C-3.
 *
 * Titik masuk tunggal: `createCanonicalMySqlRepositories()` (factory).
 * Tidak ada singleton modul: repository kanonik hanya dibentuk lewat factory
 * agar koneksi disuntikkan secara eksplisit dan tidak ada koneksi yang terbuka
 * saat module import.
 */

export {
  CONTRACT_V2_METHODS,
  createCanonicalMySqlRepositories,
} from "./factory";
export type {
  CanonicalMySqlFactoryOptions,
  CanonicalMySqlRepositories,
} from "./factory";

export {
  createClientRepository,
  createCrewRepository,
  createCrewRoleRepository,
  createVendorRepository,
} from "./masters";
export { createJobRepository } from "./jobs";
export { createDeliveryRepository } from "./deliveries";
export { createAdminRepository, createSessionRepository } from "./admin-sessions";
