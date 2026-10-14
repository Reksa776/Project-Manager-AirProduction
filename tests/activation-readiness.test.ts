import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BACKUP_DIR,
  GuardViolationError,
  PRODUCTION_DATABASE,
  REHEARSAL_DATABASE,
  SHARED_TEST_DATABASE,
  assertBackupSourceAllowed,
  assertDestructiveTargetAllowed,
  assertRehearsalTargetAllowed,
  backupFileName,
  databaseNameFromUrl,
  isBackupDirIgnored,
  isProtectedDatabase,
  sanitizeArtifactPath,
} from "@/migration-cli/activation-guards";
import { assertPreflightDatabaseAllowed } from "@/migration-cli/preflight";

/**
 * P0E-2A — KESIAPAN AKTIVASI & REHEARSAL.
 *
 * Test ini sengaja TIDAK menyentuh database apa pun: yang diuji adalah logika
 * gerbang keselamatan (gagal tertutup) dan invarian statis migration `0001`.
 * Rehearsal backup/restore yang sesungguhnya dijalankan lewat
 * `npm run migration:rehearsal` terhadap database disposable.
 */

const projectRoot = process.cwd();

describe("gerbang keselamatan rehearsal (fail-closed)", () => {
  it("sumber backup hanya boleh database produksi", () => {
    expect(() => assertBackupSourceAllowed(PRODUCTION_DATABASE)).not.toThrow();
    for (const other of [SHARED_TEST_DATABASE, REHEARSAL_DATABASE, "unknown_db", ""]) {
      expect(() => assertBackupSourceAllowed(other)).toThrow(GuardViolationError);
    }
  });

  it("target rehearsal hanya boleh database disposable khusus", () => {
    expect(() => assertRehearsalTargetAllowed(REHEARSAL_DATABASE)).not.toThrow();
    expect(() => assertRehearsalTargetAllowed(PRODUCTION_DATABASE)).toThrow(/produksi/i);
    expect(() => assertRehearsalTargetAllowed(SHARED_TEST_DATABASE)).toThrow(/reset/i);
    expect(() => assertRehearsalTargetAllowed("airprod")).toThrow(GuardViolationError);
  });

  it("DROP DATABASE hanya diizinkan untuk database rehearsal", () => {
    expect(() => assertDestructiveTargetAllowed(REHEARSAL_DATABASE)).not.toThrow();
    expect(() => assertDestructiveTargetAllowed(PRODUCTION_DATABASE)).toThrow(GuardViolationError);
    expect(() => assertDestructiveTargetAllowed(SHARED_TEST_DATABASE)).toThrow(GuardViolationError);
  });

  it("preflight hanya boleh menargetkan produksi (tidak boleh test/rehearsal)", () => {
    expect(() => assertPreflightDatabaseAllowed(PRODUCTION_DATABASE)).not.toThrow();
    expect(() => assertPreflightDatabaseAllowed(SHARED_TEST_DATABASE)).toThrow();
    expect(() => assertPreflightDatabaseAllowed(REHEARSAL_DATABASE)).toThrow();
  });

  it("produksi dan database test bersama sama-sama dilindungi", () => {
    expect(isProtectedDatabase(PRODUCTION_DATABASE)).toBe(true);
    expect(isProtectedDatabase(SHARED_TEST_DATABASE)).toBe(true);
    expect(isProtectedDatabase(REHEARSAL_DATABASE)).toBe(false);
  });

  it("nama database diekstrak dari URL tanpa pernah mencetak kredensial", () => {
    const url = "mysql://user:s3cret@db.example.com:3306/database-airprod";
    const name = databaseNameFromUrl(url);
    expect(name).toBe(PRODUCTION_DATABASE);
    expect(() => assertBackupSourceAllowed(name)).not.toThrow();
    // Guard tidak boleh memuat kredensial pada pesan error.
    try {
      assertBackupSourceAllowed("airprod_test");
      throw new Error("seharusnya melempar");
    } catch (error) {
      expect(String((error as Error).message)).not.toContain("s3cret");
    }
  });
});

