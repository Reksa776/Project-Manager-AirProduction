import { sql } from "drizzle-orm";
import { check, date, decimal, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { timestamps } from "./_shared";
import { jobs } from "./jobs";

/**
 * client_payments — JADWAL tagihan client (termin), bukan kas.
 * Uang yang benar-benar diterima = cashflows (INCOME/CLIENT_PAYMENT).
 * Status bayar (UNPAID/PARTIAL/PAID) dihitung dari cashflow vs amount — tidak disimpan.
 */
export const clientPayments = mysqlTable(
  "client_payments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    jobId: varchar("job_id", { length: 36 })
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    term: varchar("term", { length: 20 }).notNull(),
    amount: decimal("amount", { precision: 15, scale: 2, mode: "number" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    paidDate: date("paid_date", { mode: "string" }),
    notes: text("notes"),
    ...timestamps(),
  },
  () => ({
    chkAmount: check("chk_client_payments_amount_positive", sql`amount > 0`),
    chkTerm: check(
      "chk_client_payments_term",
      sql`term in ('TERMIN_1', 'TERMIN_2', 'TERMIN_3')`,
    ),
  }),
);
