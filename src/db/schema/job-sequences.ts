import { pgTable, check, sql, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/**
 * job_sequences — nomor urut otomatis per bulan/tahun untuk job numbering.
 * Digunakan generator di aplikasi untuk format `JOB-YYYY-NNNNNN`.
 */
export const jobSequences = pgTable("job_sequences", {
  id: varchar("id", { length: 36 }).primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  currentSeq: integer("current_seq").notNull().default(0),
  ...timestamps(),
}, (t) => ({
  uqYearMonth: uniqueIndex("uq_job_sequences_year_month").on(t.year, t.month),
}));

export const jobSequenceRelations = relations(jobSequences, many(jobs));