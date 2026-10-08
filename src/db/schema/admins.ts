import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  datetime,
  mysqlTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { timestamps } from "./_shared";

/**
 * admins — sumber kebenaran autentikasi (MySQL-backed; login diimplementasikan di Phase auth).
 * passwordHash memuat hash scrypt (format `scrypt$N$r$p$salt$hash`).
 */
export const admins = mysqlTable(
  "admins",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 190 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 }).notNull().default("ADMIN"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: datetime("last_login_at", { fsp: 3, mode: "string" }),
    ...timestamps(),
  },
  (t) => ({
    uqEmail: uniqueIndex("uq_admins_email").on(t.email),
    chkRole: check("chk_admins_role", sql`role in ('OWNER', 'ADMIN', 'STAFF')`),
  }),
);
