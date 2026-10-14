import type { RawWorksheetMatrix } from "@/migration";

/**
 * GERBANG SUMBER READ-ONLY (P0D-2A).
 *
 * Interface ini sengaja hanya memuat operasi BACA. Tidak ada `update`, `append`,
 * `clear`, atau `batchUpdate`. Implementasi live ada di `read-only-sheets.ts`;
 * test memakai implementasi palsu (fake) tanpa jaringan.
 */
export interface ReadOnlySheetsGateway {
  /** Mengembalikan matriks mentah 11 worksheet (baris 0 = header). */
  listWorksheetMatrices(): Promise<RawWorksheetMatrix[]>;
}
