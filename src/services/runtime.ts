import {
  createApplicationBackend,
  type ApplicationBackend,
} from "@/services/application";

/**
 * BATAS KOMPOSISI/PROVIDER TUNGGAL RUNTIME APLIKASI (P0E-1B).
 *
 * Ini SATU-SATUNYA titik yang membangun backend kanonik (Contract v2) untuk
 * aplikasi. Halaman, layout, dan Server Action mengonsumsi service kanonik
 * lewat helper ini — bukan lewat repository Google Sheets maupun `getRepositories()`.
 *
 * Jaminan:
 * - TIDAK ada koneksi/pool yang dibuka saat module di-import. Backend dibangun
 *   lazy pada pemanggilan pertama `getApplication()`.
 * - Memakai `sharedConnection()` (default `createApplicationBackend()`), yaitu
 *   pool runtime bersama `getDb()` — TIDAK menggandakan pool.
 * - Instance di-cache per proses agar hot-reload/dev tidak membangun ulang
 *   komposisi (pool tetap satu karena `getDb()` sudah `globalThis`-cached).
 * - TIDAK ada fallback ke Google Sheets. Bila `DATABASE_URL` tidak diatur,
 *   error eksplisit baru muncul ketika operasi benar-benar dijalankan.
 *
 * Catatan aktivasi: modul ini hanya membaca/menulis ke database yang ditunjuk
 * `DATABASE_URL`. Database runtime adalah Supabase PostgreSQL.
 */

let cached: ApplicationBackend | undefined;

/** Backend kanonik aplikasi (lazy, satu per proses). */
export function getApplication(): ApplicationBackend {
  if (!cached) {
    cached = createApplicationBackend();
  }
  return cached;
}

/**
 * Buang cache backend (dipakai test untuk memverifikasi konstruksi lazy).
 * TIDAK menutup pool bersama; lifecycle pool tetap milik `getDb()`/`closeDb()`.
 */
export function resetApplicationRuntime(): void {
  cached = undefined;
}
