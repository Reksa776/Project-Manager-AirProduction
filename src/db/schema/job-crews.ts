import { sql } from "drizzle-orm";
import { check, decimal, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";
import { timestamps } from "./_shared";
import { crew } from "./crew";
import { crewRoles } from "./crew-roles";
import { jobs } from "./jobs";

/**
 * job_crews — assignment crew pada job (relasi murni, tanpa kolom uang).
 *
 * - `agreed_amount` = nilai kesepakatan pembayaran (bukan kas).
 * - Uang BENAR-BENAR dibayar dicatat sebagai cashflows dengan
 *   reference_type='job_crew' (Phase cashflow).
 * - `crew_role_id` NULL → role tampil mengikuti crew.crew_role_id (override per-job).
 */
export const jobCrews = mysqlTable(
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
    agreedAmount: decimal("agreed_amount", {
      precision: 15,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    notes: text("notes"),
    ...timestamps(),
  },
  () => ({
    chkAgreedAmount: check("chk_job_crews_agreed_amount", sql`agreed_amount >= 0`),
  }),
);
