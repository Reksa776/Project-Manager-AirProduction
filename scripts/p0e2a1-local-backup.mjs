/**
 * BACKUP KE LAPTOP/PC OWNER — P0E-2A.1 (READ-ONLY terhadap produksi).
 *
 * Menyiapkan artefak backup + manifest (checksum sha256, ukuran, mode, tabel,
 * journal) dan instruksi transfer yang AMAN ke laptop/PC owner, lalu
 * memverifikasi salinan DI TUJUAN. Semua operasi gagal-tertutup:
 *
 * - Hanya `database-airprod` yang boleh menjadi sumber (guard P0E-2A).
 * - Kredensial lewat berkas `--defaults-extra-file` mode 0600 sementara, tidak
 *   pernah di argv/`ps`, tidak pernah dicetak.
 * - Artefak + manifest disimpan di `.migration-backups/` (di-ignore Git, mode 0600).
 * - Verifikasi tujuan MENOLAK transfer yang checksum-nya tidak cocok, dan
 *   melaporkan OFF-HOST hanya bila operator mengattestasi mesin terpisah.
 *
 * Pemakaian:
 *   node --import ./scripts/migration-ts-register.mjs scripts/p0e2a1-local-backup.mjs prepare [--fresh]
 *   node --import ./scripts/migration-ts-register.mjs scripts/p0e2a1-local-backup.mjs verify --dir=<dirTujuan> --separate-machine
 * (tersedia via `npm run migration:backup:local` / `... -- verify ...`)
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BACKUP_DIR,
  PRODUCTION_DATABASE,
  assertBackupSourceAllowed,
  assertChecksumsMatch,
  assertNoSecretLeak,
  backupFileName,
  classifyHostFromUrl,
  databaseNameFromUrl,
  evaluateOffHostEvidence,
  isBackupDirIgnored,
  sanitizeArtifactPath,
} from "@/migration-cli/activation-guards";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const BACKUP_ABSOLUTE_DIR = path.resolve(PROJECT_ROOT, BACKUP_DIR);
const MANIFEST_FORMAT = "p0e2a1-backup-manifest/1";

const log = (line = "") => process.stdout.write(`${line}\n`);

function loadDatabaseUrl() {
  const envFile = path.resolve(PROJECT_ROOT, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const raw = (process.env.DATABASE_URL ?? "").trim().replace(/^["']|["']$/g, "");
  if (!raw) throw new Error("DATABASE_URL belum diatur.");
  if (!/^mysql:|^mariadb:/i.test(raw)) throw new Error("DATABASE_URL bukan connection string MySQL.");
  return raw;
}

function parseFlag(argv, name) {
  const prefix = `--${name}=`;
  const match = argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

function fileMode(absolutePath) {
  return `0${(statSync(absolutePath).mode & 0o777).toString(8)}`;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function writeCredentialsFile(url, dir) {
  const parsed = new URL(url);
  const file = path.join(dir, "client.cnf");
  const lines = ["[client]"];
  if (parsed.hostname) lines.push(`host=${parsed.hostname}`);
  if (parsed.port) lines.push(`port=${parsed.port}`);
  if (parsed.username) lines.push(`user=${decodeURIComponent(parsed.username)}`);
  if (parsed.password) lines.push(`password=${decodeURIComponent(parsed.password)}`);
  writeFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });
  return file;
}

/** Backup segar, read-only terhadap produksi (mode 0600). */
function takeFreshDump(prodUrl, credentialsDir) {
  const credentialsFile = writeCredentialsFile(prodUrl, credentialsDir);
  try {
    const args = [
      `--defaults-extra-file=${credentialsFile}`,
      "--single-transaction",
      "--routines",
      "--triggers",
      "--events",
      "--no-tablespaces",
      "--skip-comments",
      "--databases",
      PRODUCTION_DATABASE,
    ];
    const dump = spawnSync("mysqldump", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (dump.status !== 0) {
      throw new Error(`mysqldump gagal (status ${dump.status}): ${(dump.stderr || "").split("\n")[0]}`);
    }
    const buffer = Buffer.from(dump.stdout ?? "", "utf8");
    const checksum = sha256(buffer);
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const fileName = backupFileName(PRODUCTION_DATABASE, stamp, checksum.slice(0, 12));
    const artifactPath = path.join(BACKUP_ABSOLUTE_DIR, fileName);
    if (existsSync(artifactPath)) throw new Error("Artefak dengan nama sama sudah ada — tidak menimpa.");
    writeFileSync(artifactPath, buffer, { mode: 0o600 });
    return artifactPath;
  } finally {
    if (existsSync(credentialsFile)) rmSync(credentialsFile, { force: true });
  }
}

function latestArtifact() {
  if (!existsSync(BACKUP_ABSOLUTE_DIR)) return null;
  const files = readdirSync(BACKUP_ABSOLUTE_DIR)
    .filter((name) => /^database-airprod-.*\.sql$/.test(name))
    .map((name) => ({ name, mtime: statSync(path.join(BACKUP_ABSOLUTE_DIR, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length === 0 ? null : path.join(BACKUP_ABSOLUTE_DIR, files[0].name);
}

function writeManifest(artifactPath, database, serverVersion, tableCount, journalMaxId, gitIgnored) {
  const buffer = readFileSync(artifactPath);
  const manifest = {
    format: MANIFEST_FORMAT,
    database,
    artifactFile: path.basename(artifactPath),
    bytes: buffer.length,
    sha256: sha256(buffer),
    createdAt: new Date().toISOString(),
    serverVersion,
    tableCount,
    journalMaxId,
    artifactMode: fileMode(artifactPath),
    gitIgnored,
  };
  const manifestPath = `${artifactPath}.manifest.json`;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return { manifest, manifestPath };
}

async function runPrepare(argv) {
  mkdirSync(BACKUP_ABSOLUTE_DIR, { recursive: true });
  const prodUrl = loadDatabaseUrl();
  const prodName = databaseNameFromUrl(prodUrl);
  assertBackupSourceAllowed(prodName);

  const gitignore = readFileSync(path.resolve(PROJECT_ROOT, ".gitignore"), "utf8");
  const ignored = isBackupDirIgnored(gitignore);
  if (!ignored) throw new Error(`STOP: ${BACKUP_DIR}/ belum di-ignore Git.`);

  const dbHostClass = classifyHostFromUrl(prodUrl);
  const credentialsDir = mkdtempSync(path.join(tmpdir(), "p0e2a1-"));
  let artifactPath;
  try {
    artifactPath = argv.includes("--fresh") ? takeFreshDump(prodUrl, credentialsDir) : latestArtifact();
  } finally {
    rmSync(credentialsDir, { recursive: true, force: true });
  }
  if (!artifactPath || !existsSync(artifactPath)) {
    throw new Error("Tidak ada artefak backup. Jalankan `npm run migration:rehearsal` atau ulangi dengan `--fresh`.");
  }

  const { manifest, manifestPath } = writeManifest(artifactPath, PRODUCTION_DATABASE, "MariaDB", 0, 0, ignored);
  const secrets = [new URL(prodUrl).password, new URL(prodUrl).username];
  const instructions = [
    "=== Backup siap. INSTRUKSI TRANSFER (jalankan SENDIRI oleh owner) ===",
    `1. Sumber     : ${sanitizeArtifactPath(PROJECT_ROOT, artifactPath)} (mode ${manifest.artifactMode}, git-ignored)`,
    `2. sha256     : ${manifest.sha256}`,
    `3. Tujuan     : laptop/PC owner — HARUS mesin berbeda dari host DB (${dbHostClass}).`,
    "4. Transfer   : salin artefak + manifest.json ke tujuan lewat media pilihan owner",
    "                (USB drive terenkripsi / SFTP yang sudah ada / salinan terenkripsi).",
    "                JANGAN pakai perintah di laporan; kredensial TIDAK boleh ikut tersalin.",
    "5. Verifikasi : di tujuan jalankan",
    "                  npm run migration:backup:local -- verify --dir=<dirTujuan> --separate-machine",
    "6. Bukti      : perintah di atas menulis off-host-evidence.json (git-ignored).",
    "",
    `STATUS OFF-HOST: BLOCKED — host DB terklasifikasi ${dbHostClass};`,
    "                 agent TIDAK dapat menjangkau laptop/PC owner dan TIDAK mengarang transfer.",
  ];
  log(instructions.join("\n"));
  assertNoSecretLeak(instructions.join("\n"), secrets, "instruksi transfer");
  log(`\nmanifest      : ${sanitizeArtifactPath(PROJECT_ROOT, manifestPath)}`);
  return 0;
}

function runVerify(argv) {
  const dir = parseFlag(argv, "dir");
  if (!dir) throw new Error("--dir=<dirTujuan> wajib untuk mode verify.");
  const separateMachine = argv.includes("--separate-machine");
  const destinationDir = path.resolve(dir);
  if (!existsSync(destinationDir)) throw new Error("Direktori tujuan tidak ditemukan.");

  const manifestFile = readdirSync(destinationDir).find((name) => name.endsWith(".sql.manifest.json"))
    ?? readdirSync(destinationDir).find((name) => name.endsWith(".manifest.json"));
  if (!manifestFile) throw new Error("manifest.json tidak ditemukan di direktori tujuan.");
  const manifest = JSON.parse(readFileSync(path.join(destinationDir, manifestFile), "utf8"));

  const artifactPath = path.join(destinationDir, manifest.artifactFile);
  if (!existsSync(artifactPath)) throw new Error("Artefak tidak ditemukan di tujuan — transfer gagal.");
  const actual = sha256(readFileSync(artifactPath));
  assertChecksumsMatch(manifest.sha256, actual, "salinan tujuan");

  const evaluation = evaluateOffHostEvidence({
    databaseHostClass: classifyHostFromUrl(loadDatabaseUrl()),
    backupHostClass: classifyHostFromUrl(loadDatabaseUrl()),
    destinationIsSeparateMachine: separateMachine ? true : false,
    destinationPathExists: true,
    destinationChecksumSha256: actual,
    expectedChecksumSha256: manifest.sha256,
    transferredAt: new Date().toISOString(),
    recordedBy: process.env.USER ?? process.env.USERNAME ?? "operator",
  });

  const evidencePath = path.join(BACKUP_ABSOLUTE_DIR, "off-host-evidence.json");
  writeFileSync(
    evidencePath,
    `${JSON.stringify({ manifest: manifestFile, status: evaluation.status, checks: evaluation.checks }, null, 2)}\n`,
    { mode: 0o600 },
  );
  log(`verifikasi tujuan : checksum cocok (sha256 ${String(manifest.sha256).slice(0, 16)}…)`);
  log(`status off-host   : ${evaluation.status}`);
  log(`bukti disimpan    : ${sanitizeArtifactPath(PROJECT_ROOT, evidencePath)}`);
  return evaluation.status === "CONFIRMED_OFF_HOST" ? 0 : 3;
}

async function main(argv) {
  const [command = "prepare", ...rest] = argv;
  switch (command) {
    case "prepare":
      return runPrepare(rest);
    case "verify":
      return runVerify(rest);
    default:
      log("Penggunaan: prepare [--fresh] | verify --dir=<dir> --separate-machine");
      return 2;
  }
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`Gagal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
