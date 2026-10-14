import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getDatabaseUrl } from "./env";
import * as schema from "./schema";

/**
 * Koneksi database PostgreSQL (Supabase) via Drizzle + node-postgres pool.
 *
 * Aturan:
 * - Server-side only: getDb() menolak dipanggil dari browser bundle.
 * - SATU connection pool dibuat per proses (di-cache lewat globalThis agar
 *   aman terhadap hot-reload Next.js dev yang menggandakan module instance).
 * - Kredensial hanya dibaca dari DATABASE_URL (src/db/env.ts), tidak pernah
 *   di-hardcode ataupun dicetak.
 * - Timestamp disimpan sebagai UTC; PostgreSQL mengelola timestamptz secara native.
 * - Koneksi dibuat LAMBAT (lazy) saat getDb() pertama kali dipanggil, bukan
 *   saat module di-import.
 */

export type Database = NodePgDatabase<typeof schema>;

export interface DbHandle {
  pool: Pool;
  db: Database;
}

const globalRef = globalThis as unknown as { __airprodDbHandle?: DbHandle };

/**
 * Membuat SATU handle koneksi (PostgreSQL pool + Drizzle) dari connection string.
 *
 * Dipakai oleh `getDb()` (pool bersama runtime) dan oleh koneksi terisolasi
 * eksplisit (`src/db/connection.ts`, mis. untuk test database). Sengaja TIDAK
 * memakai `getDatabaseUrl()` agar pemanggil dapat menyuntikkan URL secara
 * eksplisit tanpa mengubah environment. Tidak ada koneksi yang dibuka saat
 * module ini di-import: pg pool bersifat lazy.
 */
export function createDatabaseHandle(url: string): DbHandle {
  const pool = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 60_000 });
  const db = drizzle(pool, { schema });
  return { pool, db };
}

/** Ambil (atau buat sekali) koneksi Drizzle untuk server. */
export function getDb(): Database {
  if (typeof window !== "undefined") {
    throw new Error("getDb() hanya dapat dipanggil di sisi server.");
  }
  if (!globalRef.__airprodDbHandle) {
    globalRef.__airprodDbHandle = createDatabaseHandle(getDatabaseUrl());
  }
  return globalRef.__airprodDbHandle.db;
}

/** Tutup pool (dipakai test / graceful shutdown). Aman dipanggil berulang. */
export async function closeDb(): Promise<void> {
  const handle = globalRef.__airprodDbHandle;
  if (!handle) return;
  globalRef.__airprodDbHandle = undefined;
  await handle.pool.end();
}
