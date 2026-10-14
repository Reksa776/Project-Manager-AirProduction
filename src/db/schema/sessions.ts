import {
  char,
  timestamp,
  index,
  pgTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { admins } from "./admins";
import { timestamps } from "./_shared";

/**
 * sessions — sesi login (token cookie disimpan sebagai SHA-256 hex, bukan token mentah).
 * Hapus sesi = logout; masa berlaku diperiksa oleh `src/lib/auth.ts`.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    adminId: varchar("admin_id", { length: 36 })
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "string", precision: 3 }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "string", precision: 3 }),
    ...timestamps(),
  },
  (t) => ({
    uqTokenHash: uniqueIndex("uq_sessions_token_hash").on(t.tokenHash),
    idxExpiresAt: index("idx_sessions_expires_at").on(t.expiresAt),
  }),
);
