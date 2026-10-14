import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  GuardViolationError,
  PRODUCTION_DATABASE,
  REHEARSAL_DATABASE,
  SHARED_TEST_DATABASE,
  assertActivationApprovals,
  assertArtifactPathInsideBackupDir,
  assertBackupSourceAllowed,
  assertChecksumsMatch,
  assertNoSecretLeak,
  assertOffHostConfirmed,
  assertRehearsalTargetAllowed,
  checksumsMatch,
  classifyHost,
  classifyHostFromUrl,
  deriveBackupAcceptanceState,
  evaluateOffHostEvidence,
  findSecretLeaks,
  isSafeArtifactName,
  isSha256,
  validateActivationApprovals,
  validateBackupManifest,
  type BackupManifest,
  type OffHostEvidence,
} from "@/migration-cli/activation-guards";
import {
  buildActivationReadinessChecklist,
  type ActivationEvidence,
} from "@/migration-cli/activation-checklist";
import type { PreflightReport } from "@/migration-cli/preflight";

/**
 * P0E-2A.1 — HARDENING GERBANG AKTIVASI. Semua test TIDAK menyentuh database;
 * yang diuji adalah logika gagal-tertutup dan penanganan bukti.
 */

const VALID_SHA = "a".repeat(64);
const OTHER_SHA = "b".repeat(64);

const projectRoot = process.cwd();

describe("validasi target database (gagal-tertutup)", () => {
  it("sumber backup hanya boleh database produksi", () => {
    expect(() => assertBackupSourceAllowed(PRODUCTION_DATABASE)).not.toThrow();
    for (const other of [SHARED_TEST_DATABASE, REHEARSAL_DATABASE, "unknown", ""]) {
      expect(() => assertBackupSourceAllowed(other)).toThrow(GuardViolationError);
    }
  });

  it("target restore tidak aman selalu ditolak", () => {
    expect(() => assertRehearsalTargetAllowed(REHEARSAL_DATABASE)).not.toThrow();
    expect(() => assertRehearsalTargetAllowed(PRODUCTION_DATABASE)).toThrow(/produksi/i);
    expect(() => assertRehearsalTargetAllowed(SHARED_TEST_DATABASE)).toThrow(/reset/i);
    expect(() => assertRehearsalTargetAllowed("airprod")).toThrow(GuardViolationError);
  });

  it("klasifikasi host tidak mengembalikan alamat, hanya kategori", () => {
    expect(classifyHost("localhost")).toBe("LOOPBACK");
    expect(classifyHost("127.0.0.1")).toBe("LOOPBACK");
    expect(classifyHost("10.1.2.3")).toBe("PRIVATE_LAN");
    expect(classifyHost("192.168.0.9")).toBe("PRIVATE_LAN");
    expect(classifyHost("172.16.5.5")).toBe("PRIVATE_LAN");
    expect(classifyHost("db.example.com")).toBe("PUBLIC_OR_NAMED");
    expect(classifyHost("")).toBe("UNKNOWN");
    expect(classifyHostFromUrl("mysql://u:p@localhost:3306/database-airprod")).toBe("LOOPBACK");
  });
});

describe("validasi path & nama artefak backup", () => {
  it("hanya nama berkas .sql yang aman diterima", () => {
    expect(isSafeArtifactName("database-airprod-20261014-abcdef.sql")).toBe(true);
    expect(isSafeArtifactName("../escape.sql")).toBe(false);
    expect(isSafeArtifactName("dir/dump.sql")).toBe(false);
    expect(isSafeArtifactName("dump.txt")).toBe(false);
  });

  it("artefak harus berada di dalam direktori arsip proyek", () => {
    expect(() =>
      assertArtifactPathInsideBackupDir(projectRoot, path.resolve(projectRoot, ".migration-backups", "dump.sql")),
    ).not.toThrow();
    expect(() =>
      assertArtifactPathInsideBackupDir(projectRoot, path.resolve(projectRoot, "src", "dump.sql")),
    ).toThrow(GuardViolationError);
  });

  it("manifest valid diterima, manifest cacat ditolak", () => {
    const good: BackupManifest = {
      format: "p0e2a1-backup-manifest/1",
      database: PRODUCTION_DATABASE,
      artifactFile: "database-airprod-20261014-abcdef.sql",
      bytes: 18708,
      sha256: VALID_SHA,
      createdAt: "2026-10-14T03:32:23.000Z",
      serverVersion: "MariaDB 11.8.8",
      tableCount: 14,
      journalMaxId: 0,
      artifactMode: "0600",
      gitIgnored: true,
    };
    expect(validateBackupManifest(good)).toEqual([]);
    expect(validateBackupManifest({ ...good, database: SHARED_TEST_DATABASE })).toContain(
      `sumber manifest bukan '${PRODUCTION_DATABASE}'`,
    );
    expect(validateBackupManifest({ ...good, sha256: "nope" })).toContain("sha256 manifest tidak valid");
    expect(validateBackupManifest({ ...good, gitIgnored: false })).toContain(
      "artefak belum dikonfirmasi di-ignore Git",
    );
    expect(validateBackupManifest(null)).toContain("manifest tidak ada");
  });
});

