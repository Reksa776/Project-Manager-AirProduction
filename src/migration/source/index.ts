/**
 * ADAPTER SUMBER READ-ONLY (P0D-2A) — MURNI.
 *
 * Folder ini hanya berisi tipe, validasi snapshot, sanitasi, dan perbandingan
 * antar-snapshot. Tidak ada modul di sini yang:
 * - memanggil Google Sheets (baca maupun tulis) — pembacaan ada di
 *   `src/migration-cli/read-only-sheets.ts`;
 * - menulis ke MySQL atau mengimpor layer database;
 * - memperbaiki data sumber secara diam-diam.
 */

export type {
  BuildSnapshotOptions,
  RawWorksheetMatrix,
  RowReference,
  SheetSnapshot,
  SnapshotChangeReport,
  SnapshotIssue,
  SnapshotSource,
  SourceRowSnapshot,
  ValidatedSnapshot,
} from "./types";

export {
  buildSnapshot,
  compareSnapshots,
  deserializeSnapshot,
  headerFingerprint,
  schemaFingerprint,
  serializeSnapshot,
} from "./snapshot";

export {
  assertNoSensitiveData,
  collectSensitiveValues,
  hashId,
  opaqueRowRef,
  redactValue,
  SAFE_DISTINCT_COLUMNS,
  sanitizeSheet,
  sanitizeSnapshot,
  SENSITIVE_COLUMNS,
} from "./sanitize";
export type { SanitizedSheetSummary, SanitizedSnapshotSummary } from "./sanitize";
