import type { Database } from "@/db";

/**
 * Eksekutor query yang dapat berupa pool (`Database`) atau transaksi Drizzle
 * (`MySqlTransaction`). Repository finansial menerima eksekutor agar operasi
 * tulis dapat ikut serta dalam transaksi milik service (atomicity).
 */
export type Executor = Pick<Database, "select" | "insert" | "update" | "delete">;
