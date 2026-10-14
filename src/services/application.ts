import type { Database } from "@/db";
import { sharedConnection, type ApplicationConnection } from "@/db/connection";
import {
  createMySqlApplication,
  type MySqlApplication,
} from "@/services/canonical";

/**
 * FONDASI KOMPOSISI APLIKASI (Contract v2) — P0E-1A.
 *
 * Satu-satunya titik komposisi backend MySQL kanonik untuk LAPISAN APLIKASI.
 * Modul ini murni komposisi + dependency injection: ia membangun ulang
 * implementasi kanonik yang SUDAH ADA (`createCanonicalMySqlRepositories()`
 * lewat `createMySqlApplication()`) dan tidak menambah abstraksi repository
 * pesaing.
 *
 * BATAS AKTIVASI (penting, sesuai P0E-1A):
 * - `getRepositories()` (`src/repositories/index.ts`) TETAP mengembalikan
 *   `googleRepositories`. Modul ini TIDAK dipanggil oleh layout, page, Server
 *   Action, maupun pemilihan runtime produksi.
 * - Aktivasi runtime adalah P0E-1B dan tetap bergantung pada persetujuan owner.
 * - Tidak ada fallback ke Google Sheets di jalur komposisi ini.
 *
 * Jaminan:
 * - Tidak ada koneksi yang dibuka saat module di-import; `resolve()` dipanggil
 *   per operasi dan default-nya memakai pool bersama `getDb()` (tanpa pool ganda).
 * - Kredensial hanya dibaca oleh `src/db/env.ts`; tidak pernah dicetak di sini.
 * - Invarian finansial kanonik tetap milik `createFinancialService` (tidak
 *   diduplikasi atau dirusak di sini).
 */

/** Backend aplikasi kanonik + lifecycle koneksi eksplisit. */
export interface ApplicationBackend extends MySqlApplication {
  /** Koneksi yang dipakai backend ini (lifecycle eksplisit, bukan global tersembunyi). */
  readonly connection: ApplicationConnection;
  /** Resolver koneksi per operasi (identik dengan `connection.resolve`). */
  readonly resolveDatabase: () => Database;
  /**
   * Menutup koneksi yang DIMILIKI backend. Idempoten.
   * `shared` = no-op (pool runtime tetap hidup); `isolated` = menutup pool.
   */
  dispose(): Promise<void>;
}

export interface ApplicationBackendOptions {
  /**
   * Koneksi eksplisit. Default `sharedConnection()` (pool runtime bersama,
   * memakai ulang `getDb()`) sehingga tidak ada pool kedua yang tidak disengaja.
   * Test integrasi terisolasi menyuntikkan `isolatedConnection(testUrl)`.
   */
  connection?: ApplicationConnection;
}

/**
 * Membangun backend aplikasi kanonik dengan koneksi yang disuntikkan.
 *
 * Kompatibel dengan arsitektur Next.js saat ini: mengembalikan objek biasa
 * (tanpa I/O saat konstruksi) sehingga aman di-import dari kode server tanpa
 * memicu koneksi. Pemanggil (P0E-1B) yang memutuskan kapan `dispose()` dipanggil.
 */
export function createApplicationBackend(
  options: ApplicationBackendOptions = {},
): ApplicationBackend {
  const connection = options.connection ?? sharedConnection();
  const resolveDatabase = () => connection.resolve();

  const application = createMySqlApplication({ database: resolveDatabase });

  return {
    ...application,
    connection,
    resolveDatabase,
    dispose: () => connection.dispose(),
  };
}

/** Re-export tipe kanonik agar lapisan aplikasi tidak perlu tahu lokasi internal. */
export type { MySqlApplication };
export type { CanonicalServices } from "@/services/canonical";
export type { FinancialOperations, MySqlRepositories } from "@/repositories/contract";
export type { FinancialService } from "@/services/finance-service";
