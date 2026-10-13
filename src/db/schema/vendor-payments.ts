import { pgTable, check, date, decimal, sql, varchar } from "drizzle-orm/pg-core";

/**
 * vendor_payments — JADWAL pembayaran vendor (DP/Pelunasan), bukan kas.
 * Uang yang benar-benar dibayar = cashflows (EXPENSE/VENDOR_PAYMENT).
 * Status bayar dihitung dari cashflow vs amount — tidak disimpan.
 */
export const vendorPayments = pgTable("vendor_payments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  jobId: varchar("job_id", { length: 36 })
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2, mode: "number" }).notNull(),
  dueDate: date("due_date", { mode: "string" }),
  paidDate: date("paid_date", { mode: "string" }),
  notes: text("notes"),
  ...timestamps(),
}, (t) => ({
  chkAmount: check("chk_vendor_payments_amount_positive", sql`amount > 0`),
}));

export const vendorPaymentRelations = relations(vendorPayments, one(jobs));