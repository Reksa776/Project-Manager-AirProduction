import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { getDatabaseUrl } from "./env";
import * as schema from "./schema";

/**
 * Koneksi database Phase 1 (MySQL/MariaDB via Drizzle + mysql2 pool).
 *
 * Aturan:
 * - Server-side only: getDb() menolak dipanggil dari browser bundle.
 * - SATU connection pool dibuat per proses (di-cache lewat globalThis agar
 *   aman terhadap hot-reload Next.js dev yang menggandakan module instance).
 * - Kredensial hanya dibaca dari DATABASE_URL (src/db/env.ts), tidak pernah
 *   di-hardcode ataupun dicetak.
 * - Timezone: setiap koneksi diset `time_zone = '+00:00'` sehingga seluruh
 *   DEFAULT/ON UPDATE CURRENT_TIMESTAMP(3) tersimpan dalam UTC (lihat _shared.ts).
 * - dateStrings: true → DATE/DATETIME dikembalikan sebagai string apa adanya
 *   (tanpa konversi timezone driver), konsisten dengan mode "string" Drizzle.
 */

export type Database = MySql2Database<typeof schema>;

interface DbHandle {
  pool: mysql.Pool;
  db: Database;
}

const globalRef = globalThis as unknown as { __airprodDbHandle?: DbHandle };

function createHandle(url: string): DbHandle {
  const pool = mysql.createPool({
    uri: url,
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    dateStrings: true,
  });

  // mysql2/promise meneruskan event 'connection' dengan koneksi core (callback API).
  // SET time_zone per koneksi → seluruh DEFAULT/ON UPDATE CURRENT_TIMESTAMP(3) = UTC.
  pool.on("connection", (connection: unknown) => {
    const coreConnection = connection as {
      query(sql: string, callback: (err?: unknown) => void): unknown;
    };
    coreConnection.query("SET time_zone = '+00:00'", () => undefined);
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
