import { mockRepositories } from "@/repositories/mock";
import type { DataRepositories } from "@/repositories/types";

/**
 * Provider repository aktif.
 *
 * Pada Phase 1 data berasal dari mock. Pada phase berikutnya, cukup ubah
 * fungsi ini untuk mengembalikan implementasi Google Sheets — service dan UI
 * tidak perlu diubah.
 */
export function getRepositories(): DataRepositories {
  return mockRepositories;
}
