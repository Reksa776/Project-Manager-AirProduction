/**
 * CHECKLIST KESIAPAN AKTIVASI — P0E-2A.1.
 *
 * Mengeraskan checklist `buildP0D2BReadinessChecklist` (yang masih P0D-bernama
 * dan buta terhadap bukti rehearsal/backup) menjadi checklist gerbang aktivasi
 * yang SEBENARNYA, dengan aturan GAGAL TERTUTUP:
 *
 * - Setiap item yang tidak dapat dibuktikan bernilai `false`/`null` dan membuat
 *   verdict `NO-GO`. Tidak ada item yang "dianggap lolos".
 * - Cheksum yang cocok SAJA tidak membuktikan restore. Tahap backup yang berbeda
 *   (lokal → transfer → checksum tujuan → restore off-host) dicatat terpisah.
 * - Persetujuan migrasi 0001 dan aktivasi runtime adalah DUA keputusan terpisah.
 *
 * Modul ini murni (tanpa I/O). `buildP0D2BReadinessChecklist` yang lama tetap
 * ada agar test historis dan laporan P0D-2A tidak berubah.
 */

import { PRODUCTION_DATABASE, type ChecklistItem, type PreflightReport } from "./preflight";
import {
  REHEARSAL_DATABASE,
  checksumsMatch,
  deriveBackupAcceptanceState,
  evaluateOffHostEvidence,
  isSha256,
  validateBackupManifest,
  type ActivationApprovals,
  type BackupAcceptanceState,
  type BackupManifest,
  type OffHostEvidence,
  type OffHostEvaluation,
} from "./activation-guards";

// Re-export tipe yang dipakai pemanggil agar impor tetap satu pintu.
export type { ActivationApprovals, BackupAcceptanceState, BackupManifest, OffHostEvidence };

/** Hasil restore rehearsal yang dibuktikan. */
export interface RestoreRehearsalEvidence {
  performed: boolean;
  /** Nama database disposable yang dipakai (harus rehearsal, BUKAN produksi). */
  databaseName: string | null;
  schemaFingerprintMatches: boolean | null;
  journalMatches: boolean | null;
  rowCountsMatch: boolean | null;
  /** Restore dilakukan dari salinan OFF-HOST, bukan dari host DB. */
  restoredFromOffHostCopy: boolean | null;
}

/** Status kesiapan runtime (least-privilege + paparan publik). */
export interface RuntimeReadinessEvidence {
  /** Analisis hak akses minimum sudah didokumentasikan. */
  leastPrivilegeReviewed: boolean;
  /** Akun runtime bukan akun privileged (DDL/dump). */
  dedicatedRuntimeAccountReady: boolean;
  /** Aplikasi (belum) dipaparkan publik / auth belum ada. */
  publicExposureRestricted: boolean;
  authenticationImplemented: boolean;
}

/** Bukti backup + bukti off-host + rehearsal. */
export interface ActivationEvidence {
  backup: {
    localBackupCreated: boolean;
    artifactExists: boolean;
    manifest: Partial<BackupManifest> | null;
  };
  offHost: OffHostEvidence;
  /** Attestasi operator: backup benar-benar dipindahkan ke host lain. */
  transferred: boolean;
  /** Attestasi operator: checksum diverifikasi ulang di tujuan. */
  destinationChecksumVerified: boolean;
  restoreRehearsal: RestoreRehearsalEvidence;
  maintenanceWindow: string | null;
  operator: string | null;
  rollbackOwner: string | null;
  approvals: ActivationApprovals;
  runtime: RuntimeReadinessEvidence;
}

export interface ActivationChecklistResult {
  items: ChecklistItem[];
  offHost: OffHostEvaluation;
  acceptanceState: BackupAcceptanceState | "NOT_STARTED";
  verdict: "GO" | "NO-GO";
  blockers: string[];
}

function item(
  id: string,
  requirement: string,
  satisfied: boolean | null,
  evidence: string,
): ChecklistItem {
  return { id, requirement, satisfied, evidence };
}

/**
 * Bangun checklist gerbang aktivasi. Item `P0E2B-*` baru; tiap item yang tidak
 * terpenuhi menjadi blocker dan memaksa `NO-GO`.
 */
