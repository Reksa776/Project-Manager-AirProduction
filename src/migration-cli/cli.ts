import path from "node:path";
import { pathToFileURL } from "node:url";

import { ensureEnvFileLoaded } from "@/db/env";
import {
  blockingDecisions,
  isSourceDataAvailable,
  migrationBlockers,
  SourceDataUnavailableError,
  type SnapshotDryRunReport,
} from "@/migration";

import { buildP0D2BReadinessChecklist, runProductionPreflight } from "./preflight";
import { createReadOnlySheetsGateway } from "./read-only-sheets";
import {
  acquireAndPlanSnapshot,
  formatSanitizedSummary,
  RAW_SNAPSHOT_DIR,
  readRawSnapshot,
  writeRawSnapshot,
} from "./snapshot-runner";

/**
 * CLI MIGRASI (P0D-2A) — READ ONLY.
 *
 * Pemakaian:
 *   npm run migration:snapshot              # baca snapshot read-only + dry-run
 *   npm run migration:snapshot -- --write-raw
 *   npm run migration:snapshot -- --previous=<snapshotId>
 *   npm run migration:preflight             # preflight MySQL produksi (read-only)
 *
 * Tidak ada perintah yang mengimpor data, menerapkan migration, atau menulis ke
 * Google Sheets/MySQL. Snapshot mentah (memuat data pribadi) hanya ditulis ke
 * direktori yang di-ignore Git dan hanya bila `--write-raw` diberikan.
 */

const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_USAGE = 2;
/** BLOCKED karena kredensial/sumber tidak tersedia — bukan kegagalan kode. */
const EXIT_BLOCKED_SOURCE = 3;

export function usage(): string {
  return [
    "Penggunaan: migration-cli <perintah> [opsi]",
    "",
    "Perintah:",
    "  snapshot    Baca snapshot Google Sheets (read-only) lalu jalankan dry-run.",
    "  preflight   Preflight MySQL produksi (SELECT/information_schema saja).",
    "",
    "Opsi snapshot:",
    "  --write-raw            Tulis arsip snapshot MENTAH ke .migration-snapshots (di-ignore Git).",
    "  --out-dir=<dir>        Direktori arsip snapshot mentah.",
    "  --previous=<id>        Bandingkan dengan snapshot mentah sebelumnya.",
    "",
    "Semua perintah bersifat READ ONLY dan tidak pernah mengimpor data historis.",
  ].join("\n");
}

