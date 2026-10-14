import mysql, { type RowDataPacket } from "mysql2/promise";

import { ensureEnvFileLoaded, getDatabaseUrl } from "@/db/env";

/**
 * Helper test database (MySQL/MariaDB).
 *
 * JAMINAN KEAMANAN:
 * - Test hanya boleh menyentuh `airprod_test` (dibuat khusus untuk test).
 * - DATABASE_URL harus menunjuk salah satu database dasar yang DIKETAHUI
 *   (`database-airprod` produksi-like, atau `airprod_dev` development lokal —
 *   lihat P0E-DEV-1); selain itu proses STOP.
 * - URL test tidak pernah dicetak (bisa memuat kredensial).
 * - Guard ini SELALU menurunkan URL test menjadi `airprod_test` dan menolak
 *   database produksi sebagai target tulis.
 */

export const PROD_DATABASE = "database-airprod";
export const DEV_DATABASE = "airprod_dev";
export const TEST_DATABASE = "airprod_test";

/**
 * Database dasar yang URL-nya boleh dijadikan basis untuk menurunkan URL test.
 * `database-airprod` (produksi-like, dilindungi) dan `airprod_dev` (development
 * lokal P0E-DEV-1) — keduanya HANYA menjadi sumber nama host/kredensial; nama
 * database selalu diganti menjadi `airprod_test`.
 */
const ALLOWED_BASE_DATABASES = new Set([PROD_DATABASE, DEV_DATABASE]);

/** Ganti nama database pada connection string (tidak mencetak URL). */
export function replaceDatabaseName(url: string, dbName: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

/** URL yang menunjuk database test, dengan guard terhadap database produksi. */
export function resolveTestDatabaseUrl(): string {
  ensureEnvFileLoaded();
  const baseUrl = getDatabaseUrl();
  const current = new URL(baseUrl).pathname.replace(/^\//, "");
  if (!ALLOWED_BASE_DATABASES.has(current)) {
    throw new Error(
      `STOP: DATABASE_URL menunjuk database '${current}', diharapkan '${PROD_DATABASE}' ` +
        `atau '${DEV_DATABASE}'. Tidak ada test yang dijalankan untuk menghindari ` +
        `menyentuh database salah sasaran.`,
    );
  }
  const testUrl = replaceDatabaseName(baseUrl, TEST_DATABASE);
  if (testUrl === baseUrl || new URL(testUrl).pathname === `/${PROD_DATABASE}`) {
    throw new Error("STOP: URL test tidak boleh menunjuk database produksi.");
  }
  return testUrl;
}

/** Koneksi admin (tanpa schema aplikasi) — hanya untuk CREATE DATABASE test. */
export async function ensureTestDatabase(): Promise<void> {
  const adminUrl = replaceDatabaseName(getDatabaseUrl(), "information_schema");
  const conn = await mysql.createConnection(adminUrl);
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
  const conn = await mysql.createConnection(testUrl);
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
      [TEST_DATABASE],
    );
    for (const row of rows) {
      await conn.query(`DROP TABLE IF EXISTS \`${String(row.name)}\``);
    }
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    await conn.end();
  }
}
