/**
 * GUARD AKTIVASI P0E-2A — murni (tanpa I/O), dapat diuji.
 *
 * Modul ini memuat SATU-SATUNYA logika keputusan nama database yang dipakai
 * rehearsal backup/restore. Semuanya GAGAL TERTUTUP: jika nama database tidak
 * dikenali, operasi ditolak (bukan "dianggap aman").
 *
 * Klasifikasi database:
 * - `database-airprod`  → PRODUKSI. Boleh DIBACA (dump/preflight), TIDAK PERNAH boleh ditulis.
 * - `airprod_test`      → database test bersama. Dihapus-ulang setiap `vitest` run,
 *                         jadi TIDAK boleh dipakai untuk rehearsal (hasilnya hilang).
 * - `airprod_rehearsal` → satu-satunya database rehearsal yang boleh ditulis/dihapus.
 *
 * Tidak ada nilai kredensial yang dibaca, disimpan, atau dicetak di sini.
 */

import { databaseNameFromUrl, PRODUCTION_DATABASE } from "./preflight";

export { databaseNameFromUrl, PRODUCTION_DATABASE };

/** Database test bersama yang dipakai `vitest` (direset tiap run). */
export const SHARED_TEST_DATABASE = "airprod_test";

/** Satu-satunya database disposable yang boleh ditulis oleh rehearsal. */
export const REHEARSAL_DATABASE = "airprod_rehearsal";

/** Direktori arsip backup (di-ignore Git). */
export const BACKUP_DIR = ".migration-backups";

export class GuardViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardViolationError";
  }
}

/** Hanya database produksi yang boleh menjadi SUMBER backup. */
export function assertBackupSourceAllowed(databaseName: string): void {
  if (databaseName !== PRODUCTION_DATABASE) {
    throw new GuardViolationError(
      `STOP: backup hanya boleh membaca sumber '${PRODUCTION_DATABASE}', bukan '${databaseName}'.`,
    );
  }
}

/** Hanya database rehearsal yang boleh menjadi TARGET penulisan/penghapusan. */
export function assertRehearsalTargetAllowed(databaseName: string): void {
  if (databaseName === PRODUCTION_DATABASE) {
    throw new GuardViolationError(
      "STOP: database produksi TIDAK PERNAH boleh menjadi target rehearsal.",
    );
  }
  if (databaseName === SHARED_TEST_DATABASE) {
    throw new GuardViolationError(
      `STOP: '${SHARED_TEST_DATABASE}' direset setiap run test — dilarang sebagai target rehearsal.`,
    );
  }
  if (databaseName !== REHEARSAL_DATABASE) {
    throw new GuardViolationError(
      `STOP: target rehearsal hanya boleh '${REHEARSAL_DATABASE}', bukan '${databaseName}'.`,
    );
  }
}

/** Operasi destruktif (DROP DATABASE) tidak boleh menyentuh produksi/test bersama. */
export function assertDestructiveTargetAllowed(databaseName: string): void {
  if (databaseName !== REHEARSAL_DATABASE) {
    throw new GuardViolationError(
      `STOP: DROP DATABASE hanya diizinkan untuk '${REHEARSAL_DATABASE}', bukan '${databaseName}'.`,
    );
  }
}

/** Nama database yang TIDAK boleh disentuh oleh tooling ini, dalam bentuk apa pun. */
export function isProtectedDatabase(databaseName: string): boolean {
  return databaseName === PRODUCTION_DATABASE || databaseName === SHARED_TEST_DATABASE;
}

/**
 * Apakah direktori arsip backup dilindungi dari Git?
 * Menerima isi `.gitignore` apa adanya; mencari baris yang menutup direktori
 * (mis. `.migration-backups/`). Tidak membaca/menulis berkas.
 */
export function isBackupDirIgnored(gitignoreText: string): boolean {
  const wanted = new Set<string>([
    BACKUP_DIR,
    `${BACKUP_DIR}/`,
    `/${BACKUP_DIR}`,
    `/${BACKUP_DIR}/`,
    `**/${BACKUP_DIR}`,
    `**/${BACKUP_DIR}/`,
  ]);
  return gitignoreText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line !== "" && !line.startsWith("#") && wanted.has(line));
}

