import { pgTable, check, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * admins — sumber kebenaran autentikasi (PostgreSQL-backed; login diimplementasikan di Phase auth).
 * passwordHash memuat hash scrypt (format `scrypt$N$r$p$salt$hash`).
 * auth_user_id: kunci pengikat ke akun Supabase Auth (email/password).
 * Tidak boleh diubah: admins.id tetap menjadi business ID asli.
 */
export const admins = pgTable("admins", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 190 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("ADMIN"),
  isActive: boolean("is_active"), // TypeScript warning: boolean hanya tipe, nilai valid di runtime
  lastLoginAt: timestamp("last_login_at", { mode: "string" }),
  authUserId: varchar("auth_user_id", { length: 128 }),
  ...timestamps(),
}, (t) => ({
  uqEmail: uniqueIndex("uq_admins_email").on(t.email),
  chkRole: check("chk_admins_role", sql`role in ('OWNER', 'ADMIN', 'STAFF')`),
}));