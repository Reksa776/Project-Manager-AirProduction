import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  assertNoSensitiveData,
  buildSnapshot,
  collectSensitiveValues,
  deserializeSnapshot,
  runSnapshotDryRun,
  sanitizeSnapshot,
  serializeSnapshot,
  type ApprovedCrewRoleDictionary,
  type ApprovedDuplicateDecision,
  type OwnerApproval,
  type SanitizedSnapshotSummary,
  type SnapshotDryRunReport,
  type SnapshotSource,
  type ValidatedSnapshot,
} from "@/migration";

import type { ReadOnlySheetsGateway } from "./gateway";

/**
 * RUNNER SNAPSHOT READ-ONLY (P0D-2A).
 *
 * Orkestrasi: gerbang baca-sajar → validasi snapshot → ringkasan tersanitasi →
 * dry-run terhadap snapshot TETAP. Tidak ada penulisan ke Google Sheets maupun
 * MySQL; satu-satunya penulisan yang mungkin adalah arsip snapshot MENTAH ke
 * disk lokal (di-ignore Git) dan hanya bila diminta eksplisit.
 */

/** Direktori arsip snapshot mentah — WAJIB di-ignore Git (memuat data pribadi). */
export const RAW_SNAPSHOT_DIR = ".migration-snapshots";

export interface SnapshotAcquisitionOptions {
  gateway: ReadOnlySheetsGateway;
  /** Waktu akuisisi (ISO 8601) — eksplisit agar reproducible. */
  acquiredAt?: string;
  source?: SnapshotSource;
  approvedCrewRoleDictionary?: ApprovedCrewRoleDictionary;
  approvedDuplicateDecisions?: readonly ApprovedDuplicateDecision[];
  approvals?: readonly OwnerApproval[];
  previousSnapshot?: ValidatedSnapshot;
  previousRunFingerprints?: Readonly<Record<string, string>>;
}

export interface SnapshotAcquisitionResult {
  snapshot: ValidatedSnapshot;
  summary: SanitizedSnapshotSummary;
  report: SnapshotDryRunReport;
  writesPerformed: false;
}

/**
 * Mengambil snapshot read-only lalu menjalankan dry-run terhadap snapshot tetap.
 * Ringkasan yang dikembalikan sudah tersanitasi (diverifikasi tanpa nilai PII).
 */
export async function acquireAndPlanSnapshot(
  options: SnapshotAcquisitionOptions,
): Promise<SnapshotAcquisitionResult> {
  const matrices = await options.gateway.listWorksheetMatrices();
  const snapshot = buildSnapshot(matrices, {
    source: options.source ?? "google-sheets-readonly",
    acquiredAt: options.acquiredAt ?? new Date().toISOString(),
  });
  const summary = sanitizeSnapshot(snapshot);

  // Penjaga kebocoran: ringkasan yang akan dilaporkan tidak boleh memuat nilai
  // sensitif apa pun yang ada pada snapshot.
  assertNoSensitiveData(summary, collectSensitiveValues(snapshot));

  const report = runSnapshotDryRun({
    snapshot,
    previousSnapshot: options.previousSnapshot,
    approvedCrewRoleDictionary: options.approvedCrewRoleDictionary,
    approvedDuplicateDecisions: options.approvedDuplicateDecisions,
    approvals: options.approvals,
    previousRunFingerprints: options.previousRunFingerprints,
  });

  return { snapshot, summary, report, writesPerformed: false };
}

/** Path arsip snapshot mentah untuk sebuah snapshot ID. */
export function rawSnapshotPath(snapshotId: string, dir: string = RAW_SNAPSHOT_DIR): string {
  return path.join(dir, `snapshot-${snapshotId.slice(0, 16)}.json`);
}

/**
 * Menulis arsip snapshot MENTAH ke disk lokal. Hasilnya memuat data pribadi →
 * hanya boleh di direktori yang di-ignore Git, tidak boleh di-commit/di-push.
 */
export async function writeRawSnapshot(
  snapshot: ValidatedSnapshot,
  dir: string = RAW_SNAPSHOT_DIR,
): Promise<string> {
  await mkdir(dir, { recursive: true });
  const target = rawSnapshotPath(snapshot.snapshotId, dir);
  await writeFile(target, serializeSnapshot(snapshot), "utf8");
  return target;
}

/** Membaca arsip snapshot mentah dari disk lokal. */
export async function readRawSnapshot(
  snapshotId: string,
  dir: string = RAW_SNAPSHOT_DIR,
): Promise<ValidatedSnapshot> {
  const target = rawSnapshotPath(snapshotId, dir);
  const serialized = await readFile(target, "utf8");
  return deserializeSnapshot(serialized);
}

/** Ringkasan teks TERSANITASI untuk output terminal/laporan. */
export function formatSanitizedSummary(summary: SanitizedSnapshotSummary): string {
  const lines: string[] = [
    `snapshotId        : ${summary.snapshotId}`,
    `acquiredAt        : ${summary.acquiredAt}`,
    `source            : ${summary.source}`,
    `schemaFingerprint : ${summary.schemaFingerprint}`,
    `totalRows         : ${summary.totalRows}`,
    `writesPerformed   : ${summary.writesPerformed}`,
    "",
    "worksheet            baris  headerOK  malformed  emptyId  dupId",
  ];
  for (const sheet of summary.sheets) {
    lines.push(
      `${sheet.sheet.padEnd(20)} ${String(sheet.rowCount).padStart(5)}  ` +
        `${(sheet.headerMatchesContract ? "ya" : "TIDAK").padEnd(8)}  ` +
        `${String(sheet.malformedRowCount).padStart(9)}  ` +
        `${String(sheet.emptyIdCount).padStart(7)}  ` +
        `${String(sheet.duplicateIdGroups.length).padStart(5)}`,
    );
  }
  const issueCodes = Object.entries(summary.issueCodes);
  if (issueCodes.length > 0) {
    lines.push("", `issue snapshot: ${issueCodes.map(([code, count]) => `${code}=${count}`).join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}
