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
 * client_payments — JADWAL tagihan client (termin), bukan kas.
 * Uang yang benar-benar diterima = cashflows (INCOME/CLIENT_PAYMENT).
 * Status bayar (UNPAID/PARTIAL/PAID) dihitung dari cashflow vs amount.
 */
export const clientPayments = pgTable(
  "client_payments",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    jobId: varchar("job_id", { length: 36 })
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    term: varchar("term", { length: 20 }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2, mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    paidDate: date("paid_date", { mode: "string" }),
    notes: text("notes"),
    ...timestamps(),
  },
  () => ({
    chkAmount: check(
      "chk_client_payments_amount_positive",
      sql`amount > 0`,
    ),
    chkTerm: check(
      "chk_client_payments_term",
      sql`term in ('TERMIN_1', 'TERMIN_2', 'TERMIN_3')`,
    ),
  }),
);
