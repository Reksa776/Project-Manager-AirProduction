/**
 * Environment helper untuk koneksi database (server-side only).
 *
 * Runtime uses Supabase PostgreSQL through DATABASE_URL. The legacy
 * MySQL_SOURCE_URL is reserved for one-time source reads during data migration.
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
 * Fail-loud bila kosong / bukan PostgreSQL connection string.
 * Seluruh selubung tanda kutip dilepas agar aman untuk file .env.
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

  if (!/^postgres(?:ql)?:/i.test(url)) {
    throw new Error(
      "DATABASE_URL tidak valid: harus diawali dengan skema postgres:// atau postgresql://.",
    );
  }

  return url;
}

/** Sumber MySQL lama untuk preflight/migrasi data menuju Supabase. */
export function getMySqlSourceUrl(): string {
  ensureEnvFileLoaded();
  const raw = process.env.MYSQL_SOURCE_URL;
  if (!raw || !/^(mysql|mariadb):\/\//i.test(raw.trim())) {
    throw new Error("MYSQL_SOURCE_URL harus diatur ke koneksi MySQL sumber.");
  }
  return raw.trim().replace(/^mariadb:/i, "mysql:");
}
