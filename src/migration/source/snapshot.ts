import { createHash } from "node:crypto";

import {
  SHEET_HEADERS,
  SHEET_TITLES,
  isEmptyRow,
  rowToRecord,
  type SheetTitle,
} from "@/repositories/google/mapping";

import { sourceFingerprint, snapshotFingerprint } from "../identity";
import { SAFE_DISTINCT_COLUMNS } from "./sanitize";
import type {
  BuildSnapshotOptions,
  RawWorksheetMatrix,
  SheetSnapshot,
  SnapshotChangeReport,
  SnapshotIssue,
  SourceRowSnapshot,
  ValidatedSnapshot,
} from "./types";

/**
 * SNAPSHOT SUMBER (P0D-2A) — READ-ONLY & MURNI.
 *
 * Modul ini TIDAK membaca jaringan sendiri: ia menerima matriks yang sudah
 * diambil adapter read-only, lalu:
 * - memvalidasi header terhadap kontrak `SHEET_HEADERS`;
 * - mendeteksi kolom hilang/tambahan, baris malformed, `id` kosong, dan `id` duplikat;
 * - mempertahankan provenance (worksheet, nomor baris, `id` sumber);
 * - menghitung sidik jari header, skema, baris, dan snapshot.
 *
 * Data sumber TIDAK PERNAH diperbaiki secara diam-diam: setiap penyimpangan
 * dilaporkan sebagai `SnapshotIssue`.
 */

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Sidik jari daftar header. */
export function headerFingerprint(headers: readonly string[]): string {
  return sha256Hex(JSON.stringify([...headers]));
}

/** Sidik jari skema: gabungan sidik jari header 11 worksheet (urutan tetap). */
export function schemaFingerprint(headers: Partial<Record<SheetTitle, string[]>>): string {
  const canonical = SHEET_TITLES.map(
    (sheet) => `${sheet}:${headerFingerprint(headers[sheet] ?? [])}`,
  ).join("\n");
  return sha256Hex(`schema|${canonical}`);
}

/** Normalisasi nilai sel Google Sheets menjadi string (tanpa melempar). */
function toCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function emptySheet(sheet: SheetTitle, issues: SnapshotIssue[]): SheetSnapshot {
  return {
    sheet,
    headers: [],
    headerFingerprint: headerFingerprint([]),
    headerMatchesContract: false,
    columnOrderMatches: false,
    missingColumns: [...SHEET_HEADERS[sheet]],
    extraColumns: [],
    rows: [],
    rowCount: 0,
    malformedRowNumbers: [],
    emptyIdRowNumbers: [],
    duplicateIds: [],
    distinctValues: {},
    skippedEmptyRows: 0,
    issues,
  };
}