/**
 * Path laporan yang aman: relatif terhadap root proyek, tanpa home directory /
 * username absolut, dan hanya menyebut nama arsip.
 */
export function sanitizeArtifactPath(projectRoot: string, absolutePath: string): string {
  const root = projectRoot.endsWith("/") ? projectRoot : `${projectRoot}/`;
  return absolutePath.startsWith(root) ? absolutePath.slice(root.length) : `<external>/${absolutePath.split("/").pop() ?? "artifact"}`;
}

/** Nama berkas dump deterministik per tanggal + checksum pendek. */
export function backupFileName(databaseName: string, stamp: string, shortChecksum: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(databaseName)) {
    throw new GuardViolationError("STOP: nama database tidak aman untuk nama berkas.");
  }
  return `${databaseName}-${stamp}-${shortChecksum}.sql`;
}

// ===========================================================================
// P0E-2A.1 — HARDENING GERBANG AKTIVASI & BACKUP KE LAPTOP/PC OWNER
// ===========================================================================
//
// Lapisan kedua di atas guard P0E-2A. Semua fungsi tetap MURNI dan GAGAL
// TERTUTUP: bukti yang tidak lengkap TIDAK pernah dianggap "aman". Nilai
// kredensial tidak pernah dibaca/dicetak di sini.

/** Klasifikasi host TANPA mengekspos alamat: hanya kategori. */
export type HostClass = "LOOPBACK" | "PRIVATE_LAN" | "PUBLIC_OR_NAMED" | "UNKNOWN";

/**
 * Klasifikasi nama host menjadi kategori aman-lapor. Alamat privat tidak
 * pernah dikembalikan — hanya kategorinya.
 */
export function classifyHost(hostname: string): HostClass {
  const host = hostname.trim().toLowerCase();
  if (host === "") return "UNKNOWN";
  if (host === "localhost" || host.startsWith("127.") || host === "::1" || host === "[::1]" || host === "0.0.0.0") {
    return "LOOPBACK";
  }
  if (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)
  ) {
    return "PRIVATE_LAN";
  }
  return "PUBLIC_OR_NAMED";
}

/**
 * Klasifikasi host dari sebuah connection string (bukan `DATABASE_URL`
 * langsung — pemanggil sudah memvalidasinya). Connection string TIDAK pernah
 * dikembalikan/dicetak.
 */
export function classifyHostFromUrl(url: string): HostClass {
  try {
    return classifyHost(new URL(url).hostname);
  } catch {
    return "UNKNOWN";
  }
}

/** Normalisasi checksum sha256 (huruf kecil, tanpa spasi). */
export function normalizeChecksum(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalised = value.trim().toLowerCase();
  return normalised === "" ? null : normalised;
}

/** SHA-256 valid = 64 karakter heksadesimal. */
export function isSha256(value: string | null | undefined): boolean {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value.trim().toLowerCase());
}

/** Bandingkan dua checksum (case-insensitive). `false` bila salah satu kosong. */
export function checksumsMatch(
  expected: string | null | undefined,
  actual: string | null | undefined,
): boolean {
  const a = normalizeChecksum(expected);
  const b = normalizeChecksum(actual);
  return a !== null && b !== null && a === b;
}

/** Gagal-tertutup: checksum yang hilang ATAU berbeda selalu melempar error. */
export function assertChecksumsMatch(
  expected: string | null | undefined,
  actual: string | null | undefined,
  label = "artefak backup",
): void {
  if (!isSha256(expected) || !isSha256(actual)) {
    throw new GuardViolationError(
      `STOP: checksum ${label} tidak lengkap — verifikasi integritas tidak dapat dibuktikan.`,
    );
  }
  if (!checksumsMatch(expected, actual)) {
    throw new GuardViolationError(`STOP: checksum ${label} TIDAK cocok — tolak transfer/restore.`);
  }
}

