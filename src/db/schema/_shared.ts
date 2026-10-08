import { sql } from "drizzle-orm";
import { datetime } from "drizzle-orm/mysql-core";

/**
 * Kolom timestamp standar untuk seluruh tabel record.
 *
 * Kebijakan timezone (Phase 1):
 * - Semua nilai DATETIME disimpan sebagai **UTC**.
 * - Koneksi database menyetel `time_zone = '+00:00'` per koneksi (lihat src/db/index.ts),
 *   sehingga DEFAULT CURRENT_TIMESTAMP(3) selalu menghasilkan UTC.
 * - Mode string dipilih agar tidak ada konversi timezone ambigu di driver.
 * - `fsp: 3` → presisi milidetik.
 *
 * CATATAN PENTING (limitasi drizzle-orm 0.45):
 * Builder `datetime` TIDAK menyediakan method `onUpdateNow()` (hanya `timestamp`
 * yang memilikinya; `timestamp` punya batas year-2038 sehingga tidak dipakai).
 * Karena itu clause `on update CURRENT_TIMESTAMP(3)` untuk `updated_at`
 * DITAMBAHKAN MANUAL pada file SQL migration (drizzle/0000_*.sql) setelah
 * `drizzle-kit generate`. Migration file di-commit ke git sehingga tetap
 * deterministik dan reviewable. Lihat docs/PHASE-1-MYSQL-FOUNDATION.md.
 */
export function timestamps() {
  return {
    createdAt: datetime("created_at", { fsp: 3, mode: "string" })
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP(3))`),
    updatedAt: datetime("updated_at", { fsp: 3, mode: "string" })
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP(3))`),
  };
}
