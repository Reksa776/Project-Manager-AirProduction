import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SHEET_HEADERS, SHEET_TITLES, type SheetTitle } from "@/repositories/google/mapping";
import {
  assertApprovalsAreAuthorized,
  assertNoSensitiveData,
  blockingDecisions,
  buildDecisionRegister,
  buildSnapshot,
  collectSensitiveValues,
  compareSnapshots,
  DECISION_IDS,
  deserializeSnapshot,
  hashId,
  isDecisionApproved,
  isProvenDuplicate,
  migrationBlockers,
  opaqueRowRef,
  runSnapshotDryRun,
  sanitizeSnapshot,
  schemaFingerprint,
  serializeSnapshot,
  SENSITIVE_COLUMNS,
  SourceDataUnavailableError,
  totalAmounts,
  type RawWorksheetMatrix,
  type OwnerApproval,
  type ValidatedSnapshot,
} from "@/migration";
import {
  assertReadOnlySourceAccess,
  createReadOnlySheetsGateway,
  isReadOnlySourceConfigured,
  SHEETS_READONLY_SCOPE,
} from "@/migration-cli/read-only-sheets";
import {
  acquireAndPlanSnapshot,
  formatSanitizedSummary,
  rawSnapshotPath,
  RAW_SNAPSHOT_DIR,
} from "@/migration-cli/snapshot-runner";
import {
  assertPreflightDatabaseAllowed,
  assertReadOnlyQuery,
  assertSafeIdentifier,
  buildP0D2BReadinessChecklist,
  databaseNameFromUrl,
  type PreflightReport,
} from "@/migration-cli/preflight";
import {
  PROD_DATABASE,
  replaceDatabaseName,
  resolveTestDatabaseUrl,
  TEST_DATABASE,
} from "./helpers/db";

/**
 * Test P0D-2A — snapshot nyata & gate rekonsiliasi.
 *
 * SELURUH data di file ini adalah fixture SINTETIS. Tidak ada pembacaan Google
 * Sheets dan tidak ada penulisan MySQL. Nilai "pribadi" pada fixture hanya
 * dipakai untuk membuktikan sanitasi tidak membocorkannya.
 */

const ACQUIRED_AT = "2026-10-14T00:00:00.000Z";

const PRIVATE_VALUES = [
  "PT Rahasia Sentosa",
  "081234567890",
  "rahasia@example.com",
  "Jl. Rahasia No. 1",
  "Catatan internal klien",
  "Catatan keuangan",
  "Rahasia",
  "Wedding Rahasia",
];

/** Baris berisi nilai sensitif (untuk membuktikan sanitasi). */
const CLIENT_ROW = {
  id: "CLI-1",
  name: PRIVATE_VALUES[0]!,
  address: PRIVATE_VALUES[3]!,
  contact: PRIVATE_VALUES[1]!,
  notes: PRIVATE_VALUES[4]!,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
};

const CLIENT_ROW_2 = {
  id: "CLI-2",
  name: "Klien Dua",
  email: PRIVATE_VALUES[2]!,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
};

function matrix(sheet: SheetTitle, rows: Array<Record<string, string>>): RawWorksheetMatrix {
  const headers = SHEET_HEADERS[sheet];
  return {
    sheet,
    values: [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))],
  };
}