/** Nama berkas artefak backup yang aman (tanpa path, hanya `.sql`). */
export function isSafeArtifactName(name: string): boolean {
  return /^[A-Za-z0-9._-]+\.sql$/.test(name) && !name.includes("/") && !name.includes("..");
}

/** Path artefak harus berada di dalam direktori arsip proyek. */
export function assertArtifactPathInsideBackupDir(projectRoot: string, absolutePath: string): void {
  const dir = path_resolve(projectRoot, BACKUP_DIR);
  const resolved = path_resolve(projectRoot, absolutePath);
  if (resolved !== dir && !resolved.startsWith(`${dir}/`)) {
    throw new GuardViolationError(
      `STOP: artefak backup harus berada di dalam ${BACKUP_DIR}/ proyek.`,
    );
  }
}

// Resolusi path lokal tanpa mengimpor `node:path` (modul ini bebas I/O).
function path_resolve(root: string, target: string): string {
  const base = root.replace(/\/+$/, "");
  if (target.startsWith("/")) return target;
  return `${base}/${target.replace(/^\.\//, "")}`;
}

/**
 * Bukti lintas-host untuk backup (diisi operator/tool verifikasi). SEMUA kolom
 * yang tidak dapat dibuktikan WAJIB dibiarkan `null` — bukan ditebak.
 */
export interface OffHostEvidence {
  /** Kategori host tempat database produksi berjalan. */
  databaseHostClass: HostClass;
  /** Kategori host tempat artefak backup disimpan. */
  backupHostClass: HostClass;
  /** Attestasi eksplisit operator: tujuan adalah mesin yang berbeda dari DB. */
  destinationIsSeparateMachine: boolean | null;
  /** Sudah dikonfirmasi (independen dari host DB) bahwa berkas tujuan ada. */
  destinationPathExists: boolean | null;
  /** Checksum sha256 yang dihitung ULANG di tujuan. */
  destinationChecksumSha256: string | null;
  /** Checksum sha256 dari manifest on-host. */
  expectedChecksumSha256: string | null;
  /** Waktu verifikasi transfer (ISO-8601) di tujuan. */
  transferredAt: string | null;
  /** Nama operator yang memverifikasi. */
  recordedBy: string | null;
}

export type OffHostStatus = "CONFIRMED_OFF_HOST" | "NOT_OFF_HOST" | "UNVERIFIED";

export interface OffHostEvaluation {
  status: OffHostStatus;
  checks: Array<{ id: string; requirement: string; satisfied: boolean | null; evidence: string }>;
}

/**
 * Evaluasi bukti lintas-host. Gagal-tertutup:
 * - Jika DB berjalan di LOOPBACK dan tujuan berada di LOOPBACK pula, satu-satunya
 *   cara dianggap OFF-HOST adalah attestasi operator yang eksplisit
 *   (`destinationIsSeparateMachine === true`). Tanpa itu → `NOT_OFF_HOST`.
 * - Bukti tidak lengkap (path/checksum/operator/waktu) → `UNVERIFIED`.
 */
