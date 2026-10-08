import { int, mysqlTable, smallint } from "drizzle-orm/mysql-core";

/**
 * job_sequences — counter generator nomor job `JOB-YYYY-NNNNNN`.
 *
 * Phase 1 HANYA membuat tabelnya. Generator (SELECT ... FOR UPDATE di dalam
 * transaksi) diimplementasikan pada Phase business logic berikutnya.
 *
 * Catatan penyimpangan kecil dari aturan PK "VARCHAR(36) untuk semua tabel":
 * PK tabel ini adalah `year` (SMALLINT) — bukan auto-increment, dan bukan data
 * hasil migrasi; year adalah kunci sekuens per-tahun sesuai desain Phase 0 §10.
 */
export const jobSequences = mysqlTable("job_sequences", {
  year: smallint("year").primaryKey(),
  nextSeq: int("next_seq").notNull(),
});