describe("integritas checksum", () => {
  it("checksum cocok case-insensitive, tidak cocok bila berbeda", () => {
    expect(checksumsMatch(VALID_SHA, VALID_SHA.toUpperCase())).toBe(true);
    expect(checksumsMatch(VALID_SHA, OTHER_SHA)).toBe(false);
    expect(isSha256(VALID_SHA)).toBe(true);
    expect(isSha256("abc")).toBe(false);
  });

  it("checksum yang berbeda/hilang selalu ditolak", () => {
    expect(() => assertChecksumsMatch(VALID_SHA, VALID_SHA)).not.toThrow();
    expect(() => assertChecksumsMatch(VALID_SHA, OTHER_SHA)).toThrow(/TIDAK cocok/);
    expect(() => assertChecksumsMatch(VALID_SHA, null)).toThrow(/tidak lengkap/);
    expect(() => assertChecksumsMatch(null, VALID_SHA)).toThrow(/tidak lengkap/);
  });
});

const validOffHost: OffHostEvidence = {
  databaseHostClass: "LOOPBACK",
  backupHostClass: "LOOPBACK",
  destinationIsSeparateMachine: true,
  destinationPathExists: true,
  destinationChecksumSha256: VALID_SHA,
  expectedChecksumSha256: VALID_SHA,
  transferredAt: "2026-10-14T04:00:00.000Z",
  recordedBy: "owner",
};

describe("penanganan bukti off-host", () => {
  it("bukti lengkap + mesin terpisah → CONFIRMED_OFF_HOST", () => {
    const result = evaluateOffHostEvidence(validOffHost);
    expect(result.status).toBe("CONFIRMED_OFF_HOST");
    expect(() => assertOffHostConfirmed(result)).not.toThrow();
  });

  it("attestasi mesin sama → NOT_OFF_HOST dan dihentikan", () => {
    const result = evaluateOffHostEvidence({ ...validOffHost, destinationIsSeparateMachine: false });
    expect(result.status).toBe("NOT_OFF_HOST");
    expect(() => assertOffHostConfirmed(result)).toThrow(/BUKAN off-host/);
  });

  it("bukti hilang → UNVERIFIED (BLOCKED, bukan lolos)", () => {
    const result = evaluateOffHostEvidence({
      databaseHostClass: "LOOPBACK",
      backupHostClass: "LOOPBACK",
      destinationIsSeparateMachine: null,
      destinationPathExists: null,
      destinationChecksumSha256: null,
      expectedChecksumSha256: null,
      transferredAt: null,
      recordedBy: null,
    });
    expect(result.status).toBe("UNVERIFIED");
    expect(result.checks.some((check) => check.satisfied === null)).toBe(true);
    expect(() => assertOffHostConfirmed(result)).toThrow(/belum lengkap/);
  });

  it("checksum tujuan berbeda → UNVERIFIED walau mesin terpisah", () => {
    const result = evaluateOffHostEvidence({ ...validOffHost, destinationChecksumSha256: OTHER_SHA });
    expect(result.status).toBe("UNVERIFIED");
  });
});

describe("status penerimaan backup dibedakan", () => {
  it("checksum cocok SENDIRI bukan bukti restore berhasil", () => {
    expect(
      deriveBackupAcceptanceState({
        localBackupCreated: true,
        transferred: true,
        destinationChecksumVerified: true,
        offHostRestoreRehearsed: false,
      }),
    ).toBe("DESTINATION_CHECKSUM_VERIFIED");
    expect(
      deriveBackupAcceptanceState({
        localBackupCreated: true,
        transferred: false,
        destinationChecksumVerified: false,
        offHostRestoreRehearsed: false,
      }),
    ).toBe("LOCAL_BACKUP_CREATED");
    expect(
      deriveBackupAcceptanceState({
        localBackupCreated: true,
        transferred: true,
        destinationChecksumVerified: true,
        offHostRestoreRehearsed: true,
      }),
    ).toBe("OFF_HOST_RESTORE_REHEARSED");
  });
});

