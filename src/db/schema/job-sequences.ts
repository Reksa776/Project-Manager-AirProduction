import { integer, pgTable, primaryKey, smallint } from "drizzle-orm/pg-core";

/**
 * job_sequences — nomor urut otomatis per tahun untuk job numbering.
 * Digunakan generator di aplikasi untuk format `JOB-YYYY-NNNNNN`.
 *
 * Deviasi disengaja: PK = `year` (bukan id VARCHAR(36)) karena tabel ini
 * adalah kunci sekuens per-tahun, bukan record bisnis.
 */
export const jobSequences = pgTable(
  "job_sequences",
  {
    year: smallint("year").notNull(),
    nextSeq: integer("next_seq").notNull(),
  },
  (t) => ({
    pk: primaryKey({ name: "job_sequences_year", columns: [t.year] }),
  }),
);
