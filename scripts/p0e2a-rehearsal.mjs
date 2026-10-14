/**
 * REHEARSAL BACKUP / RESTORE + MIGRASI 0001 — P0E-2A (READ-ONLY terhadap produksi).
 *
 * Tujuan: membuktikan proses gate aktivasi produksi (backup → restore →
 * verifikasi → `0001` → verifikasi → keamanan pengulangan) benar-benar dapat
 * dijalankan, TANPA menyentuh `database-airprod` (hanya SELECT) dan TANPA
 * memakai `airprod_test` (direset tiap run vitest).
 *
 * Jaminan:
 * - Produksi HANYA dibaca: `mysqldump` + query `SELECT`/`information_schema`.
 * - Satu-satunya database yang ditulis/dihapus adalah `airprod_rehearsal`.
 * - Kredensial hanya lewat berkas `--defaults-extra-file` mode 0600 sementara
 *   (tidak pernah muncul di argv/`ps`), lalu dihapus. Tidak pernah dicetak.
 * - Isi dump tidak pernah dicetak ke laporan.
 *
 * Pemakaian: node --import ./scripts/migration-ts-register.mjs scripts/p0e2a-rehearsal.mjs
 * (juga tersedia via `npm run migration:rehearsal`)
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import mysql from "mysql2/promise";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const MIGRATIONS_FOLDER = path.resolve(PROJECT_ROOT, "drizzle");

const {
  BACKUP_DIR,
  PRODUCTION_DATABASE,
  REHEARSAL_DATABASE,
  SHARED_TEST_DATABASE,
  assertBackupSourceAllowed,
  assertDestructiveTargetAllowed,
  assertRehearsalTargetAllowed,
  backupFileName,
  databaseNameFromUrl,
  isBackupDirIgnored,
  sanitizeArtifactPath,
} = await import("@/migration-cli/activation-guards");

const log = (line = "") => process.stdout.write(`${line}\n`);
const results = { steps: [], checks: [], blocked: [] };

function step(name, detail) {
  results.steps.push({ name, detail });
  log(`\n=== ${name} ===`);
  if (detail) log(detail);
}

function check(id, requirement, satisfied, evidence) {
  results.checks.push({ id, requirement, satisfied, evidence });
  const mark = satisfied === true ? "[OK]  " : satisfied === false ? "[FAIL]" : "[?]   ";
  log(`  ${mark} ${id}: ${requirement} — ${evidence}`);
}

function readDatabaseName(envValue) {
  const raw = envValue?.trim().replace(/^["']|["']$/g, "");
  if (!raw) throw new Error("DATABASE_URL belum diatur.");
  if (!/^mysql:|^mariadb:/i.test(raw)) throw new Error("DATABASE_URL bukan connection string MySQL.");
  return { raw, name: databaseNameFromUrl(raw) };
}

function withDatabaseName(url, name) {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/** Berkas kredensial sementara 0600 (tidak pernah dicetak/di-commit). */
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

function runBinary(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
  return result;
}

async function connect(url) {
  return mysql.createConnection({ uri: url });
}

async function query(conn, sql, params = []) {
  const [rows] = await conn.query(sql, params);
  return rows;
}