export function evaluateOffHostEvidence(evidence: OffHostEvidence): OffHostEvaluation {
  const checks: OffHostEvaluation["checks"] = [];
  const push = (id: string, requirement: string, satisfied: boolean | null, note: string) => {
    checks.push({ id, requirement, satisfied, evidence: note });
  };

  push(
    "OFFHOST-1",
    "Database produksi dan tujuan backup tidak berjalan di mesin yang sama",
    evidence.destinationIsSeparateMachine,
    evidence.destinationIsSeparateMachine === null
      ? "belum diatribusikan oleh operator"
      : `attestasi operator = ${evidence.destinationIsSeparateMachine}`,
  );
  push(
    "OFFHOST-2",
    "Artefak backup benar-benar ada di tujuan (independen dari host DB)",
    evidence.destinationPathExists,
    evidence.destinationPathExists === null ? "belum dikonfirmasi" : String(evidence.destinationPathExists),
  );
  push(
    "OFFHOST-3",
    "Checksum sha256 dihitung ulang di tujuan",
    isSha256(evidence.destinationChecksumSha256),
    isSha256(evidence.destinationChecksumSha256) ? "sha256 valid" : "checksum tujuan tidak ada/tidak valid",
  );
  push(
    "OFFHOST-4",
    "Checksum di tujuan sama dengan checksum manifest on-host",
    checksumsMatch(evidence.expectedChecksumSha256, evidence.destinationChecksumSha256),
    "perbandingan sha256",
  );
  push(
    "OFFHOST-5",
    "Verifikasi transfer direkam (waktu + operator)",
    typeof evidence.transferredAt === "string" && evidence.transferredAt.trim() !== "" &&
      typeof evidence.recordedBy === "string" && evidence.recordedBy.trim() !== "",
    `transferredAt=${evidence.transferredAt ? "ada" : "kosong"}, recordedBy=${evidence.recordedBy ? "ada" : "kosong"}`,
  );

  const attestation = evidence.destinationIsSeparateMachine;
  if (attestation === false) {
    return { status: "NOT_OFF_HOST", checks };
  }

  const allSatisfied = checks.every((check) => check.satisfied === true);
  if (attestation === true && allSatisfied) {
    return { status: "CONFIRMED_OFF_HOST", checks };
  }
  return { status: "UNVERIFIED", checks };
}

/**
 * Gagal-tertutup: aktivasi hanya boleh membaca bukti OFF-HOST yang TERKONFIRMASI.
 * `NOT_OFF_HOST` dan `UNVERIFIED` sama-sama menghentikan proses (dengan pesan
 * berbeda), bukan dianggap lolos.
 */
export function assertOffHostConfirmed(evaluation: OffHostEvaluation): void {
  if (evaluation.status === "NOT_OFF_HOST") {
    throw new GuardViolationError(
      "STOP: tujuan backup berada di MESIN YANG SAMA dengan database — BUKAN off-host. " +
        "Proses penerimaan off-host dihentikan sampai ada keputusan tujuan terpisah.",
    );
  }
  if (evaluation.status !== "CONFIRMED_OFF_HOST") {
    throw new GuardViolationError(
      "STOP: bukti backup off-host belum lengkap — status BLOCKED, bukan lolos.",
    );
  }
}

/** Manifest artefak backup (JSON, dilindungi Git). Tidak memuat kredensial. */
export interface BackupManifest {
  format: "p0e2a1-backup-manifest/1";
  database: string;
  artifactFile: string;
  bytes: number;
  sha256: string;
  createdAt: string;
  serverVersion: string;
  tableCount: number;
  journalMaxId: number;
  artifactMode: string;
  gitIgnored: boolean;
}

/** Validasi manifest backup; kembalikan daftar masalah (kosong = valid). */
export function validateBackupManifest(manifest: Partial<BackupManifest> | null | undefined): string[] {
  const problems: string[] = [];
  if (!manifest || typeof manifest !== "object") return ["manifest tidak ada"];
  if (manifest.format !== "p0e2a1-backup-manifest/1") problems.push("format manifest tidak dikenal");
  if (manifest.database !== PRODUCTION_DATABASE) {
    problems.push(`sumber manifest bukan '${PRODUCTION_DATABASE}'`);
  }
  if (typeof manifest.artifactFile !== "string" || !isSafeArtifactName(manifest.artifactFile)) {
    problems.push("nama artefak tidak aman");
  }
  if (!isSha256(manifest.sha256)) problems.push("sha256 manifest tidak valid");
  if (typeof manifest.bytes !== "number" || !Number.isInteger(manifest.bytes) || manifest.bytes <= 0) {
    problems.push("ukuran artefak tidak valid");
  }
  if (typeof manifest.createdAt !== "string" || Number.isNaN(Date.parse(manifest.createdAt))) {
    problems.push("createdAt tidak valid");
  }
  if (manifest.gitIgnored !== true) problems.push("artefak belum dikonfirmasi di-ignore Git");
  return problems;
}