/** Fixture snapshot: 11 worksheet, dengan nilai sensitif dan satu baris janggal. */
function snapshotFixture(): RawWorksheetMatrix[] {
  return [
    matrix("clients", [CLIENT_ROW, CLIENT_ROW_2]),
    matrix("vendors", [{ id: "VND-1", name: "Vendor Satu", contact: "0812", notes: "", created_at: "", updated_at: "" }]),
    matrix("venues", [
      { id: "VNU-1", name: "Gedung Utama" },
      { id: "VNU-2", name: "Taman Kota" },
    ]),
    matrix("crew", [
      { id: "CRW-1", name: "Budi", role: "Videographer", contact: "0813", default_payment: "1500000.50", notes: "", created_at: "", updated_at: "" },
      { id: "CRW-2", name: "Sari", role: "Editor", contact: "0814", default_payment: "800000", notes: "", created_at: "", updated_at: "" },
    ]),
    matrix("jobs", [
      {
        id: "JOB-1",
        job_number: "JOB-2026-000001",
        client_id: "CLI-1",
        venue_id: "VNU-1",
        job_name: PRIVATE_VALUES[7]!,
        job_type: "WEDDING",
        execution_date: "2026-11-01",
        status: "NOT_STARTED",
        description: PRIVATE_VALUES[6]!,
      },
    ]),
    matrix("job_crews", [
      { id: "JC-1", job_id: "JOB-1", crew_id: "CRW-1", role: "Videographer", payment: "500000", payment_status: "UNPAID" },
    ]),
    matrix("deliveries", [
      { id: "DLV-1", job_id: "JOB-1", item_name: "Highlight", delivery_type: "VIDEO", quantity: "1", deadline: "2026-12-01", status: "NOT_STARTED" },
    ]),
    matrix("client_payments", [
      { id: "CP-1", job_id: "JOB-1", term: "TERMIN_1", amount: "1000.00", due_date: "2026-11-01", paid_date: "2026-11-01", status: "PAID" },
    ]),
    matrix("vendor_payments", [
      { id: "VP-1", job_id: "JOB-1", type: "DP", amount: "400.00", due_date: "2026-11-02", paid_date: "2026-11-02", status: "PAID" },
    ]),
    matrix("expenses", [
      { id: "EXP-1", job_id: "JOB-1", category: "TRANSPORT", description: "Bensin", amount: "75.50", expense_date: "2026-11-04" },
      { id: "EXP-2", job_id: "JOB-1", category: "CREW", description: "Bayar crew", amount: "500000", expense_date: "2026-11-05" },
      { id: "EXP-3", job_id: "", category: "TRANSPORT", description: "Operasional tanpa job", amount: "10.00", expense_date: "2026-11-06" },
      { id: "EXP-4", job_id: "JOB-1", category: "MISC", description: "Tidak jelas", amount: "7.00", expense_date: "2026-11-07" },
    ]),
    matrix("admins", [{ id: "ADM-1", name: "Admin", email: "admin@example.com", password_hash: "$2b$legacy" }]),
  ];
}

function snap(overrides?: {
  matrices?: RawWorksheetMatrix[];
  acquiredAt?: string;
}): ValidatedSnapshot {
  return buildSnapshot(overrides?.matrices ?? snapshotFixture(), {
    source: "fixture",
    acquiredAt: overrides?.acquiredAt ?? ACQUIRED_AT,
  });
}

function filesUnder(dir: string): string[] {
  const absolute = path.resolve(process.cwd(), dir);
  return readdirSync(absolute).flatMap((entry) => {
    const full = path.join(absolute, entry);
    if (statSync(full).isDirectory()) return filesUnder(path.join(dir, entry));
    return full.endsWith(".ts") ? [path.join(dir, entry)] : [];
  });
}

function readSource(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), "utf8");
}

/* -------------------------------------------------------------------------- */
/* 1. Validasi snapshot & provenance                                           */
/* -------------------------------------------------------------------------- */

