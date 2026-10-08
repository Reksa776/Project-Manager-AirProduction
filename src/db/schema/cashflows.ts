import { sql } from "drizzle-orm";
import {
  check,
  date,
  decimal,
  index,
  mysqlTable,
  varchar,
} from "drizzle-orm/mysql-core";
import { timestamps } from "./_shared";
import { jobs } from "./jobs";

/**
 * cashflows — SATU-SATUNYA sumber kebenaran transaksi uang.
 *
 * Aturan arah ↔ kategori (CHECK di database):
 *   INCOME  → CLIENT_PAYMENT
 *   EXPENSE → CREW_PAYMENT | VENDOR_PAYMENT | TRANSPORT | EQUIPMENT | OTHER
 *
 * amount selalu positif; arah disimpan di `direction`.
 * `reference_type`/`reference_id` bersifat polimorfik (client_payment |
 * vendor_payment | job_crew) — keduanya wajib terisi bersamaan (CHECK),
 * integritas referensinya dijaga service layer dalam transaksi.
 * `source` menandai row hasil migrasi Sheets ('MIGRATION') vs input manual.
 */
export const cashflows = mysqlTable(
  "cashflows",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    jobId: varchar("job_id", { length: 36 })
      .notNull()
      .references(() => jobs.id, { onDelete: "restrict" }),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    direction: varchar("direction", { length: 10 }).notNull(),
    category: varchar("category", { length: 24 }).notNull(),
    amount: decimal("amount", { precision: 15, scale: 2, mode: "number" }).notNull(),
    description: varchar("description", { length: 190 }).notNull(),
    referenceType: varchar("reference_type", { length: 24 }),
    referenceId: varchar("reference_id", { length: 36 }),
    source: varchar("source", { length: 16 }).notNull().default("MANUAL"),
    ...timestamps(),
  },
  (t) => ({
    chkAmount: check("chk_cashflows_amount_positive", sql`amount > 0`),
    chkDirection: check(
      "chk_cashflows_direction",
      sql`direction in ('INCOME', 'EXPENSE')`,
    ),
    chkCategory: check(
      "chk_cashflows_category",
      sql`category in ('CLIENT_PAYMENT', 'CREW_PAYMENT', 'VENDOR_PAYMENT', 'TRANSPORT', 'EQUIPMENT', 'OTHER')`,
    ),
    chkDirectionCategory: check(
      "chk_cashflows_direction_category",
      sql`(direction = 'INCOME' and category = 'CLIENT_PAYMENT')
          or (direction = 'EXPENSE' and category in ('CREW_PAYMENT', 'VENDOR_PAYMENT', 'TRANSPORT', 'EQUIPMENT', 'OTHER'))`,
    ),
    chkReference: check(
      "chk_cashflows_reference",
      sql`(reference_type is null and reference_id is null)
          or (reference_type is not null
              and reference_id is not null
              and reference_type in ('client_payment', 'vendor_payment', 'job_crew'))`,
    ),
    chkSource: check(
      "chk_cashflows_source",
      sql`source in ('MANUAL', 'MIGRATION')`,
    ),
    idxOccurredOn: index("idx_cashflows_occurred_on").on(t.occurredOn),
    idxDirectionCategory: index("idx_cashflows_direction_category").on(
      t.direction,
      t.category,
    ),
    idxReference: index("idx_cashflows_reference").on(t.referenceType, t.referenceId),
  }),
);