describe("gerbang persetujuan terpisah", () => {
  it("migrasi & aktivasi harus disetujui dengan rujukan tertulis", () => {
    expect(
      validateActivationApprovals({
        migrationApproval: true,
        activationApproval: true,
        migrationApprovalReference: "D-ACT-1/2026-10-20",
        activationApprovalReference: "D-ACT-2/2026-10-21",
      }),
    ).toEqual([]);

    const missingActivation = validateActivationApprovals({
      migrationApproval: true,
      activationApproval: false,
      migrationApprovalReference: "D-ACT-1/2026-10-20",
      activationApprovalReference: null,
    });
    expect(missingActivation).toContain("persetujuan aktivasi runtime belum diberikan");

    const noReference = validateActivationApprovals({
      migrationApproval: true,
      activationApproval: true,
      migrationApprovalReference: null,
      activationApprovalReference: null,
    });
    expect(noReference).toContain("persetujuan migrasi ada tetapi tanpa rujukan tertulis");
    expect(() =>
      assertActivationApprovals({
        migrationApproval: false,
        activationApproval: false,
        migrationApprovalReference: null,
        activationApprovalReference: null,
      }),
    ).toThrow(GuardViolationError);
  });
});

describe("tidak ada kebocoran rahasia", () => {
  it("deteksi kemunculan rahasia tanpa mencetak nilainya", () => {
    const url = "mysql://user:sup3rsecret@localhost:3306/database-airprod";
    expect(findSecretLeaks(`connection: ${url}`, ["sup3rsecret"])).toBe(true);
    expect(findSecretLeaks("laporan bersih tanpa rahasia", ["sup3rsecret"])).toBe(false);
    expect(findSecretLeaks("abaikan nilai pendek", ["ab"])).toBe(false);
    expect(() => assertNoSecretLeak("memuat sup3rsecret di sini", ["sup3rsecret"], "laporan")).toThrow(
      /rahasia/,
    );
  });
});

function preflight(overrides: Partial<PreflightReport> = {}): PreflightReport {
  return {
    database: PRODUCTION_DATABASE,
    tableCount: 14,
    tables: [],
    journal: [{ id: 1, hash: "h", createdAt: 0 }],
    cashflowsJobIdNullable: "NO",
    idempotencyColumnsPresent: { idempotencyKey: false, idempotencyFingerprint: false },
    uniqueIdempotencyIndexPresent: false,
    cashflowsForeignKeys: [],
    defaults: { crewDefaultPayment: "0.00", jobCrewsAgreedAmount: "0.00" },
    schemaDrift: [],
    plannedSourceCollisions: null,
    ...overrides,
  };
}

function fullEvidence(): ActivationEvidence {
  return {
    backup: {
      localBackupCreated: true,
      artifactExists: true,
      manifest: {
        format: "p0e2a1-backup-manifest/1",
        database: PRODUCTION_DATABASE,
        artifactFile: "database-airprod-20261014-abcdef.sql",
        bytes: 18708,
        sha256: VALID_SHA,
        createdAt: "2026-10-14T03:32:23.000Z",
        serverVersion: "MariaDB 11.8.8",
        tableCount: 14,
        journalMaxId: 0,
        artifactMode: "0600",
        gitIgnored: true,
      },
    },
    offHost: { ...validOffHost },
    transferred: true,
    destinationChecksumVerified: true,
    restoreRehearsal: {
      performed: true,
      databaseName: REHEARSAL_DATABASE,
      schemaFingerprintMatches: true,
      journalMatches: true,
      rowCountsMatch: true,
      restoredFromOffHostCopy: true,
    },
    maintenanceWindow: "2026-10-25 02:00-03:00 WIB",
    operator: "operator",
    rollbackOwner: "rollback-owner",
    approvals: {
      migrationApproval: true,
      activationApproval: true,
      migrationApprovalReference: "D-ACT-1",
      activationApprovalReference: "D-ACT-2",
    },
    runtime: {
      leastPrivilegeReviewed: true,
      dedicatedRuntimeAccountReady: true,
      publicExposureRestricted: true,
      authenticationImplemented: false,
    },
  };
}