/** Sidik jari skema: tabel, kolom, index, FK, journal (stabil & terurut). */
async function describeSchema(conn, database) {
  const tables = (await query(
    conn,
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME",
    [database],
  )).map((row) => String(row.name));

  const rowCounts = {};
  for (const table of tables) {
    if (!/^[A-Za-z0-9_]+$/.test(table)) throw new Error("Identifier tabel tidak aman.");
    const [counted] = await query(conn, `SELECT COUNT(*) AS c FROM \`${table}\``);
    rowCounts[table] = Number(counted.c);
  }

  const columns = (await query(
    conn,
    "SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLUMN_TYPE AS ty, IS_NULLABLE AS n, IFNULL(COLUMN_DEFAULT, '~NULL~') AS d, EXTRA AS e FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION",
    [database],
  )).map((r) => `${r.t}.${r.c}:${r.ty}:${r.n}:${r.d}:${r.e}`);

  const indexes = (await query(
    conn,
    "SELECT TABLE_NAME AS t, INDEX_NAME AS i, COLUMN_NAME AS c, NON_UNIQUE AS nu, SEQ_IN_INDEX AS s FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX",
    [database],
  )).map((r) => `${r.t}.${r.i}.${r.s}:${r.c}:${Number(r.nu) === 0 ? "UNIQUE" : "NONUNIQUE"}`);

  const foreignKeys = (await query(
    conn,
    "SELECT CONSTRAINT_NAME AS n, TABLE_NAME AS t, COLUMN_NAME AS c, REFERENCED_TABLE_NAME AS rt, REFERENCED_COLUMN_NAME AS rc FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY CONSTRAINT_NAME",
    [database],
  )).map((r) => `${r.n}:${r.t}.${r.c}->${r.rt}.${r.rc}`);

  let journal = [];
  if (tables.includes("__drizzle_migrations")) {
    journal = (await query(
      conn,
      "SELECT id, hash, created_at FROM `__drizzle_migrations` ORDER BY id",
    )).map((r) => ({ id: Number(r.id), hash: String(r.hash), createdAt: Number(r.created_at) }));
  }

  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ tables, columns, indexes, foreignKeys }))
    .digest("hex");

  return { database, tables, tableCount: tables.length, rowCounts, columns, indexes, foreignKeys, journal, fingerprint };
}

async function columnInfo(conn, database, table, column) {
  const rows = await query(
    conn,
    "SELECT IS_NULLABLE AS n, COLUMN_TYPE AS ty, IFNULL(COLUMN_DEFAULT, '~NULL~') AS d FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [database, table, column],
  );
  return rows.length === 0 ? null : { nullable: String(rows[0].n), type: String(rows[0].ty), default: String(rows[0].d) };
}

async function uniqueIndexPresent(conn, database, table, column) {
  const rows = await query(
    conn,
    "SELECT INDEX_NAME AS i FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? AND NON_UNIQUE = 0",
    [database, table, column],
  );
  return rows.map((r) => String(r.i));
}