/** Membangun snapshot tervalidasi dari matriks worksheet (murni, tanpa I/O). */
export function buildSnapshot(
  matrices: readonly RawWorksheetMatrix[],
  options: BuildSnapshotOptions,
): ValidatedSnapshot {
  const bySheet = new Map<SheetTitle, RawWorksheetMatrix>();
  for (const matrix of matrices) bySheet.set(matrix.sheet, matrix);

  const sheets = {} as Record<SheetTitle, SheetSnapshot>;
  const allIssues: SnapshotIssue[] = [];
  const declaredHeaders: Partial<Record<SheetTitle, string[]>> = {};

  for (const sheet of SHEET_TITLES) {
    const matrix = bySheet.get(sheet);
    if (!matrix) {
      const issue: SnapshotIssue = {
        code: "MISSING_WORKSHEET",
        sheet,
        message: `Worksheet '${sheet}' tidak ada pada snapshot; tidak ada data yang dikarang.`,
      };
      allIssues.push(issue);
      sheets[sheet] = emptySheet(sheet, [issue]);
      declaredHeaders[sheet] = [];
      continue;
    }

    const expected = SHEET_HEADERS[sheet];
    const headers = (matrix.values[0] ?? []).map(toCell);
    declaredHeaders[sheet] = headers;
    const missingColumns = expected.filter((column) => !headers.includes(column));
    const extraColumns = headers.filter((header) => header !== "" && !expected.includes(header));
    const columnOrderMatches =
      headers.length === expected.length && expected.every((header, index) => headers[index] === header);
    const headerMatchesContract = missingColumns.length === 0 && extraColumns.length === 0 && columnOrderMatches;

    const issues: SnapshotIssue[] = [];
    if (!headerMatchesContract) {
      issues.push({
        code: "HEADER_MISMATCH",
        sheet,
        message: `Header worksheet '${sheet}' tidak sesuai kontrak (hilang: [${missingColumns.join(", ")}]; tambahan: [${extraColumns.join(", ")}]; urutan cocok: ${columnOrderMatches}). Data TIDAK diperbaiki otomatis.`,
      });
    }
    if (extraColumns.length > 0) {
      issues.push({
        code: "EXTRA_COLUMNS",
        sheet,
        message: `Worksheet '${sheet}' memiliki ${extraColumns.length} kolom yang tidak ada pada kontrak.`,
      });
    }

    const rows: SourceRowSnapshot[] = [];
    const malformedRowNumbers: number[] = [];
    const emptyIdRowNumbers: number[] = [];
    const idBuckets = new Map<string, number[]>();
    const distinct = new Map<string, Set<string>>();
    for (const column of SAFE_DISTINCT_COLUMNS[sheet] ?? []) distinct.set(column, new Set());
    let skippedEmptyRows = 0;

    for (let index = 1; index < matrix.values.length; index += 1) {
      const rowNumber = index + 1; // 1-based worksheet row (header = baris 1)
      const raw = (matrix.values[index] ?? []).map(toCell);
      if (isEmptyRow(raw)) {
        skippedEmptyRows += 1;
        continue;
      }
      if (raw.length !== headers.length) {
        malformedRowNumbers.push(rowNumber);
        issues.push({
          code: "MALFORMED_ROW",
          sheet,
          rowNumber,
          message: `Baris ${rowNumber} pada '${sheet}' memiliki ${raw.length} sel (header: ${headers.length}); baris tidak diperbaiki otomatis.`,
        });
      }

      const record = rowToRecord(headers, raw);
      const sourceId = record.id ?? "";
      if (sourceId === "") {
        emptyIdRowNumbers.push(rowNumber);
        issues.push({
          code: "EMPTY_SOURCE_ID",
          sheet,
          rowNumber,
          column: "id",
          message: `Baris ${rowNumber} pada '${sheet}' tidak memiliki id sumber; identitas stabil tidak dapat dibentuk.`,
        });
      } else {
        const bucket = idBuckets.get(sourceId) ?? [];
        bucket.push(rowNumber);
        idBuckets.set(sourceId, bucket);
      }
      for (const [column, values] of distinct) {
        const value = record[column];
        if (value !== undefined && value !== "") values.add(value);
      }

      rows.push({
        sheet,
        rowNumber,
        sourceId,
        values: raw,
        fingerprint: sourceFingerprint(record),
      });
    }

    const duplicateIds = [...idBuckets.entries()]
      .filter(([, rowNumbers]) => rowNumbers.length > 1)
      .map(([sourceId, rowNumbers]) => ({ sourceId, rowNumbers: [...rowNumbers].sort((a, b) => a - b) }))
      .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
    for (const duplicate of duplicateIds) {
      issues.push({
        code: "DUPLICATE_SOURCE_ID",
        sheet,
        message: `id sumber '${duplicate.sourceId}' muncul pada ${duplicate.rowNumbers.length} baris '${sheet}' (baris ${duplicate.rowNumbers.join(", ")}); identitas tidak unik.`,
      });
    }

    sheets[sheet] = {
      sheet,
      headers,
      headerFingerprint: headerFingerprint(headers),
      headerMatchesContract,
      columnOrderMatches,
      missingColumns,
      extraColumns,
      rows,
      rowCount: rows.length,
      malformedRowNumbers,
      emptyIdRowNumbers,
      duplicateIds,
      distinctValues: Object.fromEntries(
        [...distinct.entries()].map(([column, values]) => [column, [...values].sort()]),
      ),
      skippedEmptyRows,
      issues,
    };
    allIssues.push(...issues);
  }

  const fingerprint = snapshotFingerprint(
    SHEET_TITLES.flatMap((sheet) =>
      sheets[sheet].rows.map((row) => ({
        source: {
          sheet,
          sourceId: row.sourceId === "" ? `#row${row.rowNumber}` : row.sourceId,
        },
        fingerprint: row.fingerprint,
      })),
    ),
  );

  return {
    snapshotId: fingerprint,
    acquiredAt: options.acquiredAt,
    source: options.source,
    sheets,
    schemaFingerprint: schemaFingerprint(declaredHeaders),
    fingerprint,
    totalRows: SHEET_TITLES.reduce((total, sheet) => total + sheets[sheet].rowCount, 0),
    issues: allIssues,
  };
}