function parseFlag(argv: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

/** Ringkasan dry-run (aman dilaporkan). */
export function formatDryRunSummary(report: SnapshotDryRunReport): string {
  const lines: string[] = [
    "",
    "=== Dry-run (snapshot tetap, tanpa penulisan) ===",
    `snapshotId            : ${report.snapshotId}`,
    `schemaFingerprint     : ${report.schemaFingerprint}`,
    `snapshotFingerprint   : ${report.snapshotFingerprint}`,
    `writesAttempted       : ${report.writesAttempted}`,
    `baris rencana         : ${report.plan.length}`,
    `rekonsiliasi          : ${report.reconciliations.length}`,
    `referensi yatim       : ${report.referenceIssues.length}`,
    `duplikat id sumber    : ${report.duplicateSourceIds.length}`,
    `duplikat PROVEN       : ${report.duplicateEvidence.proven}`,
    `duplikat POTENTIAL    : ${report.duplicateEvidence.potential}`,
    `konflik arsip venue   : ${report.venueArchive.conflicts}`,
    `nama venue kosong     : ${report.venueArchive.blankNames}`,
    `kamus crew role       : ${report.crewRoleProposal.roles.length} (${report.crewRoleProposal.approvalStatus})`,
    `income / expense / net: ${report.totals.grand.income} / ${report.totals.grand.expense} / ${report.totals.grand.net}`,
    `obligasi / paid / out : ${report.totals.obligation.total} / ${report.totals.paid.total} / ${report.totals.outstanding.total}`,
    "",
    "Per-entity (READY / rekonsiliasi / skip / deferred):",
  ];
  for (const [entity, summary] of Object.entries(report.byEntity)) {
    lines.push(
      `  ${entity.padEnd(24)} ${String(summary.ready).padStart(5)} / ${String(summary.reconciliation).padStart(5)} / ${String(summary.skipped).padStart(5)} / ${String(summary.deferred).padStart(5)}`,
    );
  }
  const blockers = migrationBlockers(report.decisionRegister);
  lines.push(
    "",
    `Keputusan memblokir (belum disetujui): ${blockers.map((entry) => entry.id).join(", ") || "tidak ada"}`,
    `Total keputusan belum disetujui: ${blockingDecisions(report.decisionRegister).length}/${report.decisionRegister.length}`,
    "",
    "CATATAN: laporan ini BUKAN persetujuan impor. Tidak ada baris historis yang diimpor.",
  );
  return `${lines.join("\n")}\n`;
}

async function runSnapshotCommand(argv: readonly string[]): Promise<number> {
  ensureEnvFileLoaded();
  if (!isSourceDataAvailable()) {
    process.stderr.write(
      [
        "BLOCKED ON SOURCE ACCESS: GOOGLE_SHEETS_ID tidak tersedia pada environment.",
        "Snapshot nyata TIDAK dibaca dan dry-run nyata TIDAK dijalankan.",
        "Inventory/dry-run berbasis data historis tetap BLOCKED (tidak ada angka yang dikarang).",
        "Tooling, validasi snapshot, dan test tetap dapat dijalankan tanpa kredensial.",
        "",
      ].join("\n"),
    );
    return EXIT_BLOCKED_SOURCE;
  }

  const outDir = parseFlag(argv, "out-dir") ?? RAW_SNAPSHOT_DIR;
  const previousId = parseFlag(argv, "previous");
  const previousSnapshot = previousId ? await readRawSnapshot(previousId, outDir) : undefined;
  const acquiredAt = process.env.MIGRATION_SNAPSHOT_AT ?? new Date().toISOString();

  const result = await acquireAndPlanSnapshot({
    gateway: createReadOnlySheetsGateway(),
    acquiredAt,
    previousSnapshot,
  });

  process.stdout.write(formatSanitizedSummary(result.summary));
  process.stdout.write(formatDryRunSummary(result.report));

  if (hasFlag(argv, "write-raw")) {
    const target = await writeRawSnapshot(result.snapshot, outDir);
    process.stdout.write(
      `\nArsip snapshot mentah (memuat data pribadi, gitignored): ${path.relative(process.cwd(), target)}\n` +
        "Jangan commit/push/cetak isinya.\n",
    );
  }
  return EXIT_OK;
}

async function runPreflightCommand(): Promise<number> {
  ensureEnvFileLoaded();
  const report = await runProductionPreflight();
  const lines: string[] = [
    "=== Preflight MySQL produksi (READ ONLY) ===",
    `database     : ${report.database}`,
    `tabel        : ${report.tableCount}`,
    `journal      : ${report.journal.length === 0 ? "tidak ditemukan" : report.journal.map((row) => `#${row.id}`).join(", ")}`,
    `job_id nullable: ${report.cashflowsJobIdNullable ?? "tidak ditemukan"}`,
    `kolom idempotensi: key=${report.idempotencyColumnsPresent.idempotencyKey}, fingerprint=${report.idempotencyColumnsPresent.idempotencyFingerprint}`,
    `UNIQUE idempotensi: ${report.uniqueIdempotencyIndexPresent}`,
    `FK cashflows : ${report.cashflowsForeignKeys.join(" | ") || "tidak ada"}`,
    `default crew.default_payment=${report.defaults.crewDefaultPayment ?? "-"}, job_crews.agreed_amount=${report.defaults.jobCrewsAgreedAmount ?? "-"}`,
    "",
    "Baris per tabel:",
  ];
  for (const table of report.tables) {
    lines.push(`  ${table.table.padEnd(24)} ${table.rowCount}`);
  }
  lines.push("", `Schema drift : ${report.schemaDrift.length === 0 ? "tidak ada" : report.schemaDrift.join(" | ")}`);
  lines.push("", "Checklist kesiapan P0D-2B:");
  for (const item of buildP0D2BReadinessChecklist(report)) {
    const mark = item.satisfied === true ? "[OK]  " : item.satisfied === false ? "[!]   " : "[?]   ";
    lines.push(`  ${mark}${item.id}: ${item.requirement} — ${item.evidence}`);
  }
  lines.push("", "CATATAN: preflight tidak menerapkan migration 0001 dan tidak menulis data.");
  process.stdout.write(`${lines.join("\n")}\n`);
  return EXIT_OK;
}

export async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case "snapshot":
      return runSnapshotCommand(rest);
    case "preflight":
      return runPreflightCommand();
    case "help":
    case undefined:
      process.stdout.write(`${usage()}\n`);
      return command === undefined ? EXIT_USAGE : EXIT_OK;
    default:
      process.stderr.write(`Perintah tidak dikenal: ${command}\n\n${usage()}\n`);
      return EXIT_USAGE;
  }
}

async function cli(): Promise<void> {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    if (error instanceof SourceDataUnavailableError) {
      process.stderr.write(`BLOCKED ON SOURCE ACCESS: ${error.message}\n`);
      process.exitCode = EXIT_BLOCKED_SOURCE;
      return;
    }
    process.stderr.write(
      `Gagal menjalankan CLI migrasi: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = EXIT_ERROR;
  }
}

const entry = process.argv[1];
const isDirectRun =
  entry !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(entry)).href;

if (isDirectRun) {
  void cli();
}
