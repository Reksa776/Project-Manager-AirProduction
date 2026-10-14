import { sql } from "drizzle-orm";
import {
  check,
  date,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { clients } from "./clients";
import { packages } from "./packages";
import { vendors } from "./vendors";
import { timestamps } from "./_shared";

/**
 * jobs — entity pusat.
 *
 * - job_number: UNIQUE. Format lama dipertahankan apa adanya; format baru
 *   `JOB-YYYY-NNNNNN` dibuat generator pada phase business logic.
 * - client_id XOR vendor_id dijaga CHECK di database (bukan hanya service).
 * - venue TIDAK ada: hanya snapshot nama venue historis (legacy_venue_name).
 */
export const jobs = pgTable(
  "jobs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    jobNumber: varchar("job_number", { length: 32 }).notNull(),
    jobName: varchar("job_name", { length: 160 }).notNull(),
    category: varchar("category", { length: 20 }).notNull(),
    clientId: varchar("client_id", { length: 36 }).references(() => clients.id, {
      onDelete: "restrict",
    }),
    packageId: varchar("package_id", { length: 36 }).references(() => packages.id, {
      onDelete: "restrict",
    }),
    vendorId: varchar("vendor_id", { length: 36 }).references(() => vendors.id, {
      onDelete: "restrict",
    }),
    executionDate: date("execution_date", { mode: "string" }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    location: varchar("location", { length: 190 }),
    notes: text("notes"),
    legacyVenueName: varchar("legacy_venue_name", { length: 190 }),
    ...timestamps(),
  },
  (t) => ({
    uqJobNumber: uniqueIndex("uq_jobs_job_number").on(t.jobNumber),
    chkXor: check(
      "chk_jobs_client_vendor_xor",
      sql`(client_id is null) <> (vendor_id is null)`,
    ),
    chkCategory: check(
      "chk_jobs_category",
      sql`category in ('WEDDING', 'PREWEDDING', 'CORPORATE', 'EVENT', 'OTHER')`,
    ),
    chkStatus: check(
      "chk_jobs_status",
      sql`status in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED')`,
    ),
  }),
);
