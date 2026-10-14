import { sql } from "drizzle-orm";
import {
  char,
  check,
  date,
  numeric,
  index,
  pgTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { jobs } from "./jobs";
import { timestamps } from "./_shared";

/**
 * cashflows — satu-satunya sumber kebenaran uang (INCOME/EXPENSE).
 *
 * Setiap pembayaran/log kas = 1 baris. `reference_type`/`reference_id`
 * bersifat polimorfik (client_payment | vendor_payment | job_crew);
 * FK fisik tidak dapat dibuat untuk reference polimorfik → dijaga service
 * layer di dalam transaksi.
 *
 * P0C-2:
 * - `job_id` menjadi NULLABLE agar biaya operasional tanpa Job dapat dicatat
 *   tanpa menyalahgunakan Job dummy. FK tetap RESTRICT untuk transaksi ber-Job.
 * - `idempotency_key` UNIQUE + `idempotency_fingerprint` = idempotensi
 *   ter-dukung database (unique index) sehingga request identik yang
 *   berulang/bersamaan tidak membuat baris kas ganda. Nilai NULL diizinkan
 *   (MySQL mengizinkan banyak NULL pada unique index) untuk pencatatan tanpa key.
 * - `amount` dibaca/tulis sebagai string desimal (`mode: "string"`) agar tidak
 *   kehilangan presisi (numeric(15,2)); aritmetika tetap BigInt di domain.
 */
export const cashflows = pgTable(
  "cashflows",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    jobId: varchar("job_id", { length: 36 }).references(() => jobs.id, {
      onDelete: "restrict",
    }),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    direction: varchar("direction", { length: 10 }).notNull(),
    category: varchar("category", { length: 24 }).notNull(),
    amount: numeric("amount", { precision: 15, scale: 2, mode: "string" }).notNull(),
    description: varchar("description", { length: 190 }).notNull(),
    referenceType: varchar("reference_type", { length: 24 }),
    referenceId: varchar("reference_id", { length: 36 }),
    source: varchar("source", { length: 16 }).notNull().default("MANUAL"),
    /** Kunci idempotensi aplikatif; UNIQUE (nullable). */
    idempotencyKey: varchar("idempotency_key", { length: 190 }),
    /** SHA-256 payload kanonik → mendeteksi penggunaan key dengan payload berbeda. */
    idempotencyFingerprint: char("idempotency_fingerprint", { length: 64 }),
    ...timestamps(),
  },
  (t) => ({
    idxOccurredOn: index("idx_cashflows_occurred_on").on(t.occurredOn),
    idxDirectionCategory: index("idx_cashflows_direction_category").on(
      t.direction,
      t.category,
    ),
    idxReference: index("idx_cashflows_reference").on(
      t.referenceType,
      t.referenceId,
    ),
    uqIdempotencyKey: uniqueIndex("uq_cashflows_idempotency_key").on(
      t.idempotencyKey,
    ),
    chkAmountPositive: check("chk_cashflows_amount_positive", sql`amount > 0`),
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
    chkSource: check("chk_cashflows_source", sql`source in ('MANUAL', 'MIGRATION')`),
  }),
);
