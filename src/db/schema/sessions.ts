import { pgTable, char, datetime, sql, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/**
 * sessions — sesi login (token cookie disimpan sebagai SHA-256 hex, bukan token mentah).
 * Hapus sesi = logout; expired dicek terhadap expires_at pada Phase auth.
 */
export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  adminId: varchar("admin_id", { length: 36 })
    .notNull()
    .references(() => admins.id, { onDelete: "cascade" }),
  tokenHash: char("token_hash", { length: 64 }).notNull(),
  expiresAt: datetime("expires_at", { fsp: 3, mode: "string" }).notNull(),
  lastSeenAt: datetime("last_seen_at", { fsp: 3, mode: "string" }),
  ...timestamps(),
}, (t) => ({
  uqTokenHash: uniqueIndex("uq_sessions_token_hash").on(t.tokenHash),
  idxExpiresAt: index("idx_sessions_expires_at").on(t.expiresAt),
}));

export const sessionRelations = relations(sessions, one(admins));