import { googleRepositories } from "@/repositories/google";
import { mockRepositories } from "@/repositories/mock";
import type { DataRepositories } from "@/repositories/types";

/**
 * Provider repository aktif.
 *
 * Phase 2E: `getRepositories()` menggunakan Google Sheets repository
 * (read-only). `mockRepositories` tetap tersedia sebagai implementasi
 * fallback/testing. Titik switch tunggal tetap di fungsi ini.
 *
 * Catatan: `mockRepositories` diekspor ulang agar tetap mudah diakses
 * untuk kebutuhan testing tanpa mengubah service maupun UI.
 */
export function getRepositories(): DataRepositories {
  return googleRepositories;
}

export { mockRepositories };