describe("snapshot sumber: validasi & provenance", () => {
  it("membangun 11 worksheet dengan provenance (nomor baris, id sumber) dan fingerprint", () => {
    const snapshot = snap();
    expect(Object.keys(snapshot.sheets)).toHaveLength(SHEET_TITLES.length);
    expect(snapshot.issues).toEqual([]);

    const client = snapshot.sheets.clients.rows[0]!;
    expect(client.sheet).toBe("clients");
    expect(client.rowNumber).toBe(2);
    expect(client.sourceId).toBe("CLI-1");
    expect(client.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.sheets.clients.headerMatchesContract).toBe(true);
    expect(snapshot.totalRows).toBeGreaterThan(0);
  });

  it("reproducible: snapshot yang sama menghasilkan id, skema, dan fingerprint yang sama", () => {
    const first = snap();
    const second = snap();
    expect(second.snapshotId).toBe(first.snapshotId);
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.schemaFingerprint).toBe(first.schemaFingerprint);
    // Roundtrip serialisasi tidak mengubah identitas.
    const restored = deserializeSnapshot(serializeSnapshot(first));
    expect(restored.snapshotId).toBe(first.snapshotId);
  });

  it("fingerprint berubah bila satu nilai sumber berubah", () => {
    const changed = snapshotFixture();
    changed[3] = matrix("crew", [
      { id: "CRW-1", name: "Budi", role: "Videographer", contact: "0813", default_payment: "1500000.50" },
      { id: "CRW-2", name: "Sari", role: "Editor", contact: "0814", default_payment: "900000" },
    ]);
    const before = snap();
    const after = snap({ matrices: changed });
    expect(after.fingerprint).not.toBe(before.fingerprint);
    expect(after.schemaFingerprint).toBe(before.schemaFingerprint);
  });

  it("worksheet yang hilang dilaporkan (tidak diisi data karangan)", () => {
    const matrices = snapshotFixture().filter((entry) => entry.sheet !== "deliveries");
    const snapshot = snap({ matrices });
    expect(snapshot.sheets.deliveries.rowCount).toBe(0);
    expect(snapshot.issues.some((issue) => issue.code === "MISSING_WORKSHEET")).toBe(true);
    expect(snapshot.sheets.deliveries.issues[0]?.code).toBe("MISSING_WORKSHEET");
  });

  it("skema fingerprint bergantung pada header, bukan isi", () => {
    expect(schemaFingerprint({ clients: SHEET_HEADERS.clients })).toBe(
      schemaFingerprint({ clients: [...SHEET_HEADERS.clients] }),
    );
    expect(schemaFingerprint({ clients: SHEET_HEADERS.clients })).not.toBe(
      schemaFingerprint({ clients: SHEET_HEADERS.clients.slice(0, 2) }),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Header mismatch, baris malformed, id kosong & duplikat                    */
/* -------------------------------------------------------------------------- */

describe("snapshot sumber: penyimpangan dilaporkan, bukan diperbaiki", () => {
  it("header mismatch (kolom hilang/tambahan/urutan) terdeteksi", () => {
    const matrices = snapshotFixture().map((entry) =>
      entry.sheet === "clients"
        ? {
            sheet: entry.sheet,
            values: [
              ["id", "name", "address", "contact", "notes", "created_at", "kolom_baru"],
              ...entry.values.slice(1),
            ],
          }
        : entry,
    );
    const snapshot = snap({ matrices });
    const clients = snapshot.sheets.clients;
    expect(clients.headerMatchesContract).toBe(false);
    expect(clients.columnOrderMatches).toBe(false);
    expect(clients.missingColumns).toContain("updated_at");
    expect(clients.extraColumns).toEqual(["kolom_baru"]);
    expect(clients.issues.some((issue) => issue.code === "HEADER_MISMATCH")).toBe(true);
    expect(clients.issues.some((issue) => issue.code === "EXTRA_COLUMNS")).toBe(true);
    // Data tetap dilaporkan apa adanya (tidak "diperbaiki"): baris tidak diubah.
    expect(clients.rowCount).toBe(2);
    expect(clients.rows[0]?.values).toHaveLength(7);
    expect(clients.rows[0]?.values[0]).toBe("CLI-1");
  });

  it("baris malformed (jumlah sel tidak sama) dilaporkan", () => {
    const matrices = snapshotFixture().map((entry) =>
      entry.sheet === "crew"
        ? { sheet: entry.sheet, values: [entry.values[0]!, [...entry.values[1]!, "sel_ekstra"], entry.values[2]!] }
        : entry,
    );
    const snapshot = snap({ matrices });
    expect(snapshot.sheets.crew.malformedRowNumbers).toEqual([2]);
    expect(snapshot.sheets.crew.issues.some((issue) => issue.code === "MALFORMED_ROW")).toBe(true);
  });

  it("id sumber kosong dan id duplikat terdeteksi", () => {
    const matrices = snapshotFixture().map((entry) =>
      entry.sheet === "vendors"
        ? matrix("vendors", [
            { id: "", name: "Tanpa ID", contact: "0812" },
            { id: "VND-1", name: "Vendor Satu" },
            { id: "VND-1", name: "Vendor Satu (duplikat)" },
          ])
        : entry,
    );
    const snapshot = snap({ matrices });
    expect(snapshot.sheets.vendors.emptyIdRowNumbers).toEqual([2]);
    expect(snapshot.sheets.vendors.duplicateIds).toEqual([{ sourceId: "VND-1", rowNumbers: [3, 4] }]);
    const codes = snapshot.sheets.vendors.issues.map((issue) => issue.code);
    expect(codes).toContain("EMPTY_SOURCE_ID");
    expect(codes).toContain("DUPLICATE_SOURCE_ID");
  });

  it("baris kosong dilewati dan dicatat (bukan data)", () => {
    const matrices = snapshotFixture().map((entry) =>
      entry.sheet === "venues"
        ? { sheet: entry.sheet, values: [entry.values[0]!, ["", "", "", "", "", "", ""], entry.values[1]!] }
        : entry,
    );
    const snapshot = snap({ matrices });
    expect(snapshot.sheets.venues.skippedEmptyRows).toBe(1);
    expect(snapshot.sheets.venues.rowCount).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Deteksi perubahan antar-snapshot                                         */
/* -------------------------------------------------------------------------- */

describe("snapshot sumber: deteksi perubahan", () => {
  it("melaporkan baris baru, berubah, dan hilang berdasarkan identitas (sheet,id)", () => {
    const before = snap();
    const changedMatrices = snapshotFixture().map((entry) => {
      if (entry.sheet === "crew") {
        return matrix("crew", [
          { id: "CRW-1", name: "Budi", role: "Videographer", default_payment: "1750000.00" },
          { id: "CRW-3", name: "Crew Baru", role: "Editor", default_payment: "1" },
        ]);
      }
      return entry;
    });
    const after = snap({ matrices: changedMatrices });
    const comparison = compareSnapshots(before, after);
    expect(comparison.changedRows.map((row) => row.sourceId)).toEqual(["CRW-1"]);
    expect(comparison.newRows.map((row) => row.sourceId)).toEqual(["CRW-3"]);
    expect(comparison.disappearedRows.map((row) => row.sourceId)).toEqual(["CRW-2"]);
    expect(comparison.schemaChanged).toBe(false);
  });

  it("snapshot identik tidak melaporkan perubahan apa pun", () => {
    const comparison = compareSnapshots(snap(), snap());
    expect(comparison.newRows).toEqual([]);
    expect(comparison.changedRows).toEqual([]);
    expect(comparison.disappearedRows).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Sanitasi laporan                                                         */
/* -------------------------------------------------------------------------- */

describe("sanitasi laporan snapshot", () => {
  it("ringkasan tidak memuat nilai sensitif (nama, kontak, email, catatan)", () => {
    const snapshot = snap();
    const summary = sanitizeSnapshot(snapshot);
    const values = collectSensitiveValues(snapshot);
    expect(values.length).toBeGreaterThan(0);
    expect(() => assertNoSensitiveData(summary, values)).not.toThrow();
    const serialized = JSON.stringify(summary);
    for (const value of PRIVATE_VALUES) expect(serialized).not.toContain(value);
  });

  it("penjaga kebocoran melempar bila nilai sensitif muncul", () => {
    expect(() => assertNoSensitiveData({ note: PRIVATE_VALUES[0]! }, [PRIVATE_VALUES[0]!])).toThrow(
      /Kebocoran data sensitif/,
    );
  });

  it("hanya kolom terkendali (role/kategori/enum) yang nilainya dilaporkan", () => {
    const summary = sanitizeSnapshot(snap());
    const crew = summary.sheets.find((sheet) => sheet.sheet === "crew")!;
    expect(crew.safeDistinctValues.role).toEqual(["Editor", "Videographer"]);
    const clients = summary.sheets.find((sheet) => sheet.sheet === "clients")!;
    expect(clients.safeDistinctValues).toEqual({});
    expect(Object.keys(clients.distinctValueCounts)).toEqual([]);
    // Referensi id opaque (hash), bukan id mentah.
    expect(crew.duplicateIdGroups).toEqual([]);
    expect(opaqueRowRef("crew", 2, "CRW-1")).toBe(`crew#2(id:${hashId("CRW-1")})`);
    expect(opaqueRowRef("crew", 2, "CRW-1")).not.toContain("CRW-1");
  });

  it("teks ringkasan terminal juga bebas nilai sensitif", () => {
    const snapshot = snap();
    const text = formatSanitizedSummary(sanitizeSnapshot(snapshot));
    for (const value of PRIVATE_VALUES) expect(text).not.toContain(value);
    expect(text).toContain("writesPerformed   : false");
  });

  it("SENSITIVE_COLUMNS memuat kolom pribadi penting", () => {
    for (const column of ["name", "contact", "email", "phone", "address", "notes", "password_hash"]) {
      expect(SENSITIVE_COLUMNS).toContain(column);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Adapter read-only: fail closed & tanpa API tulis                         */
/* -------------------------------------------------------------------------- */

describe("adapter sumber read-only", () => {
  it("kredensial tidak ada → fail closed sebelum jaringan apa pun", async () => {
    const keys = ["GOOGLE_SHEETS_ID", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY"] as const;
    const saved = keys.map((key) => [key, process.env[key]] as const);
    for (const key of keys) delete process.env[key];
    try {
      expect(isReadOnlySourceConfigured()).toBe(false);
      expect(() => assertReadOnlySourceAccess()).toThrow(SourceDataUnavailableError);
      await expect(createReadOnlySheetsGateway().listWorksheetMatrices()).rejects.toThrow(
        SourceDataUnavailableError,
      );
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("gateway read-only hanya memakai API baca (values.batchGet) dengan scope read-only", () => {
    const source = readSource("src/migration-cli/read-only-sheets.ts");
    expect(source).toContain("spreadsheets.values.batchGet");
    expect(source).toContain(SHEETS_READONLY_SCOPE);
    // Komentar dibuang dulu: dokumentasi menyebut nama API tulis sebagai larangan.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    for (const token of [
      "values.update",
      "values.append",
      "values.clear",
      "values.batchUpdate",
      "batchUpdate(",
      ".append(",
      ".clear(",
      "getSheetsClient",
    ]) {
      expect(code.includes(token), `read-only-sheets.ts tidak boleh memakai '${token}'`).toBe(false);
    }
  });

  it("modul perencanaan migrasi tidak pernah mengimpor Google/DB maupun API tulis", () => {
    const files = filesUnder("src/migration");
    expect(files.length).toBeGreaterThan(8);
    const forbidden = [
      "@/lib/google-sheets",
      "@/repositories/index",
      "@/repositories/mysql",
      "@/repositories/google\"",
      "getRepositories",
      "@/db\"",
      "googleapis",
      "mysql2",
    ];
    for (const file of files) {
      const code = readSource(file)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      for (const token of forbidden) {
        expect(code.includes(token), `${file} tidak boleh memakai '${token}'`).toBe(false);
      }
    }
  });

  it("adapter tetap terpisah dari logika perencanaan", async () => {
    // Snapshot murni dapat dibangun tanpa adapter (tanpa kredensial/jaringan).
    const result = await acquireAndPlanSnapshot({
      gateway: {
        listWorksheetMatrices: async () => snapshotFixture(),
      },
      acquiredAt: ACQUIRED_AT,
      source: "fixture",
    });
    expect(result.writesPerformed).toBe(false);
    expect(result.snapshot.issues).toEqual([]);
    expect(result.summary.snapshotFingerprint).toBe(result.snapshot.fingerprint);
  });

  it("arsip snapshot mentah hanya ditulis ke direktori gitignored", () => {
    const gitignore = readSource(".gitignore");
    expect(gitignore).toContain(`${RAW_SNAPSHOT_DIR}/`);
    const target = rawSnapshotPath("a".repeat(64));
    expect(target.startsWith(`${RAW_SNAPSHOT_DIR}${path.sep}`)).toBe(true);
    expect(target).not.toMatch(/^src|^public|^docs/);
  });

  it("CLI tidak berjalan saat modul diimpor (entry point eksplisit)", () => {
    const source = readSource("src/migration-cli/cli.ts");
    expect(source).toContain("isDirectRun");
    expect(source).toMatch(/if \(isDirectRun\)/);
  });

  it("ketersediaan kredensial dilaporkan apa adanya (tanpa mengarang status)", () => {
    const configured = isReadOnlySourceConfigured();
    if (configured) expect(() => assertReadOnlySourceAccess()).not.toThrow();
    else expect(() => assertReadOnlySourceAccess()).toThrow(SourceDataUnavailableError);
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Dry-run dari snapshot tetap                                              */
/* -------------------------------------------------------------------------- */

describe("dry-run dari snapshot tetap", () => {
  const snapshot = snap();

  it("tidak menulis, memakai snapshot sebagai sumber tetap, dan menyertakan register keputusan", () => {
    const report = runSnapshotDryRun({ snapshot });
    expect(report.writesAttempted).toBe(false);
    expect(report.snapshotId).toBe(snapshot.snapshotId);
    expect(report.schemaFingerprint).toBe(snapshot.schemaFingerprint);
    expect(report.decisionRegister).toHaveLength(12);
    expect(report.plan.length).toBeGreaterThan(0);
  });

  it("baris tak terselesaikan tidak punya payload target yang dapat dieksekusi", () => {
    const report = runSnapshotDryRun({ snapshot });
    const unresolved = report.plan.filter((entry) => entry.status === "RECONCILIATION_REQUIRED");
    expect(unresolved.length).toBeGreaterThan(0);
    expect(unresolved.every((entry) => Object.keys(entry.values).length === 0)).toBe(true);
  });

  it("nominal expense yang sama dengan jadwal TIDAK dilewati dan tidak menjadi kas", () => {
    const report = runSnapshotDryRun({ snapshot });
    const expense = report.plan.find(
      (entry) => entry.source.sheet === "expenses" && entry.source.sourceId === "EXP-2",
    );
    expect(expense?.status).toBe("RECONCILIATION_REQUIRED");
    expect(expense?.issues[0]?.code).toBe("POTENTIAL_DUPLICATE");
    expect(expense?.values).toEqual({});
    expect(report.duplicateEvidence).toEqual({ proven: 0, potential: 1 });
    expect(report.plan.some((entry) => entry.status === "SKIP_DUPLICATE")).toBe(false);
    // Kas hanya dari bukti jadwal + biaya umum deterministik.
    expect(report.totals.grand.expense).toBe("475.50");
  });

  it("duplikat TERBUKTI (keputusan owner) barulah boleh dilewati", () => {
    const report = runSnapshotDryRun({
      snapshot,
      approvedDuplicateDecisions: [
        {
          expenseId: "EXP-2",
          duplicateOf: { referenceType: "job_crew", referenceId: "JC-1" },
          approvedBy: "owner-keuangan",
          reason: "dua baris untuk kesepakatan crew yang sama",
        },
      ],
    });
    const expense = report.plan.find(
      (entry) => entry.source.sheet === "expenses" && entry.source.sourceId === "EXP-2",
    );
    expect(expense?.status).toBe("SKIP_DUPLICATE");
    expect(expense?.values).toEqual({});
    expect(report.duplicateEvidence).toEqual({ proven: 1, potential: 0 });
    // Melewati baris tidak menambah kas.
    expect(report.totals.grand.expense).toBe("475.50");
  });

  it("duplikat terbukti tidak boleh menghalangi uji `isProvenDuplicate` pada non-bukti", () => {
    const report = runSnapshotDryRun({ snapshot });
    const expense = report.plan.find((entry) => entry.source.sourceId === "EXP-2")!;
    expect(expense.status).not.toBe("SKIP_DUPLICATE");
    expect(isProvenDuplicate({
      status: "POTENTIAL_DUPLICATE",
      candidatesWithSameAmount: [],
      evidence: "EQUAL_AMOUNT_CANDIDATE",
      issues: [],
      audit: {},
    })).toBe(false);
  });

  it("mendeteksi perubahan sumber antar-snapshot pada laporan dry-run", () => {
    const previous = snap();
    const changedMatrices = snapshotFixture().map((entry) =>
      entry.sheet === "expenses"
        ? matrix("expenses", [
            { id: "EXP-1", job_id: "JOB-1", category: "TRANSPORT", description: "Bensin", amount: "80.00", expense_date: "2026-11-04" },
          ])
        : entry,
    );
    const report = runSnapshotDryRun({
      snapshot: snap({ matrices: changedMatrices }),
      previousSnapshot: previous,
    });
    expect(report.snapshotChangeReport?.changedRows.map((row) => row.sourceId)).toContain("EXP-1");
    expect(report.snapshotChangeReport?.disappearedRows.map((row) => row.sourceId)).toContain("EXP-2");
  });
});

/* -------------------------------------------------------------------------- */
/* 7. Register keputusan D1–D12                                                */
/* -------------------------------------------------------------------------- */

describe("register keputusan owner D1–D12", () => {
  it("tanpa bukti sumber → semua keputusan BLOCKED (bukan APPROVED) dengan jumlah null", () => {
    const register = buildDecisionRegister({});
    expect(register).toHaveLength(12);
    expect(register.map((entry) => entry.id)).toEqual([...DECISION_IDS]);
    expect(register.every((entry) => entry.approvalState === "BLOCKED_SOURCE_UNAVAILABLE")).toBe(true);
    expect(register.every((entry) => entry.affectedRowCount === null)).toBe(true);
    expect(blockingDecisions(register)).toHaveLength(12);
    expect(migrationBlockers(register).map((entry) => entry.id)).toEqual(["D1", "D4"]);
  });

  it("dengan snapshot → keputusan tetap NOT_APPROVED dan berisi bukti tersanitasi", () => {
    const snapshot = snap();
    const report = runSnapshotDryRun({ snapshot });
    const register = buildDecisionRegister({ snapshot, report });
    expect(register.every((entry) => entry.approvalState === "NOT_APPROVED")).toBe(true);
    expect(register.every((entry) => entry.affectedRowCount !== null)).toBe(true);
    expect(register.find((entry) => entry.id === "D9")?.affectedRowCount).toBe(1);
    expect(register.find((entry) => entry.id === "D11")?.affectedRowCount).toBe(1);

    // Tidak ada nilai sensitif pada bukti keputusan.
    const values = collectSensitiveValues(snapshot);
    expect(() => assertNoSensitiveData(register, values)).not.toThrow();
  });

  it("keputusan hanya APPROVED dengan otorisasi eksplisit", () => {
    const approvals: OwnerApproval[] = [
      { decisionId: "D1", optionId: "APPROVE_DICTIONARY", approvedBy: "", approvedAt: "2026-10-14T00:00:00.000Z" },
      { decisionId: "D4", optionId: "OBLIGATION_ONLY", approvedBy: "owner-keuangan", approvedAt: "2026-10-14T00:00:00.000Z" },
    ];
    const register = buildDecisionRegister({ approvals });
    expect(register.find((entry) => entry.id === "D1")?.approvalState).toBe(
      "BLOCKED_SOURCE_UNAVAILABLE",
    );
    expect(isDecisionApproved(register, "D1")).toBe(false);
    expect(isDecisionApproved(register, "D4")).toBe(true);
    expect(register.find((entry) => entry.id === "D4")?.approvedOption).toBe("OBLIGATION_ONLY");
    expect(migrationBlockers(register).map((entry) => entry.id)).toEqual(["D1"]);
    expect(() => assertApprovalsAreAuthorized(register)).not.toThrow();
  });

  it("setiap keputusan mendefinisikan opsi, konsekuensi, approver, dan bukti yang dibutuhkan", () => {
    const register = buildDecisionRegister({});
    for (const entry of register) {
      expect(entry.options.length).toBeGreaterThanOrEqual(2);
      expect(entry.requiredApprover).not.toBe("");
      expect(entry.evidenceNeeded).not.toBe("");
      for (const option of entry.options) {
        expect(option.label).not.toBe("");
        expect(option.consequence).not.toBe("");
      }
      expect(entry.evidence.length).toBeGreaterThan(0);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 8. Total finansial minor-unit BigInt                                       */
/* -------------------------------------------------------------------------- */

describe("total finansial memakai minor-unit BigInt", () => {
  it("aman di luar rentang integer JavaScript dan tetap 2 desimal", () => {
    expect(totalAmounts(["9007199254740993.01", "0.02"])).toBe("9007199254740993.03");
    expect(totalAmounts(["0.10", "0.20"])).toBe("0.30");
    expect(totalAmounts(["9999999999999.99", "0.01"])).toBe("10000000000000.00");
  });

  it("nominal pada dry-run snapshot berupa string Amount kanonik", () => {
    const report = runSnapshotDryRun({ snapshot: snap() });
    for (const entry of report.plan) {
      const amount = entry.values.amount;
      if (typeof amount === "string") expect(amount).toMatch(/^-?\d+\.\d{2}$/);
    }
    expect(report.totals.grand.income).toMatch(/^-?\d+\.\d{2}$/);
  });
});

/* -------------------------------------------------------------------------- */
/* 9. Preflight produksi read-only & guard database test                       */
/* -------------------------------------------------------------------------- */

describe("preflight produksi & guard database", () => {
  it("hanya menerima statement baca", () => {
    expect(() => assertReadOnlyQuery("SELECT 1")).not.toThrow();
    expect(() =>
      assertReadOnlyQuery("SELECT * FROM information_schema.TABLES"),
    ).not.toThrow();
    for (const sql of [
      "ALTER TABLE cashflows MODIFY job_id varchar(36)",
      "UPDATE cashflows SET amount = 0",
      "DELETE FROM cashflows",
      "INSERT INTO cashflows (id) VALUES ('x')",
      "DROP TABLE jobs",
      "CREATE TABLE x (id int)",
    ]) {
      expect(() => assertReadOnlyQuery(sql), `harus ditolak: ${sql}`).toThrow(/preflight/);
    }
  });

  it("hanya boleh dijalankan terhadap database produksi", () => {
    expect(() => assertPreflightDatabaseAllowed(PROD_DATABASE)).not.toThrow();
    expect(() => assertPreflightDatabaseAllowed(TEST_DATABASE)).toThrow(/only|hanya/i);
    expect(() => assertPreflightDatabaseAllowed("lain")).toThrow();
    expect(databaseNameFromUrl("mysql://user:pass@127.0.0.1:3306/database-airprod")).toBe(
      PROD_DATABASE,
    );
    expect(() => assertSafeIdentifier("cashflows")).not.toThrow();
    expect(() => assertSafeIdentifier("cashflows; DROP TABLE jobs")).toThrow();
  });

  it("database produksi tidak pernah boleh menjadi target tulis test", () => {
    // Setup test mengarahkan DATABASE_URL ke `airprod_test`; untuk menguji guard
    // produksi, URL produksi dibentuk ulang dari URL test (nama database diganti).
    const saved = process.env.DATABASE_URL;
    const prodUrl = replaceDatabaseName(saved ?? "mysql://root@127.0.0.1:3306/airprod_test", PROD_DATABASE);
    process.env.DATABASE_URL = prodUrl;
    try {
      const testUrl = resolveTestDatabaseUrl();
      expect(new URL(testUrl).pathname).toBe(`/${TEST_DATABASE}`);
      expect(new URL(testUrl).pathname).not.toBe(`/${PROD_DATABASE}`);

      // Guard menolak bila DATABASE_URL tidak menunjuk database produksi.
      process.env.DATABASE_URL = replaceDatabaseName(prodUrl, "database_lain");
      expect(() => resolveTestDatabaseUrl()).toThrow(/STOP/);
    } finally {
      process.env.DATABASE_URL = saved;
    }
  });

  it("checklist P0D-2B tidak menandai item tak terverifikasi sebagai terpenuhi", () => {
    const report: PreflightReport = {
      database: PROD_DATABASE,
      tableCount: 14,
      tables: [],
      journal: [{ id: 1, hash: "x", createdAt: 0 }],
      cashflowsJobIdNullable: "NO",
      idempotencyColumnsPresent: { idempotencyKey: false, idempotencyFingerprint: false },
      uniqueIdempotencyIndexPresent: false,
      cashflowsForeignKeys: ["fk: job_id → jobs.id"],
      defaults: { crewDefaultPayment: "0.00", jobCrewsAgreedAmount: "0.00" },
      schemaDrift: [],
      plannedSourceCollisions: null,
    };
    const checklist = buildP0D2BReadinessChecklist(report);
    const unverifiable = checklist.filter((item) => item.satisfied === null);
    expect(unverifiable.length).toBeGreaterThan(0);
    expect(unverifiable.some((item) => item.evidence.includes("BLOCKED"))).toBe(true);
    expect(checklist.find((item) => item.id === "P0D2B-9")?.satisfied).toBeNull();
  });
});
