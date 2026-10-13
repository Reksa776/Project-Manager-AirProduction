import { drizzle, type PgDatabase } from "drizzle-orm/postgres";
import { Pool } from "pg";
import { getDatabaseUrl } from "./env";
import * as schema from "./schema";

/**
 * Koneksi database Phase 3 (PostgreSQL via Drizzle + pg pool).
 *
 * Aturan:
 * - Server-side only: getDb() menolak dipanggil dari browser bundle.
 * - SATU connection pool dibuat per proses (di-cache lewat globalThis agar
 *   aman terhadap hot-reload Next.js dev yang menggandakan module instance).
 * - Kredensial hanya dibaca dari DATABASE_URL (src/db/env.ts), tidak pernah
 *   di-hardcode ataupun dicetak.
 * - Timezone: setiap koneksi diset `time_zone = '+00:00'` sehingga seluruh
 *   DEFAULT/ON UPDATE CURRENT_TIMESTAMP(3) tersimpan dalam UTC (lihat _shared.ts).
 */

export type Database = PgDatabase<typeof schema>;

interface DbHandle {
  pool: Pool;
  db: Database;
}

const globalRef = globalThis as unknown as { __airprodDbHandle?: DbHandle };

function createHandle(url: string): DbHandle {
  const pool = new Pool({
    connectionString: url,
    connectionLimit: 10,
    max: 10,
    idleTimeoutMillis: 30000,
    commandTimeout: 30000,
  });

  // SET time_zone per koneksi → seluruh DEFAULT/ON UPDATE CURRENT_TIMESTAMP(3) = UTC.
  pool.on("connect", (client) => {
    client.query("SET time_zone = '+00:00'", (err) => {
      if (err) console.warn("Gagal SET time_zone:", err);
    });
  });

  const db = drizzle(pool, { schema, mode: "default" });
  return { pool, db };
}

/** Ambil (atau buat sekali) koneksi Drizzle untuk server. */
export function getDb(): Database {
  if (typeof window !== "undefined") {
    throw new Error("getDb() hanya dapat dipanggil di sisi server.");
  }
  if (!globalRef.__airprodDbHandle) {
    globalRef.__airprodDbHandle = createHandle(getDatabaseUrl());
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