/** Gagal-tertutup: manifest yang tidak valid tidak boleh dipakai untuk transfer. */
export function assertBackupManifestValid(manifest: Partial<BackupManifest> | null | undefined): void {
  const problems = validateBackupManifest(manifest);
  if (problems.length > 0) {
    throw new GuardViolationError(`STOP: manifest backup tidak valid — ${problems.join("; ")}.`);
  }
}

/** Gerbang persetujuan: approval migrasi dan aktivasi adalah keputusan TERPISAH. */
export interface ActivationApprovals {
  migrationApproval: boolean | null;
  activationApproval: boolean | null;
  migrationApprovalReference: string | null;
  activationApprovalReference: string | null;
}

/** Validasi gerbang persetujuan; kembalikan daftar masalah (kosong = lolos). */
export function validateActivationApprovals(approvals: ActivationApprovals): string[] {
  const problems: string[] = [];
  if (approvals.migrationApproval !== true) problems.push("persetujuan migrasi 0001 belum diberikan");
  if (approvals.activationApproval !== true) problems.push("persetujuan aktivasi runtime belum diberikan");
  if (approvals.migrationApproval === true) {
    if (!approvals.migrationApprovalReference || approvals.migrationApprovalReference.trim() === "") {
      problems.push("persetujuan migrasi ada tetapi tanpa rujukan tertulis");
    }
  }
  if (approvals.activationApproval === true) {
    if (!approvals.activationApprovalReference || approvals.activationApprovalReference.trim() === "") {
      problems.push("persetujuan aktivasi ada tetapi tanpa rujukan tertulis");
    }
  }
  return problems;
}

/** Gagal-tertutup: kedua persetujuan (dengan rujukan) wajib sebelum aktivasi. */
export function assertActivationApprovals(approvals: ActivationApprovals): void {
  const problems = validateActivationApprovals(approvals);
  if (problems.length > 0) {
    throw new GuardViolationError(`STOP: gerbang persetujuan belum lengkap — ${problems.join("; ")}.`);
  }
}

/**
 * Deteksi kebocoran rahasia pada teks laporan/instruksi. Menerima daftar nilai
 * rahasia (kredensial) dan mengembalikan kemunculannya (tanpa mencetak nilainya).
 */
export function findSecretLeaks(text: string, secrets: Array<string | null | undefined>): boolean {
  for (const secret of secrets) {
    if (typeof secret !== "string") continue;
    const trimmed = secret.trim();
    if (trimmed.length < 4) continue;
    if (text.includes(trimmed)) return true;
  }
  return false;
}

/** Gagal-tertutup: teks yang akan dipublikasikan tidak boleh memuat rahasia. */
export function assertNoSecretLeak(
  text: string,
  secrets: Array<string | null | undefined>,
  label = "teks",
): void {
  if (findSecretLeaks(text, secrets)) {
    throw new GuardViolationError(
      `STOP: ${label} memuat nilai rahasia — jangan cetak/commit. Nilai tidak ditampilkan.`,
    );
  }
}

/** Status bukti backup yang harus dibedakan (P0E-2A.1 §5). */
export type BackupAcceptanceState =
  | "LOCAL_BACKUP_CREATED"
  | "TRANSFERRED_TO_OTHER_HOST"
  | "DESTINATION_CHECKSUM_VERIFIED"
  | "OFF_HOST_RESTORE_REHEARSED";

/**
 * Tentukan tahap penerimaan tertinggi yang benar-benar terbukti. Checksum yang
 * cocok SAJA tidak pernah menaikkan status ke restore berhasil.
 */
export function deriveBackupAcceptanceState(input: {
  localBackupCreated: boolean;
  transferred: boolean;
  destinationChecksumVerified: boolean;
  offHostRestoreRehearsed: boolean;
}): BackupAcceptanceState | "NOT_STARTED" {
  if (input.offHostRestoreRehearsed) return "OFF_HOST_RESTORE_REHEARSED";
  if (input.destinationChecksumVerified) return "DESTINATION_CHECKSUM_VERIFIED";
  if (input.transferred) return "TRANSFERRED_TO_OTHER_HOST";
  if (input.localBackupCreated) return "LOCAL_BACKUP_CREATED";
  return "NOT_STARTED";
}
