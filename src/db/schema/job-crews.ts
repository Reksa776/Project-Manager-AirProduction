import { sql } from "drizzle-orm";
import {
  check,
  numeric,
  pgTable,
  text,
  varchar,
} from "drizzle-orm/pg-core";

import { crew } from "./crew";
import { crewRoles } from "./crew-roles";
import { jobs } from "./jobs";
import { timestamps } from "./_shared";

/**
 * job_crews — relasi assignment crew pada sebuah job (tanpa uang).
 *
 * - `crew_role_id` NULL berarti "ikuti role dari crew" (override per-job).
 * - `agreed_amount` = nilai kesepakatan; uang aktual bergerak lewat cashflows.
 */
export const jobCrews = pgTable(
  "job_crews",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    jobId: varchar("job_id", { length: 36 })
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    crewId: varchar("crew_id", { length: 36 })
      .notNull()
      .references(() => crew.id, { onDelete: "restrict" }),
    crewRoleId: varchar("crew_role_id", { length: 36 }).references(
      () => crewRoles.id,
      { onDelete: "set null" },
    ),
    agreedAmount: numeric("agreed_amount", {
      precision: 15,
      scale: 2,
      mode: "string",
    })
      .notNull()
      .default("0.00"),
    notes: text("notes"),
    ...timestamps(),
  },
  () => ({
    chkAgreedAmount: check(
      "chk_job_crews_agreed_amount",
      sql`agreed_amount >= 0`,
    ),
  }),
);
