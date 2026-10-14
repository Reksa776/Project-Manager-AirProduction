import { sql } from "drizzle-orm";
import {
  check,
  date,
  integer,
  pgTable,
  text,
  varchar,
} from "drizzle-orm/pg-core";

import { jobs } from "./jobs";
import { timestamps } from "./_shared";

/**
 * deliveries — deliverable per job (terpisah dari status job).
 */
export const deliveries = pgTable(
  "deliveries",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    jobId: varchar("job_id", { length: 36 })
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    deliveryType: varchar("delivery_type", { length: 40 }),
    quantity: integer("quantity"),
    deadline: date("deadline", { mode: "string" }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    deliveredAt: date("delivered_at", { mode: "string" }),
    notes: text("notes"),
    ...timestamps(),
  },
  () => ({
    chkQuantity: check(
      "chk_deliveries_quantity",
      sql`quantity is null or quantity >= 0`,
    ),
    chkStatus: check(
      "chk_deliveries_status",
      sql`status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')`,
    ),
  }),
);