describe("proteksi artefak backup", () => {
  it("direktori arsip backup benar-benar di-ignore oleh .gitignore proyek", () => {
    const gitignore = readFileSync(path.resolve(projectRoot, ".gitignore"), "utf8");
    expect(isBackupDirIgnored(gitignore)).toBe(true);
  });

  it("deteksi ignore tahan terhadap komentar dan baris kosong", () => {
    expect(isBackupDirIgnored(`# komentar\n\n${BACKUP_DIR}/\n`)).toBe(true);
    expect(isBackupDirIgnored(`# ${BACKUP_DIR}/`)).toBe(false);
    expect(isBackupDirIgnored("")).toBe(false);
  });

  it("nama berkas dump menolak nama database yang tidak aman", () => {
    expect(backupFileName("database-airprod", "20261014", "abcdef123456")).toBe(
      "database-airprod-20261014-abcdef123456.sql",
    );
    expect(() => backupFileName("db; DROP", "20261014", "abcdef")).toThrow(GuardViolationError);
  });

  it("path artefak dilaporkan relatif (tanpa home directory absolut)", () => {
    const rel = sanitizeArtifactPath(projectRoot, path.resolve(projectRoot, BACKUP_DIR, "dump.sql"));
    expect(rel).toBe(`${BACKUP_DIR}/dump.sql`);
    expect(sanitizeArtifactPath(projectRoot, "/var/backups/dump.sql")).toBe("<external>/dump.sql");
  });
});

describe("invarian statis migration 0001 & journal", () => {
  const migrationSql = readFileSync(
    path.resolve(projectRoot, "drizzle", "0001_dizzy_sunspot.sql"),
    "utf8",
  );
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  it("0001 hanya berisi ALTER TABLE aditif (tanpa DROP/DELETE/TRUNCATE/UPDATE)", () => {
    expect(statements).toHaveLength(6);
    for (const statement of statements) {
      expect(statement.startsWith("ALTER TABLE")).toBe(true);
      expect(/\b(drop|delete|truncate|update|insert|replace)\b/i.test(statement)).toBe(false);
    }
  });

  it("0001 berisi perubahan skema yang diwajibkan kontrak kanonik", () => {
    const joined = statements.join("\n");
    expect(joined).toMatch(/MODIFY COLUMN `job_id` varchar\(36\)/);
    expect(joined).toContain("ADD `idempotency_key` varchar(190)");
    expect(joined).toContain("ADD `idempotency_fingerprint` char(64)");
    expect(joined).toContain("uq_cashflows_idempotency_key` UNIQUE(`idempotency_key`)");
    expect(joined).toContain("`crew` MODIFY COLUMN `default_payment` decimal(15,2) NOT NULL DEFAULT '0.00'");
    expect(joined).toContain("`job_crews` MODIFY COLUMN `agreed_amount` decimal(15,2) NOT NULL DEFAULT '0.00'");
  });

  it("journal Drizzle memuat tepat 0000 dan 0001 dengan urutan benar", () => {
    const journal = JSON.parse(
      readFileSync(path.resolve(projectRoot, "drizzle", "meta", "_journal.json"), "utf8"),
    ) as { entries: Array<{ idx: number; tag: string; breakpoints: boolean }> };
    expect(journal.entries.map((entry) => entry.tag)).toEqual([
      "0000_magical_true_believers",
      "0001_dizzy_sunspot",
    ]);
    expect(journal.entries.map((entry) => entry.idx)).toEqual([0, 1]);
    expect(journal.entries.every((entry) => entry.breakpoints === true)).toBe(true);
  });

  it("rehearsal tersedia sebagai perintah yang terdaftar dan berkasnya ada", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(projectRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["migration:rehearsal"]).toContain("scripts/p0e2a-rehearsal.mjs");
    expect(existsSync(path.resolve(projectRoot, "scripts", "p0e2a-rehearsal.mjs"))).toBe(true);
  });

  it("jalur migrasi produksi memakai migrator Drizzle (bukan SQL yang ditulis tangan)", () => {
    const script = readFileSync(
      path.resolve(projectRoot, "scripts", "p0e2a-rehearsal.mjs"),
      "utf8",
    );
    expect(script).toContain("drizzle-orm/mysql2/migrator");
    expect(script).toContain("migrationsFolder");
    expect(script).toContain("assertDestructiveTargetAllowed");
    expect(script).toContain("assertBackupSourceAllowed");
  });
});
