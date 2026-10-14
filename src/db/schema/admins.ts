import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  timestamp,
  pgTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { timestamps } from "./_shared";

/**
 * admins — sumber kebenaran autentikasi.
 * password_hash memuat hash scrypt (format `scrypt$N$r$p$salt$hash`).
 * Password diproses oleh `src/lib/auth.ts`; yang tersimpan hanya hash scrypt.
 */
export const admins = pgTable(
  "admins",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 190 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 }).notNull().default("ADMIN"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { mode: "string", precision: 3 }),
    ...timestamps(),
  },
  (t) => ({
    uqEmail: uniqueIndex("uq_admins_email").on(t.email),
    chkRole: check("chk_admins_role", sql`role in ('OWNER', 'ADMIN', 'STAFF')`),
  }),
);
