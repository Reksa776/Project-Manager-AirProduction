import type { SheetTitle } from "@/repositories/google/mapping";

/**
 * TIPE SNAPSHOT SUMBER (P0D-2A) — READ-ONLY.
 *
 * Snapshot adalah representasi statis dari isi worksheet Google Sheets pada satu
 * titik waktu. Semua modul snapshot bersifat murni (pure): tidak mengimpor
 * klien Google Sheets, tidak mengimpor layer database, dan tidak menulis ke
 * mana pun. Pembacaan live dilakukan oleh adapter read-only terpisah
 * (`src/migration-cli/read-only-sheets.ts`).
 */

/** Asal snapshot — dicatat sebagai provenance. */
export type SnapshotSource = "google-sheets-readonly" | "fixture" | "imported-json";

/** Matriks mentah satu worksheet, termasuk baris header pada indeks 0. */
export interface RawWorksheetMatrix {
  sheet: SheetTitle;
  /** Baris 0 = header; baris berikutnya = data. Sel selalu dikonversi ke string. */
  values: string[][];
}

/** Satu baris data sumber beserta provenance dan sidik jari isinya. */
export interface SourceRowSnapshot {
  sheet: SheetTitle;
  /** Nomor baris pada worksheet (1-based; header = baris 1) untuk audit manual. */
  rowNumber: number;
  /** Nilai kolom `id` sumber; string kosong bila tidak ada (dilaporkan sebagai issue). */
  sourceId: string;
  /** Nilai sel sesuai urutan header yang benar-benar ada pada worksheet. */
  values: string[];
  /** SHA-256 isi baris (`column=value` terurut) — deteksi perubahan antar-run. */
  fingerprint: string;
}

export interface SnapshotIssue {
  code: string;
  sheet: SheetTitle;
  rowNumber?: number;
  column?: string;
  message: string;
}

export interface SheetSnapshot {
  sheet: SheetTitle;
  headers: string[];
  /** SHA-256 dari daftar header yang terbaca. */
  headerFingerprint: string;
  headerMatchesContract: boolean;
  columnOrderMatches: boolean;
  missingColumns: string[];
  extraColumns: string[];
  rows: SourceRowSnapshot[];
  rowCount: number;
  /** Baris yang jumlah selnya tidak sama dengan jumlah header. */
  malformedRowNumbers: number[];
  /** Baris data dengan kolom `id` kosong. */
  emptyIdRowNumbers: number[];
  duplicateIds: Array<{ sourceId: string; rowNumbers: number[] }>;
  /** Nilai unik kolom yang aman dilaporkan (lihat `sanitize.ts`). */
  distinctValues: Record<string, string[]>;
  /** Jumlah baris kosong yang dilewati (bukan data). */
  skippedEmptyRows: number;
  issues: SnapshotIssue[];
}

export interface ValidatedSnapshot {
  /** Sidik jari snapshot (deterministik dari isi); aman dilaporkan. */
  snapshotId: string;
  /** Waktu akuisisi (ISO 8601, disediakan pemanggil agar dapat direproduksi). */
  acquiredAt: string;
  source: SnapshotSource;
  /** Seluruh 11 worksheet; worksheet yang tidak ada diisi snapshot kosong + issue. */
  sheets: Record<SheetTitle, SheetSnapshot>;
  /** Sidik jari skema: gabungan sidik jari header seluruh worksheet. */
  schemaFingerprint: string;
  /** Sidik jari keseluruhan snapshot (gabungan baris). */
  fingerprint: string;
  totalRows: number;
  issues: SnapshotIssue[];
}

export interface RowReference {
  sheet: SheetTitle;
  sourceId: string;
  rowNumber: number;
}

export interface SnapshotChangeReport {
  newRows: RowReference[];
  changedRows: RowReference[];
  disappearedRows: RowReference[];
  schemaChanged: boolean;
}

export interface BuildSnapshotOptions {
  source: SnapshotSource;
  /** Waktu akuisisi (ISO 8601). Wajib eksplisit agar hasil dapat direproduksi. */
  acquiredAt: string;
}
