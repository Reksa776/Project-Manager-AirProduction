import { pgTable, decimal, varchar } from "drizzle-orm/pg-core";

/**
 * job_crews — assignment crew pada job (relasi murni, tanpa kolom uang).
 *
 * - `agreed_amount` = nilai kesepakatan pembayaran (bukan kas).
 * - Uang BENAR-BENAR dibayar dicatat sebagai cashflows dengan
 *   reference_type='job_crew' (Phase cashflow).
 * - `crew_role_id` NULL → role tampil mengikuti crew.crew_role_id (override per-job).
 */
export const jobCrews = pgTable("job_crews", {
  id: varchar("id", { length: 36 }).primaryKey(),
  jobId: varchar("job_id", { length: 36 })
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  crewId: varchar("crew_id", { length: 36 })
    .notNull()
    .references(() => crew.id, { onDelete: "restrict" }),
  crewRoleId: varchar("crew_role_id", { length: 36 }).references(() => crewRoles.id, { onDelete: "set null" }),
  agreedAmount: decimal("agreed_amount", { precision: 15, scale: 2, mode: "number" }).notNull().default(0),
  actualPayment: decimal("actual_payment", { precision: 15, scale: 2, mode: "number" }).notNull().default(0),
  paymentStatus: varchar("payment_status", { length: 20 }).default("UNPAID").check("payment_status IN ('UNPAID', 'PARTIAL', 'PAID')"),
  notes: text("notes"),
  ...timestamps(),
});