/** Referensi baris stabil untuk perbandingan antar-snapshot. */
function rowKey(sheet: SheetTitle, row: SourceRowSnapshot): string {
  return `${sheet}:${row.sourceId === "" ? `#row${row.rowNumber}` : row.sourceId}`;
}

/**
 * Perbandingan dua snapshot berurutan: sumber baru, berubah, dan hilang.
 * Menggunakan identitas `(worksheet, id)` sehingga perubahan urutan baris tidak
 * dilaporkan sebagai perubahan.
 */
export function compareSnapshots(
  previous: ValidatedSnapshot,
  next: ValidatedSnapshot,
): SnapshotChangeReport {
  const previousRows = new Map<string, SourceRowSnapshot>();
  for (const sheet of SHEET_TITLES) {
    for (const row of previous.sheets[sheet].rows) previousRows.set(rowKey(sheet, row), row);
  }

  const newRows: SnapshotChangeReport["newRows"] = [];
  const changedRows: SnapshotChangeReport["changedRows"] = [];
  const seen = new Set<string>();
  for (const sheet of SHEET_TITLES) {
    for (const row of next.sheets[sheet].rows) {
      const key = rowKey(sheet, row);
      seen.add(key);
      const before = previousRows.get(key);
      const reference = { sheet, sourceId: row.sourceId, rowNumber: row.rowNumber };
      if (!before) newRows.push(reference);
      else if (before.fingerprint !== row.fingerprint) changedRows.push(reference);
    }
  }

  const disappearedRows: SnapshotChangeReport["disappearedRows"] = [];
  for (const [key, row] of previousRows) {
    if (seen.has(key)) continue;
    disappearedRows.push({ sheet: row.sheet, sourceId: row.sourceId, rowNumber: row.rowNumber });
  }

  return {
    newRows,
    changedRows,
    disappearedRows,
    schemaChanged: previous.schemaFingerprint !== next.schemaFingerprint,
  };
}

/**
 * Serialisasi snapshot ke JSON untuk arsip mentah. Hasil serialisasi MEMUAT data
 * sumber sensitif: HARUS disimpan pada direktori yang di-ignore Git dan tidak
 * boleh disalin ke dokumen/laporan.
 */
export function serializeSnapshot(snapshot: ValidatedSnapshot): string {
  return JSON.stringify(
    {
      snapshotId: snapshot.snapshotId,
      acquiredAt: snapshot.acquiredAt,
      source: snapshot.source,
      schemaFingerprint: snapshot.schemaFingerprint,
      fingerprint: snapshot.fingerprint,
      sheets: Object.fromEntries(
        SHEET_TITLES.map((sheet) => [
          sheet,
          {
            headers: snapshot.sheets[sheet].headers,
            rows: snapshot.sheets[sheet].rows.map((row) => ({
              rowNumber: row.rowNumber,
              sourceId: row.sourceId,
              values: row.values,
              fingerprint: row.fingerprint,
            })),
          },
        ]),
      ),
    },
    null,
    2,
  );
}

/** Membaca kembali snapshot dari arsip JSON (tanpa memvalidasi ulang kontrak). */
export function deserializeSnapshot(serialized: string): ValidatedSnapshot {
  const parsed = JSON.parse(serialized) as {
    snapshotId: string;
    acquiredAt: string;
    source: ValidatedSnapshot["source"];
    schemaFingerprint: string;
    fingerprint: string;
    sheets: Record<string, { headers: string[]; rows: Array<{ rowNumber: number; sourceId: string; values: string[]; fingerprint: string }> }>;
  };
  const matrices: RawWorksheetMatrix[] = SHEET_TITLES.map((sheet) => ({
    sheet,
    values: [parsed.sheets[sheet]?.headers ?? [], ...(parsed.sheets[sheet]?.rows ?? []).map((row) => row.values)],
  }));
  return buildSnapshot(matrices, { source: parsed.source, acquiredAt: parsed.acquiredAt });
}
