import path from "node:path";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { ensureEnvFileLoaded } from "@/db/env";
import {
  ensureTestDatabase,
  dropAllTestTables,
  resolveTestDatabaseUrl,
} from "./helpers/db";

/**
 * Setup Vitest Phase 1 — database smoke test.
 *
 * Urutan (semuanya HANYA di database `airprod_test`):
 * 1. Muat .env + guard: DATABASE_URL harus menunjuk `database-airprod`.
 * 2. CREATE DATABASE IF NOT EXISTS airprod_test (koneksi admin).
 * 3. Arahkan process.env.DATABASE_URL ke `airprod_test` → getDb() memakai URL test.
 * 4. Reset seluruh tabel lama di airprod_test (destructive, DB test saja).
 * 5. Apply migration dari folder `drizzle/` (deterministik, dari git).
 *
 * Database produksi `database-airprod` TIDAK PERNAH disentuh oleh test ini.
 */
ensureEnvFileLoaded();

// 1. Guard: DATABASE_URL harus menunjuk database produksi sebelum diubah apa pun.
const testUrl = resolveTestDatabaseUrl();

// 2. Buat database test (koneksi admin, tanpa menyentuh produksi).
await ensureTestDatabase();

// 3. Setelah guard lolos, semua koneksi dalam proses test (termasuk getDb())
//    memakai database test.
process.env.DATABASE_URL = testUrl;

// 4. Reset seluruh tabel lama di airprod_test (destructive, DB test saja).
await dropAllTestTables(testUrl);

// 5. Apply migration dari folder `drizzle/` (deterministik, dari git).
const pool = mysql.createPool({ uri: testUrl, multipleStatements: true, dateStrings: true });
try {
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
} finally {
  await pool.end();
}

export {};
