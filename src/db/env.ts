/**
 * Environment helper untuk koneksi database (server-side only).
 *
 * Sumber kebenaran koneksi: variabel DATABASE_URL.
 * Nilai credentials TIDAK PERNAH dicetak/di-log — hanya pesan error umum.
 */

/** Muat .env bila tersedia. Next.js sudah memuat .env sendiri; ini untuk tooling (drizzle-kit/vitest). */
export function ensureEnvFileLoaded(): void {
  try {
    process.loadEnvFile();
  } catch {
    // File .env tidak ada — biarkan environment luar yang menyediakan DATABASE_URL.
  }
}

/**
 * Baca dan validasi DATABASE_URL.
 * Fail-loud bila kosong / bukan connection string mysql://.
 * Seluruh selubung tanda kutip dilepas agar aman untuk format `DATABASE_URL="mysql://..."`.
 */
export function getDatabaseUrl(): string {
  ensureEnvFileLoaded();

  const raw = process.env.DATABASE_URL;
  if (!raw || raw.trim() === "") {
    throw new Error(
      "DATABASE_URL belum diatur. Isi file .env (atau environment) sebelum menjalankan perintah database.",
    );
  }

  let url = raw.trim();
  const quoted =
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"));
  if (quoted) {
    url = url.slice(1, -1);
  }

  if (!/^mysql:\/\//i.test(url)) {
    throw new Error("DATABASE_URL tidak valid: harus diawali dengan skema mysql://.");
  }

  return url;
}