describe("checklist aktivasi gagal-tertutup", () => {
  it("bukti kosong → NO-GO dengan blocker lengkap", () => {
    const empty: ActivationEvidence = {
      backup: { localBackupCreated: false, artifactExists: false, manifest: null },
      offHost: {
        databaseHostClass: "LOOPBACK",
        backupHostClass: "LOOPBACK",
        destinationIsSeparateMachine: null,
        destinationPathExists: null,
        destinationChecksumSha256: null,
        expectedChecksumSha256: null,
        transferredAt: null,
        recordedBy: null,
      },
      transferred: false,
      destinationChecksumVerified: false,
      restoreRehearsal: {
        performed: false,
        databaseName: null,
        schemaFingerprintMatches: null,
        journalMatches: null,
        rowCountsMatch: null,
        restoredFromOffHostCopy: null,
      },
      maintenanceWindow: null,
      operator: null,
      rollbackOwner: null,
      approvals: {
        migrationApproval: null,
        activationApproval: null,
        migrationApprovalReference: null,
        activationApprovalReference: null,
      },
      runtime: {
        leastPrivilegeReviewed: false,
        dedicatedRuntimeAccountReady: false,
        publicExposureRestricted: false,
        authenticationImplemented: false,
      },
    };
    const result = buildActivationReadinessChecklist(preflight(), empty);
    expect(result.verdict).toBe("NO-GO");
    expect(result.acceptanceState).toBe("NOT_STARTED");
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.items.every((entry) => entry.satisfied === true || entry.satisfied === false || entry.satisfied === null)).toBe(true);
  });

  it("bukti lengkap → GO", () => {
    const result = buildActivationReadinessChecklist(preflight(), fullEvidence());
    expect(result.verdict).toBe("GO");
    expect(result.acceptanceState).toBe("OFF_HOST_RESTORE_REHEARSED");
    expect(result.blockers).toEqual([]);
  });

  it("checksum tujuan berbeda → NO-GO (checksum mismatch)", () => {
    const evidence = fullEvidence();
    evidence.offHost = { ...evidence.offHost, destinationChecksumSha256: OTHER_SHA };
    const result = buildActivationReadinessChecklist(preflight(), evidence);
    expect(result.verdict).toBe("NO-GO");
    expect(result.items.find((entry) => entry.id === "P0E2B-9")?.satisfied).toBe(false);
  });

  it("restore ke target tidak diizinkan → NO-GO", () => {
    const evidence = fullEvidence();
    evidence.restoreRehearsal = { ...evidence.restoreRehearsal, databaseName: SHARED_TEST_DATABASE };
    const result = buildActivationReadinessChecklist(preflight(), evidence);
    expect(result.verdict).toBe("NO-GO");
    expect(result.items.find((entry) => entry.id === "P0E2B-12")?.satisfied).toBe(false);
  });

  it("journal produksi sudah 0001 (aktivasi tak sengaja) → NO-GO", () => {
    const result = buildActivationReadinessChecklist(
      preflight({
        journal: [
          { id: 1, hash: "h0", createdAt: 0 },
          { id: 2, hash: "h1", createdAt: 1 },
        ],
        cashflowsJobIdNullable: "YES",
      }),
      fullEvidence(),
    );
    expect(result.verdict).toBe("NO-GO");
    expect(result.items.find((entry) => entry.id === "P0E2B-2")?.satisfied).toBe(false);
    expect(result.items.find((entry) => entry.id === "P0E2B-3")?.satisfied).toBe(false);
  });
});

describe("kompatibilitas dengan tooling rehearsal", () => {
  it("perintah & berkas backup lokal P0E-2A.1 terdaftar dan ada", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(projectRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["migration:backup:local"]).toContain("scripts/p0e2a1-local-backup.mjs");
    expect(existsSync(path.resolve(projectRoot, "scripts", "p0e2a1-local-backup.mjs"))).toBe(true);
  });

  it("skrip backup lokal memakai guard bersama (bukan logika terpisah)", () => {
    const script = readFileSync(path.resolve(projectRoot, "scripts", "p0e2a1-local-backup.mjs"), "utf8");
    expect(script).toContain("@/migration-cli/activation-guards");
    expect(script).toContain("assertBackupSourceAllowed");
    expect(script).toContain("assertChecksumsMatch");
    expect(script).toContain("assertNoSecretLeak");
    expect(script).not.toMatch(/database-airprod-.*-.*-.*\.sql/);
  });
});
