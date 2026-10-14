import { sql } from "drizzle-orm";
import {
  check,
  date,
  numeric,
  pgTable,
  text,
  varchar,
} from "drizzle-orm/pg-core";

import { jobs } from "./jobs";
import { timestamps } from "./_shared";

/**
 * vendor_payments — JADWAL tagihan ke vendor (DP/Pelunasan), bukan kas.
 * Uang yang benar-benar keluar = cashflows (EXPENSE/VENDOR_PAYMENT).
 */
export const vendorPayments = pgTable(
  "vendor_payments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    jobId: varchar("job_id", { length: 36 })
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2, mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    paidDate: date("paid_date", { mode: "string" }),
    notes: text("notes"),
    ...timestamps(),
  },
  () => ({
    chkAmount: check(
      "chk_vendor_payments_amount_positive",
      sql`amount > 0`,
    ),
    chkType: check(
      "chk_vendor_payments_type",
      sql`type in ('DP', 'PELUNASAN')`,
    ),
  }),
);