export function buildActivationReadinessChecklist(
  preflight: PreflightReport,
  evidence: ActivationEvidence,
): ActivationChecklistResult {
  const offHost = evaluateOffHostEvidence(evidence.offHost);
  const manifestProblems = validateBackupManifest(evidence.backup.manifest);

  const acceptanceState = deriveBackupAcceptanceState({
    localBackupCreated: evidence.backup.localBackupCreated,
    transferred: evidence.transferred,
    destinationChecksumVerified: evidence.destinationChecksumVerified && offHost.status === "CONFIRMED_OFF_HOST",
    offHostRestoreRehearsed: evidence.restoreRehearsal.performed && evidence.restoreRehearsal.restoredFromOffHostCopy === true,
  });

  const manifestSha = evidence.backup.manifest?.sha256 ?? null;
  const destinationSha = evidence.offHost.destinationChecksumSha256;

  const items: ChecklistItem[] = [
    // --- Identitas & baseline produksi ------------------------------------ //
    item(
      "P0E2B-1",
      "Identitas database produksi terverifikasi",
      preflight.database === PRODUCTION_DATABASE,
      `database terverifikasi = ${preflight.database === PRODUCTION_DATABASE}`,
    ),
    item(
      "P0E2B-2",
      "Journal produksi hanya memuat 0000 (0001 belum diterapkan)",
      preflight.journal.length === 1,
      `journal rows = ${preflight.journal.length}`,
    ),
    item(
      "P0E2B-3",
      "Baseline migrasi 0001 belum diterapkan (job_id NOT NULL, tanpa kolom idempotensi)",
      preflight.cashflowsJobIdNullable === "NO" &&
        !preflight.idempotencyColumnsPresent.idempotencyKey &&
        !preflight.idempotencyColumnsPresent.idempotencyFingerprint,
      `job_id nullable=${preflight.cashflowsJobIdNullable ?? "tidak ditemukan"}, idempotencyKey=${preflight.idempotencyColumnsPresent.idempotencyKey}`,
    ),
    item(
      "P0E2B-4",
      "Tidak ada schema drift tak terduga",
      preflight.schemaDrift.length === 0,
      preflight.schemaDrift.length === 0 ? "tidak ada drift" : preflight.schemaDrift.join(" | "),
    ),

    // --- Backup & integritas ---------------------------------------------- //
    item(
      "P0E2B-5",
      "Backup lokal (read-only terhadap produksi) tersedia",
      evidence.backup.localBackupCreated && evidence.backup.artifactExists,
      `localBackupCreated=${evidence.backup.localBackupCreated}, artifactExists=${evidence.backup.artifactExists}`,
    ),
    item(
      "P0E2B-6",
      "Manifest backup valid (sumber, nama artefak, ukuran, sha256, Git-ignore)",
      manifestProblems.length === 0,
      manifestProblems.length === 0 ? "manifest valid" : manifestProblems.join("; "),
    ),
    item(
      "P0E2B-7",
      "SHA-256 backup tercatat dan valid",
      isSha256(manifestSha),
      isSha256(manifestSha) ? "sha256 valid" : "sha256 tidak ada/tidak valid",
    ),

    // --- Off-host (empat kondisi terpisah) -------------------------------- //
    item(
      "P0E2B-8",
      "Backup dipindahkan ke host lain",
      evidence.transferred,
      evidence.transferred ? "transfer diatribusikan" : "belum dipindahkan",
    ),
    item(
      "P0E2B-9",
      "Checksum sha256 diverifikasi ulang di tujuan dan sama dengan manifest",
      evidence.destinationChecksumVerified &&
        checksumsMatch(manifestSha, destinationSha),
      `verified=${evidence.destinationChecksumVerified}, cocok=${checksumsMatch(manifestSha, destinationSha)}`,
    ),
    item(
      "P0E2B-10",
      "Bukti backup OFF-HOST lengkap",
      offHost.status === "CONFIRMED_OFF_HOST",
      `status=${offHost.status}`,
    ),
    item(
      "P0E2B-11",
      "Restore rehearsal dijalankan dari salinan OFF-HOST",
      evidence.restoreRehearsal.performed && evidence.restoreRehearsal.restoredFromOffHostCopy === true,
      `performed=${evidence.restoreRehearsal.performed}, fromOffHost=${evidence.restoreRehearsal.restoredFromOffHostCopy}`,
    ),

    // --- Rehearsal restore (target disposable) ---------------------------- //
    item(
      "P0E2B-12",
      "Rehearsal restore memakai database disposable yang diizinkan",
      evidence.restoreRehearsal.databaseName === REHEARSAL_DATABASE,
      `target=${evidence.restoreRehearsal.databaseName ?? "tidak ada"}`,
    ),
    item(
      "P0E2B-13",
      "Skema hasil restore identik dengan produksi",
      evidence.restoreRehearsal.schemaFingerprintMatches === true,
      `schemaFingerprintMatches=${evidence.restoreRehearsal.schemaFingerprintMatches}`,
    ),
    item(
      "P0E2B-14",
      "Journal & jumlah baris hasil restore identik dengan produksi",
      evidence.restoreRehearsal.journalMatches === true && evidence.restoreRehearsal.rowCountsMatch === true,
      `journalMatches=${evidence.restoreRehearsal.journalMatches}, rowCountsMatch=${evidence.restoreRehearsal.rowCountsMatch}`,
    ),

    // --- Kesiapan operasional --------------------------------------------- //
    item(
      "P0E2B-15",
      "Jendela pemeliharaan ditetapkan",
      typeof evidence.maintenanceWindow === "string" && evidence.maintenanceWindow.trim() !== "",
      evidence.maintenanceWindow ? "ditetapkan" : "belum ditetapkan",
    ),
    item(
      "P0E2B-16",
      "Operator bernama ditunjuk",
      typeof evidence.operator === "string" && evidence.operator.trim() !== "",
      evidence.operator ? "ditunjuk" : "belum ditunjuk",
    ),
    item(
      "P0E2B-17",
      "Pemilik rollback bernama ditunjuk",
      typeof evidence.rollbackOwner === "string" && evidence.rollbackOwner.trim() !== "",
      evidence.rollbackOwner ? "ditunjuk" : "belum ditunjuk",
    ),

    // --- Persetujuan terpisah --------------------------------------------- //
    item(
      "P0E2B-18",
      "Persetujuan migrasi 0001 terpisah diberikan (tertulis)",
      evidence.approvals.migrationApproval === true &&
        typeof evidence.approvals.migrationApprovalReference === "string" &&
        evidence.approvals.migrationApprovalReference.trim() !== "",
      `migrationApproval=${evidence.approvals.migrationApproval}, rujukan=${evidence.approvals.migrationApprovalReference ? "ada" : "kosong"}`,
    ),
    item(
      "P0E2B-19",
      "Persetujuan aktivasi runtime terpisah diberikan (tertulis)",
      evidence.approvals.activationApproval === true &&
        typeof evidence.approvals.activationApprovalReference === "string" &&
        evidence.approvals.activationApprovalReference.trim() !== "",
      `activationApproval=${evidence.approvals.activationApproval}, rujukan=${evidence.approvals.activationApprovalReference ? "ada" : "kosong"}`,
    ),

    // --- Keamanan & hak akses --------------------------------------------- //
    item(
      "P0E2B-20",
      "Hak akses DB runtime least-privilege ditinjau & akun runtime siap",
      evidence.runtime.leastPrivilegeReviewed && evidence.runtime.dedicatedRuntimeAccountReady,
      `reviewed=${evidence.runtime.leastPrivilegeReviewed}, accountReady=${evidence.runtime.dedicatedRuntimeAccountReady}`,
    ),
    item(
      "P0E2B-21",
      "Aktivasi publik dibatasi sampai auth (P1A/P1B) tersedia",
      evidence.runtime.publicExposureRestricted || evidence.runtime.authenticationImplemented,
      `exposureRestricted=${evidence.runtime.publicExposureRestricted}, authImplemented=${evidence.runtime.authenticationImplemented}`,
    ),
  ];

  const blockers = items
    .filter((entry) => entry.satisfied !== true)
    .map((entry) => `${entry.id}: ${entry.requirement}`);

  return {
    items,
    offHost,
    acceptanceState,
    verdict: blockers.length === 0 ? "GO" : "NO-GO",
    blockers,
  };
}
