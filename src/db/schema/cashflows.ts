import { pgTable, decimal, sql, varchar } from "drizzle-orm/pg-core";

/**
 * cashflows — rekam setiap uang yang masuk/keluar secara eksplosif.
 * Mode: INCOME (dari client) atau EXPENSE (ke vendor).
 * Setiap catatan wajib punya jobId + type + referenceType + referenceId.
 * Tidak ada duplikat: setiap pembayaran/log transaksi = 1 baris cashflow.
 */
export const cashflows = pgTable("cashflows", {
  id: varchar("id", { length: 36 }).primaryKey(),
  jobId: varchar("job_id", { length: 36 }).references(() => jobs.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull().check("type IN ('INCOME', 'EXPENSE')"),
  amount: decimal("amount", { precision: 15, scale: 2, mode: "number" }).notNull(),
  direction: varchar("direction", { length: 20 }).notNull().check("direction IN ('CLIENT', 'VENDOR')"),
  referenceType: varchar("reference_type", { length: 30 }).notNull().check("referenceType IN ('client_payment', 'vendor_payment', 'job_crew')"),
  referenceId: varchar("reference_id", { length: 36 }).notNull(),
  notes: text("notes"),
  ...timestamps(),
});