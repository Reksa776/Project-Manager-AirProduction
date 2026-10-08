import mysql from "mysql2/promise";
import { ensureEnvFileLoaded, getDatabaseUrl } from "@/db/env";

/**
 * Helper test database Phase 1.
 *
 * JAMINAN KEAMANAN:
 * - Test hanya boleh menyentuh `airprod_test` (dibuat khusus untuk test).
 * - Jika DATABASE_URL tidak menunjuk `database-airprod`, proses STOP.
 * - URL test tidak pernah dicetak (bisa memuat kredensial).
 */

export const PROD_DATABASE = "database-airprod";
export const TEST_DATABASE = "airprod_test";

/** Ganti nama database pada connection string mysql:// (tanpa mencetak URL). */
export function replaceDatabaseName(url: string, dbName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

/** URL yang menunjuk database test, dengan guard terhadap database produksi. */
export function resolveTestDatabaseUrl(): string {
  ensureEnvFileLoaded();
  const prodUrl = getDatabaseUrl();
  const current = new URL(prodUrl).pathname.replace(/^\//, "");
  if (current !== PROD_DATABASE) {
    throw new Error(
      `STOP: DATABASE_URL menunjuk database '${current}', diharapkan '${PROD_DATABASE}'. ` +
        `Tidak ada test yang dijalankan untuk menghindari menyentuh database salah sasaran.`,
    );
  }
  const testUrl = replaceDatabaseName(prodUrl, TEST_DATABASE);
  if (testUrl === prodUrl || new URL(testUrl).pathname === `/${PROD_DATABASE}`) {
    throw new Error("STOP: URL test tidak boleh menunjuk database produksi.");
  }
  return testUrl;
}

/** Koneksi admin (tanpa schema) — hanya untuk CREATE DATABASE test. */
export async function ensureTestDatabase(): Promise<void> {
  const adminUrl = replaceDatabaseName(getDatabaseUrl(), "information_schema");
  const conn = await mysql.createConnection({ uri: adminUrl });
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${TEST_DATABASE}\` CHARACTER SET utf8mb4`,
    );
  } finally {
    await conn.end();
  }
}

/** Hapus SEMUA tabel di database test (destructive, hanya `airprod_test`). */
export async function dropAllTestTables(testUrl: string): Promise<void> {
  if (new URL(testUrl).pathname !== `/${TEST_DATABASE}`) {
    throw new Error("STOP: dropAllTestTables hanya boleh menerima URL database test.");
  }
  const conn = await mysql.createConnection({ uri: testUrl });
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    const [rows] = (await conn.query(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
      [TEST_DATABASE],
    )) as unknown as [Array<{ name: string }>];
    for (const row of rows) {
      await conn.query(`DROP TABLE IF EXISTS \`${row.name}\``);
    }
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    await conn.end();
  }
}