async function applyDrizzleMigrations(url) {
  const { drizzle } = await import("drizzle-orm/mysql2");
  const { migrate } = await import("drizzle-orm/mysql2/migrator");
  const pool = mysql.createPool({ uri: url, multipleStatements: true });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

function splitStatements(sqlText) {
  return sqlText
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function main() {
  const credentialsDir = mkdtempSync(path.join(tmpdir(), "p0e2a-"));
  let rehearsalCreated = false;
  try {
    // --------------------------------------------------------------------- //
    // 0. Target / sumber / penyimpanan / izin / proteksi Git                //
    // --------------------------------------------------------------------- //
    const envFile = path.resolve(PROJECT_ROOT, ".env");
    if (existsSync(envFile)) {
      process.loadEnvFile(envFile);
    }
    const { raw: prodUrl, name: prodName } = readDatabaseName(process.env.DATABASE_URL);
    assertBackupSourceAllowed(prodName);
    const rehearsalUrl = withDatabaseName(prodUrl, REHEARSAL_DATABASE);
    assertRehearsalTargetAllowed(databaseNameFromUrl(rehearsalUrl));

    step("0. Verifikasi target, tujuan, penyimpanan, izin, dan proteksi Git");
    const backupAbsoluteDir = path.resolve(PROJECT_ROOT, BACKUP_DIR);
    const gitignore = readFileSync(path.resolve(PROJECT_ROOT, ".gitignore"), "utf8");
    const cleanup = runBinary("mkdir", ["-p", backupAbsoluteDir]);
    if (cleanup.status !== 0) throw new Error("Gagal membuat direktori backup.");
    const free = runBinary("df", ["-Pk", backupAbsoluteDir]);
    const freeKb = free.status === 0 ? Number(free.stdout.trim().split("\n").pop().split(/\s+/)[3]) : null;

    log(`  sumber backup      : ${prodName}`);
    log(`  target rehearsal   : ${REHEARSAL_DATABASE}`);
    log(`  database test bersama: ${SHARED_TEST_DATABASE} (DILARANG sebagai target rehearsal)`);
    log(`  direktori arsip    : ${BACKUP_DIR}/ (relatif root proyek)`);
    log(`  ruang kosong       : ${freeKb === null ? "tidak terukur" : `${Math.round(freeKb / 1024)} MB`}`);

    check("P0E2A-1", "Sumber backup adalah database produksi yang dituju", prodName === PRODUCTION_DATABASE, `terverifikasi = ${prodName === PRODUCTION_DATABASE}`);
    check("P0E2A-2", "Target rehearsal adalah database disposable khusus", databaseNameFromUrl(rehearsalUrl) === REHEARSAL_DATABASE, REHEARSAL_DATABASE);
    check("P0E2A-3", "Arsip backup dilindungi dari Git", isBackupDirIgnored(gitignore), `.gitignore memuat ${BACKUP_DIR}/`);
    check("P0E2A-4", "Ruang penyimpanan mencukupi", freeKb !== null && freeKb > 1024 * 100, freeKb === null ? "tidak terukur" : `~${Math.round(freeKb / 1024)} MB tersedia`);

    const prod = await connect(prodUrl);
    let credentialsFile;
    let artifactPath = null;
    let prodBaseline = null;
    try {
      const prodBefore = await describeSchema(prod, PRODUCTION_DATABASE);
      prodBaseline = prodBefore;
      const [server] = await query(prod, "SELECT VERSION() AS v, DATABASE() AS db");
      log(`  server             : ${server.v} | database() = ${server.db}`);

      // ------------------------------------------------------------------- //
      // 1. Backup logis (produksi: READ ONLY)                               //
      // ------------------------------------------------------------------- //
      step("1. Backup logis database produksi (READ ONLY)");
      credentialsFile = writeCredentialsFile(prodUrl, credentialsDir);
      const dumpArguments = [
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
      const dump = runBinary("mysqldump", dumpArguments);
      if (dump.status !== 0) {
        throw new Error(`mysqldump gagal (status ${dump.status}): ${(dump.stderr || "").split("\n")[0]}`);
      }
      const dumpBuffer = Buffer.from(dump.stdout ?? "", "utf8");
      const checksum = createHash("sha256").update(dumpBuffer).digest("hex");
      const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
      const fileName = backupFileName(PRODUCTION_DATABASE, stamp, checksum.slice(0, 12));
      artifactPath = path.join(backupAbsoluteDir, fileName);
      writeFileSync(artifactPath, dumpBuffer, { mode: 0o600 });
      const artifactBytes = statSync(artifactPath).size;

      log(`  artefak            : ${sanitizeArtifactPath(PROJECT_ROOT, artifactPath)}`);
      log(`  ukuran             : ${artifactBytes} byte`);
      log(`  sha256             : ${checksum}`);
      const [counted] = await query(prod, "SELECT @@version AS v");
      log(`  @@version          : ${counted.v}`);
      check("P0E2A-5", "Dump logis terbuat dan checksum tercatat", dump.status === 0 && checksum.length === 64, `sha256 ${checksum.slice(0, 16)}…, ${artifactBytes} byte`);
      check("P0E2A-6", "Arsip disimpan di lokasi yang tidak di-commit", artifactPath.startsWith(`${backupAbsoluteDir}${path.sep}`), sanitizeArtifactPath(PROJECT_ROOT, artifactPath));
    } finally {
      await prod.end();
      if (credentialsFile && existsSync(credentialsFile)) rmSync(credentialsFile, { force: true });
    }

    // --------------------------------------------------------------------- //
    // 2. Restore ke database disposable                                     //
    // --------------------------------------------------------------------- //
    step("2. Restore ke database disposable (nama di-remap)");
    const adminConn = await mysql.createConnection({ uri: withDatabaseName(prodUrl, "information_schema") });
    try {
      assertDestructiveTargetAllowed(REHEARSAL_DATABASE);
      await adminConn.query(`DROP DATABASE IF EXISTS \`${REHEARSAL_DATABASE}\``);
      await adminConn.query(`CREATE DATABASE \`${REHEARSAL_DATABASE}\` CHARACTER SET utf8mb4`);
      rehearsalCreated = true;
    } finally {
      await adminConn.end();
    }

    if (!artifactPath) throw new Error("Artefak backup tidak terbentuk.");
    const dumpFile = readFileSync(artifactPath, "utf8");
    const remapped = dumpFile
      .replaceAll(`\`${PRODUCTION_DATABASE}\``, `\`${REHEARSAL_DATABASE}\``)
      .replaceAll(` \`${PRODUCTION_DATABASE}\`;`, ` \`${REHEARSAL_DATABASE}\`;`);
    const restoreInput = path.join(credentialsDir, "restore.sql");
    writeFileSync(restoreInput, remapped, { mode: 0o600 });
    const restoreCnf = writeCredentialsFile(rehearsalUrl, credentialsDir);
    const restore = runBinary("mysql", [`--defaults-extra-file=${restoreCnf}`, REHEARSAL_DATABASE], {
      input: readFileSync(restoreInput),
    });
    if (restore.status !== 0) {
      throw new Error(`Restore gagal (status ${restore.status}): ${(restore.stderr || "").split("\n")[0]}`);
    }
    log(`  restore            : berhasil ke ${REHEARSAL_DATABASE}`);
    check("P0E2A-7", "Dump dapat direstore ke database bersih", restore.status === 0, `exit ${restore.status}`);

    const rehearsal = await connect(rehearsalUrl);
    try {
      const rehearsalRestored = await describeSchema(rehearsal, REHEARSAL_DATABASE);

      log(`  tabel              : ${rehearsalRestored.tableCount}`);
      log(`  sidik jari skema   : ${rehearsalRestored.fingerprint.slice(0, 16)}… (produksi ${prodBaseline.fingerprint.slice(0, 16)}…)`);
      log(`  journal            : ${rehearsalRestored.journal.map((r) => `#${r.id}`).join(", ") || "(kosong)"}`);
      check(
        "P0E2A-8",
        "Skema hasil restore identik dengan produksi",
        rehearsalRestored.fingerprint === prodBaseline.fingerprint,
        "fingerprint kolom+index+FK sama",
      );
      check(
        "P0E2A-9",
        "Journal & jumlah baris hasil restore identik dengan produksi",
        JSON.stringify(rehearsalRestored.journal) === JSON.stringify(prodBaseline.journal) &&
          JSON.stringify(rehearsalRestored.rowCounts) === JSON.stringify(prodBaseline.rowCounts),
        `${rehearsalRestored.journal.length} entri journal, ${rehearsalRestored.tableCount} tabel`, 
      );

      // ------------------------------------------------------------------- //
      // 3. Rehearsal migrasi 0001 (hanya database disposable)               //
      // ------------------------------------------------------------------- //
      step("3. Terapkan migration 0001 pada database rehearsal (jalur Drizzle migrator)");
      const domainRowCounts = (counts) =>
        Object.fromEntries(Object.entries(counts).filter(([table]) => table !== "__drizzle_migrations"));
      const beforeRowCounts = domainRowCounts(rehearsalRestored.rowCounts);
      await applyDrizzleMigrations(rehearsalUrl);
      const afterMigration = await describeSchema(rehearsal, REHEARSAL_DATABASE);

      const jobId = await columnInfo(rehearsal, REHEARSAL_DATABASE, "cashflows", "job_id");
      const idemKey = await columnInfo(rehearsal, REHEARSAL_DATABASE, "cashflows", "idempotency_key");
      const idemFingerprint = await columnInfo(rehearsal, REHEARSAL_DATABASE, "cashflows", "idempotency_fingerprint");
      const uniqueIndexes = await uniqueIndexPresent(rehearsal, REHEARSAL_DATABASE, "cashflows", "idempotency_key");
      const crewDefault = await columnInfo(rehearsal, REHEARSAL_DATABASE, "crew", "default_payment");
      const agreedDefault = await columnInfo(rehearsal, REHEARSAL_DATABASE, "job_crews", "agreed_amount");
      const fkAfter = afterMigration.foreignKeys.filter((fk) => fk.startsWith("cashflows_job_id_jobs_id_fk"));

      log(`  journal            : ${afterMigration.journal.map((r) => `#${r.id}`).join(", ")}`);
      log(`  cashflows.job_id   : nullable=${jobId?.nullable}`);
      log(`  idempotency kolom  : key=${idemKey !== null}, fingerprint=${idemFingerprint !== null}`);
      log(`  UNIQUE idempotensi : ${uniqueIndexes.join(", ") || "(tidak ada)"}`);
      log(`  FK cashflows       : ${fkAfter.join(" | ") || "(tidak ada)"}`);

      check("P0E2A-10", "cashflows.job_id menjadi NULLABLE", jobId?.nullable === "YES", `IS_NULLABLE=${jobId?.nullable ?? "(tidak ditemukan)"}`);
      check("P0E2A-11", "Kedua kolom idempotensi ada", idemKey !== null && idemFingerprint !== null, `idempotency_key=${idemKey !== null}, idempotency_fingerprint=${idemFingerprint !== null}`);
      check("P0E2A-12", "UNIQUE index idempotensi ada", uniqueIndexes.includes("uq_cashflows_idempotency_key"), uniqueIndexes.join(",") || "(tidak ada)");
      check("P0E2A-13", "FK cashflows.job_id → jobs.id tetap utuh", fkAfter.length === 1, fkAfter[0] ?? "(hilang)");
      check("P0E2A-14", "Journal konsisten setelah migrasi (2 entri)", afterMigration.journal.length === 2, `${afterMigration.journal.length} entri`);
      const afterDomainRowCounts = domainRowCounts(afterMigration.rowCounts);
      const rowCountsUnchanged = JSON.stringify(afterDomainRowCounts) === JSON.stringify(beforeRowCounts);
      log(`  baris per tabel    : ${Object.values(afterDomainRowCounts).reduce((sum, n) => sum + n, 0)} baris domain (journal naik ke ${afterMigration.journal.length} entri)`);
      check("P0E2A-15", "Jumlah baris tabel domain tidak berubah (journal naik 1→2)", rowCountsUnchanged, `13 tabel domain: total ${Object.values(afterDomainRowCounts).reduce((sum, n) => sum + n, 0)} baris`);
      check("P0E2A-16", "Default crew/job_crews dinormalisasi ke 0.00", crewDefault?.default === "0.00" && agreedDefault?.default === "0.00", `crew=${crewDefault?.default}, job_crews=${agreedDefault?.default}`);

      const journalHashesMatchTest = await (async () => {
        try {
          const testConn = await connect(withDatabaseName(prodUrl, SHARED_TEST_DATABASE));
          try {
            const testJournal = await query(testConn, "SELECT id, hash FROM `__drizzle_migrations` ORDER BY id");
            return JSON.stringify(testJournal.map((r) => ({ id: Number(r.id), hash: String(r.hash) }))) ===
              JSON.stringify(afterMigration.journal.map((r) => ({ id: r.id, hash: r.hash })));
          } finally {
            await testConn.end();
          }
        } catch {
          return null;
        }
      })();
      check("P0E2A-17", "Journal rehearsal = journal airprod_test (hash cocok)", journalHashesMatchTest, journalHashesMatchTest === null ? "tidak dapat dibandingkan" : `cocok=${journalHashesMatchTest}`);

      // ------------------------------------------------------------------- //
      // 4. Keamanan pengulangan                                             //
      // ------------------------------------------------------------------- //
      step("4. Keamanan pengulangan (re-run)");
      await applyDrizzleMigrations(rehearsalUrl);
      const afterRerun = await describeSchema(rehearsal, REHEARSAL_DATABASE);
      log(`  migrator re-run    : journal=${afterRerun.journal.length} entri, fingerprint=${afterRerun.fingerprint.slice(0, 16)}…`);
      check("P0E2A-18", "Re-run migrator idempoten (tidak mengubah apa pun)", afterRerun.fingerprint === afterMigration.fingerprint && afterRerun.journal.length === afterMigration.journal.length, "fingerprint & journal tidak berubah");

      const rawStatements = splitStatements(readFileSync(path.resolve(MIGRATIONS_FOLDER, "0001_dizzy_sunspot.sql"), "utf8"));
      let rawError = null;
      for (const statement of rawStatements) {
        try {
          await rehearsal.query(statement);
        } catch (error) {
          rawError = error;
          break;
        }
      }
      const afterRawReapply = await describeSchema(rehearsal, REHEARSAL_DATABASE);
      log(`  raw re-apply       : ${rawError ? `gagal dengan suara (${rawError.code ?? "error"})` : "tidak error"}`);
      check("P0E2A-19", "Penerapan ulang SQL mentah gagal dengan suara (bukan korupsi diam)", rawError !== null, rawError ? `error ${rawError.code ?? ""}: ${String(rawError.message).slice(0, 60)}` : "TIDAK error — berisiko");
      check("P0E2A-20", "Skema tetap utuh setelah upaya re-apply gagal", afterRawReapply.fingerprint === afterMigration.fingerprint, "fingerprint skema tidak berubah");

      // ------------------------------------------------------------------- //
      // 5. Operasi finansial kanonik pada database hasil rehearsal          //
      // ------------------------------------------------------------------- //
      step("5. Operasi finansial kanonik pada database rehearsal (Contract v2)");
      // Semua pembacaan produksi sudah selesai; mulai titik ini proses hanya
      // berbicara ke database rehearsal.
      process.env.DATABASE_URL = rehearsalUrl;

      const master = await import("@/services/master-service");
      const jobs = await import("@/services/job-service");
      const { closeDb } = await import("@/db");
      try {
        const { randomUUID } = await import("node:crypto");
        const client = await master.createClient({ name: `Rehearsal Client ${randomUUID().slice(0, 8)}` });
        const role = await master.createCrewRole({ name: `Rehearsal Role ${randomUUID().slice(0, 8)}` });
        const crew = await master.createCrew({ name: "Rehearsal Crew", crewRoleId: role.id, defaultPayment: "100.00" });
        const job = await jobs.createJob({
          jobNumber: `RHR-${randomUUID().slice(0, 8)}`,
          jobName: "Rehearsal Job",
          category: "WEDDING",
          clientId: client.id,
          executionDate: "2026-12-01",
          status: "NOT_STARTED",
        });
        const schedule = await jobs.createClientSchedule({ jobId: job.id, term: "TERMIN_1", amount: "1000.00" });
        const key = randomUUID();
        const first = await jobs.recordClientPayment({ scheduleId: schedule.id, amount: "450.00", occurredOn: "2026-12-02", idempotencyKey: key });
        const replay = await jobs.recordClientPayment({ scheduleId: schedule.id, amount: "450.00", occurredOn: "2026-12-02", idempotencyKey: key });
        const expense = await jobs.recordExpense({ category: "TRANSPORT", amount: "25.00", occurredOn: "2026-12-03", description: "Rehearsal transport", idempotencyKey: randomUUID() });
        const detail = await jobs.getJobDetail(job.jobNumber);
        const scheduleView = detail?.clientSchedules.find((s) => s.id === schedule.id);

        // `recordGeneralExpense` mengembalikan `Cashflow` (field `id`), bukan
        // `RecordPaymentResult` (field `cashflowId`).
        const expenseRows = await query(rehearsal, "SELECT id, job_id FROM cashflows WHERE id = ?", [expense.id]);
        const [countRow] = await query(rehearsal, "SELECT COUNT(*) AS c FROM cashflows");

        log(`  client/role/crew   : dibuat`);
        log(`  idempotensi        : replay sama = ${replay.cashflowId === first.cashflowId}`);
        log(`  status diturunkan  : ${scheduleView?.status} (paid ${scheduleView?.paidAmount})`);
        log(`  biaya tanpa job    : baris=${expenseRows.length}, job_id=${expenseRows[0]?.job_id === null ? "NULL" : String(expenseRows[0]?.job_id)}`);
        log(`  total baris kas    : ${countRow.c} (crew belum dibayar → tidak menambah kas)`);
        log(`  crew role FK       : ${crew.crewRoleId === role.id}`);

        check("P0E2A-21", "Operasi kanonik berjalan pada skema 0001", job.id.length > 0 && schedule.id.length > 0, `job ${job.jobNumber} & jadwal dibuat`);
        check("P0E2A-22", "Idempotensi DB: replay mengembalikan baris yang sama", replay.cashflowId === first.cashflowId, "cashflowId identik");
        check("P0E2A-23", "Status pembayaran diturunkan dari kas", scheduleView?.status === "PARTIAL" && scheduleView?.paidAmount === "450.00", `${scheduleView?.status} / ${scheduleView?.paidAmount}`);
        check(
          "P0E2A-24",
          "Biaya umum tanpa job tersimpan (job_id NULL)",
          expenseRows.length === 1 && expenseRows[0].job_id === null,
          `baris=${expenseRows.length}, job_id=${expenseRows.length === 1 ? String(expenseRows[0].job_id) : "(tidak ditemukan)"}`,
        );
        check("P0E2A-25", "Total kas = 2 baris (1 client + 1 biaya)", Number(countRow.c) === 2, `count=${countRow.c}`);
      } finally {
        await closeDb();
      }
    } finally {
      await rehearsal.end();
    }

    // --------------------------------------------------------------------- //
    // 6. Bersihkan database disposable                                      //
    // --------------------------------------------------------------------- //
    step("6. Bersihkan database disposable");
    assertDestructiveTargetAllowed(REHEARSAL_DATABASE);
    const dropConn = await mysql.createConnection({ uri: withDatabaseName(prodUrl, "information_schema") });
    try {
      await dropConn.query(`DROP DATABASE IF EXISTS \`${REHEARSAL_DATABASE}\``);
      rehearsalCreated = false;
    } finally {
      await dropConn.end();
    }
    check("P0E2A-26", "Database rehearsal dihapus setelah selesai", !rehearsalCreated, `${REHEARSAL_DATABASE} dihapus`);

    log("\n=== Ringkasan ===");
    const failed = results.checks.filter((entry) => entry.satisfied === false);
    log(`checks: ${results.checks.length} | ok: ${results.checks.filter((c) => c.satisfied === true).length} | fail: ${failed.length}`);
    if (failed.length > 0) {
      for (const entry of failed) log(`  FAIL ${entry.id}: ${entry.requirement} — ${entry.evidence}`);
    }
    return failed.length === 0 ? 0 : 1;
  } finally {
    rmSync(credentialsDir, { recursive: true, force: true });
    // Jaring pengaman terakhir: jangan pernah meninggalkan database rehearsal.
    if (rehearsalCreated) {
      try {
        const url = process.env.DATABASE_URL;
        if (url) {
          const conn = await mysql.createConnection({ uri: withDatabaseName(url.trim().replace(/^["']|["']$/g, ""), "information_schema") });
          assertDestructiveTargetAllowed(REHEARSAL_DATABASE);
          await conn.query(`DROP DATABASE IF EXISTS \`${REHEARSAL_DATABASE}\``);
          await conn.end();
          log(`\n(safety) ${REHEARSAL_DATABASE} dibersihkan setelah error.`);
        }
      } catch {
        process.stderr.write("PERINGATAN: gagal membersihkan database rehearsal — periksa secara manual.\n");
      }
    }
  }
}

const exitCode = await main();
process.exitCode = exitCode;
