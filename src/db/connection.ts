import type { Database } from "@/db";
import { createDatabaseHandle, getDb } from "@/db";

/**
 * LIFECYCLE KONEKSI EKSPLISIT — P0E-1A.
 *
 * Komposisi backend kanonik (`src/services/application.ts`) menerima sebuah
 * `ApplicationConnection`, bukan koneksi global tersembunyi. Tujuannya:
 * - TIDAK ada koneksi/pool yang dibuka saat module di-import (semuanya lazy).
 * - Pool bersama runtime (SATU per proses, dari `getDb()`) DIPAKAI ULANG,
 *   bukan digandakan.
 * - Koneksi terisolasi (mis. `airprod_test`) punya lifecycle yang JELAS dan
 *   ditutup secara idempoten — tidak ada kebocoran pool di test.
 * - Modul ini TIDAK pernah menyentuh Google Sheets dan tidak membaca
 *   `DATABASE_URL` sendiri kecuali melalui `getDb()` (pool bersama).
 */

export type ApplicationConnectionKind = "shared" | "isolated";

export interface ApplicationConnection {
  /** `shared` = pool runtime bersama; `isolated` = pool yang dimiliki pemanggil. */
  readonly kind: ApplicationConnectionKind;
  /**
   * Resolver koneksi. Membuka pool pada pemanggilan PERTAMA, bukan saat
   * `sharedConnection()`/`isolatedConnection()` dibuat.
   */
  resolve(): Database;
  /**
   * Menutup koneksi yang DIMILIKI. Selalu idempoten.
   * - `shared`: no-op — pool runtime bersama tidak boleh dimatikan oleh
   *   `dispose()` sebuah backend (lifecycle prosesnya milik `closeDb()`).
   * - `isolated`: menutup pool yang dibuat modul ini.
   */
  dispose(): Promise<void>;
}

/**
 * Koneksi pool bersama runtime. `resolve()` selalu mengembalikan instance
 * `getDb()` yang sama → mencegah pool ganda saat backend dibangun berulang.
 */
export function sharedConnection(): ApplicationConnection {
  return {
    kind: "shared",
    resolve: () => getDb(),
    dispose: async () => {
      // Sengaja no-op: pool bersama hidup selama proses. Graceful shutdown /
      // test memakai `closeDb()` secara eksplisit.
    },
  };
}

/**
 * Koneksi PostgreSQL terisolasi dari connection string eksplisit (mis. URL
 * `airprod_test` dari `tests/helpers/db.ts`). Pool HANYA dibuat pada
 * `resolve()` pertama dan ditutup oleh `dispose()`.
 *
 * Catatan: ini TIDAK menggandakan pool runtime — pool runtime tetap milik
 * `getDb()`; koneksi ini adalah pool terpisah yang dimiliki pemanggil dan
 * wajib di-dispose.
 */
export function isolatedConnection(url: string): ApplicationConnection {
  let handle: ReturnType<typeof createDatabaseHandle> | undefined;
  let closed = false;

  return {
    kind: "isolated",
    resolve(): Database {
      if (closed) {
        throw new Error(
          "Koneksi terisolasi sudah ditutup (dispose()). Tidak ada koneksi yang dibuka ulang.",
        );
      }
      if (!handle) handle = createDatabaseHandle(url);
      return handle.db;
    },
    async dispose(): Promise<void> {
      if (closed) return;
      closed = true;
      const current = handle;
      handle = undefined;
      if (current) await current.pool.end();
    },
  };
}
