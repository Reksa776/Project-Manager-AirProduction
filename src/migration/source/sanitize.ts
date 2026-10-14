import { createHash } from "node:crypto";

import type { SheetTitle } from "@/repositories/google/mapping";

import type { SheetSnapshot, ValidatedSnapshot } from "./types";

/**
 * SANITASI LAPORAN SNAPSHOT (P0D-2A §4 & §7).
 *
 * Aturan: laporan/ringkasan yang dapat dibaca manusia TIDAK BOLEH memuat nilai
 * sensitif (nama, kontak, email, telepon, alamat, catatan bebas, hash sandi).
 * Yang boleh muncul hanya:
 * - jumlah (counts) dan sidik jari (fingerprints);
 * - nilai kolom terkendali (crew role, kategori expense, enum status/tipe) —
 *   dibutuhkan untuk keputusan D1 dan inventaris §5;
 * - referensi baris OPAQUE (worksheet + nomor baris + hash id), bukan nilai id.
 */

/** Kolom yang nilainya tidak boleh pernah dilaporkan. */
export const SENSITIVE_COLUMNS: readonly string[] = [
  "name",
  "contact",
  "contact_person",
  "email",
  "phone",
  "address",
  "city",
  "notes",
  "description",
  "location",
  "job_name",
  "password_hash",
  "company_name",
];

/**
 * Kolom terkendali (bebas PII) yang nilai uniknya BOLEH dilaporkan karena
 * dibutuhkan untuk keputusan owner (kamus crew role, kategori expense, enum).
 */
export const SAFE_DISTINCT_COLUMNS: Partial<Record<SheetTitle, readonly string[]>> = {
  crew: ["role"],
  jobs: ["job_type", "status"],
  job_crews: ["role", "payment_status"],
  deliveries: ["delivery_type", "status"],
  client_payments: ["term", "status"],
  vendor_payments: ["type", "status"],
  expenses: ["category"],
};

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Hash pendek (8 hex) untuk referensi opaque — tidak dapat dibalik. */
export function hashId(value: string): string {
  return sha256Hex(value).slice(0, 8);
}

/** Referensi baris opaque untuk laporan/decision register. */
export function opaqueRowRef(sheet: SheetTitle, rowNumber: number, sourceId: string): string {
  return sourceId === ""
    ? `${sheet}#${rowNumber}`
    : `${sheet}#${rowNumber}(id:${hashId(sourceId)})`;
}

/** Sensor nilai agar tidak tercetak (dipakai untuk pesan diagnostik). */
export function redactValue(value: string): string {
  return value === "" ? "" : `<redacted:${value.length}chars:${hashId(value)}>`;
}

export interface SanitizedSheetSummary {
  sheet: SheetTitle;
  rowCount: number;
  headerFingerprint: string;
  headerMatchesContract: boolean;
  columnOrderMatches: boolean;
  missingColumns: string[];
  extraColumns: string[];
  malformedRowCount: number;
  emptyIdCount: number;
  skippedEmptyRows: number;
  duplicateIdGroups: Array<{ idHash: string; rowRefs: string[] }>;
  distinctValueCounts: Record<string, number>;
  /** Nilai unik hanya untuk kolom terkendali (bukan PII). */
  safeDistinctValues: Record<string, string[]>;
  issueCodes: Record<string, number>;
}

export interface SanitizedSnapshotSummary {
  snapshotId: string;
  acquiredAt: string;
  source: ValidatedSnapshot["source"];
  schemaFingerprint: string;
  snapshotFingerprint: string;
  totalRows: number;
  sheets: SanitizedSheetSummary[];
  issueCodes: Record<string, number>;
  /** Selalu `false`: snapshot tidak pernah menulis. */
  writesPerformed: false;
}

function countCodes(codes: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const code of codes) result[code] = (result[code] ?? 0) + 1;
  return Object.fromEntries(Object.keys(result).sort().map((key) => [key, result[key]!]));
}

/** Ringkasan satu worksheet yang aman dilaporkan (tanpa nilai sensitif). */
export function sanitizeSheet(sheet: SheetSnapshot): SanitizedSheetSummary {
  const distinctValueCounts: Record<string, number> = {};
  const safeDistinctValues: Record<string, string[]> = {};
  const allowed = SAFE_DISTINCT_COLUMNS[sheet.sheet] ?? [];
  for (const [column, values] of Object.entries(sheet.distinctValues)) {
    distinctValueCounts[column] = values.length;
    if (allowed.includes(column)) safeDistinctValues[column] = [...values].sort();
  }

  return {
    sheet: sheet.sheet,
    rowCount: sheet.rowCount,
    headerFingerprint: sheet.headerFingerprint,
    headerMatchesContract: sheet.headerMatchesContract,
    columnOrderMatches: sheet.columnOrderMatches,
    missingColumns: [...sheet.missingColumns],
    extraColumns: [...sheet.extraColumns],
    malformedRowCount: sheet.malformedRowNumbers.length,
    emptyIdCount: sheet.emptyIdRowNumbers.length,
    skippedEmptyRows: sheet.skippedEmptyRows,
    duplicateIdGroups: sheet.duplicateIds.map((group) => ({
      idHash: hashId(group.sourceId),
      rowRefs: group.rowNumbers.map((rowNumber) => opaqueRowRef(sheet.sheet, rowNumber, group.sourceId)),
    })),
    distinctValueCounts,
    safeDistinctValues,
    issueCodes: countCodes(sheet.issues.map((issue) => issue.code)),
  };
}

/** Ringkasan snapshot yang aman dilaporkan. */
export function sanitizeSnapshot(snapshot: ValidatedSnapshot): SanitizedSnapshotSummary {
  const sheets = Object.values(snapshot.sheets).map(sanitizeSheet);
  return {
    snapshotId: snapshot.snapshotId,
    acquiredAt: snapshot.acquiredAt,
    source: snapshot.source,
    schemaFingerprint: snapshot.schemaFingerprint,
    snapshotFingerprint: snapshot.fingerprint,
    totalRows: snapshot.totalRows,
    sheets,
    issueCodes: countCodes(snapshot.issues.map((issue) => issue.code)),
    writesPerformed: false,
  };
}

/**
 * Penjaga kebocoran: memastikan tidak ada nilai sensitif yang muncul pada
 * ringkasan yang akan dilaporkan. Dipakai oleh test dan CLI sebelum mencetak.
 */
export function assertNoSensitiveData(
  artifact: unknown,
  sensitiveValues: readonly string[],
): void {
  const serialized = JSON.stringify(artifact);
  for (const value of sensitiveValues) {
    const needle = value.trim();
    if (needle === "" || needle.length < 3) continue;
    if (serialized.includes(needle)) {
      throw new Error(
        `Kebocoran data sensitif terdeteksi pada laporan (nilai: ${redactValue(needle)}).`,
      );
    }
  }
}

/** Kumpulan nilai sensitif dari snapshot (dipakai untuk memverifikasi sanitasi). */
export function collectSensitiveValues(snapshot: ValidatedSnapshot): string[] {
  const values = new Set<string>();
  for (const sheet of Object.values(snapshot.sheets)) {
    for (const row of sheet.rows) {
      sheet.headers.forEach((header, index) => {
        if (!SENSITIVE_COLUMNS.includes(header)) return;
        const value = row.values[index];
        if (value !== undefined && value.trim() !== "") values.add(value.trim());
      });
    }
  }
  return [...values];
}
