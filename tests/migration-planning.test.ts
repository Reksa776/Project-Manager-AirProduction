import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SHEET_HEADERS, type SheetTitle } from "@/repositories/google/mapping";
import {
  assertSourceDataAvailable,
  buildVenueArchive,
  buildSourceInventory,
  classifyLegacyExpense,
  compareTotals,
  computeReconciliationTotals,
  detectRunConflict,
  deterministicMigrationId,
  findDuplicateSourceIds,
  fingerprintsBySource,
  inventorySheet,
  isApprovedDictionary,
  isDeterministicMigrationId,
  isProvenDuplicate,
  isSourceDataAvailable,
  MIGRATION_ORDER,
  migrationIdempotencyKey,
  SHEET_MAPPING_SPECS,
  normalizeRoleKey,
  proposeCrewRoleDictionary,
  reconcileCrewAssignmentPayment,
  reconcileSchedulePayment,
  resolveCrewRoleId,
  resolveLegacyVenueName,
  runDryRun,
  snapshotFingerprint,
  SourceDataUnavailableError,
  sourceFingerprint,
  summarizeExpenseClassifications,
  totalAmounts,
  validateMigrationOrder,
  validateSourceReferences,
  validateSpecCoverage,
  type SourceRows,
} from "@/migration";

/**
 * Test PERENCANAAN migrasi (P0D-1) — fixture SINTETIS.
 *
 * Catatan penting: seluruh data di sini adalah karangan penguji untuk menguji
 * logika perencanaan. Hasilnya BUKAN verifikasi data historis nyata (data
 * sumber produksi tidak tersedia pada P0D-1; lihat `assertSourceDataAvailable`).
 */

let rowCounter = 0;

function sheetRow(sheet: SheetTitle, record: Record<string, string>): { rowNumber: number; values: string[] } {
  rowCounter += 1;
  return {
    rowNumber: rowCounter,
    values: SHEET_HEADERS[sheet].map((header) => record[header] ?? ""),
  };
}

const APPROVED_ROLES = {
  approvedBy: "synthetic-test-fixture (bukan approval produksi)",
  roles: [
    { id: "role-videographer", name: "Videographer" },
    { id: "role-editor", name: "Editor" },
  ],
};

function fixtureSource(): SourceRows {
  // Nomor baris dimulai ulang: snapshot worksheet yang sama punya nomor baris
  // yang stabil, sehingga rencana dua run harus identik.
  rowCounter = 0;
  return {
    clients: [sheetRow("clients", { id: "CLI-1", name: "Klien Satu", contact: "0811", address: "Jl. A" })],
    vendors: [sheetRow("vendors", { id: "VND-1", name: "Vendor Satu", contact: "0812" })],
    venues: [
      sheetRow("venues", { id: "VNU-1", name: "Gedung Utama" }),
      sheetRow("venues", { id: "VNU-2", name: "Taman Kota" }),
    ],
    crew: [
      sheetRow("crew", { id: "CRW-1", name: "Budi", role: "Videographer", contact: "0813", default_payment: "1500000.50" }),
      sheetRow("crew", { id: "CRW-2", name: "Sari", role: " EDITOR ", contact: "0814", default_payment: "800000" }),
    ],
    jobs: [
      sheetRow("jobs", {
        id: "JOB-1",
        job_number: "JOB-2026-000001",
        client_id: "CLI-1",
        venue_id: "VNU-1",
        job_name: "Wedding A",
        job_type: "WEDDING",
        execution_date: "2026-11-01",
        status: "NOT_STARTED",
        description: "catatan",
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: "2026-10-01T00:00:00.000Z",
      }),
      sheetRow("jobs", {
        id: "JOB-2",
        job_number: "JOB-2026-000002",
        vendor_id: "VND-1",
        venue_id: "VNU-UNKNOWN",
        job_name: "Corporate B",
        job_type: "CORPORATE",
        execution_date: "2026-11-02",
        status: "IN_PROGRESS",
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: "2026-10-01T00:00:00.000Z",
      }),
    ],
    job_crews: [
      sheetRow("job_crews", {
        id: "JC-1",
        job_id: "JOB-1",
        crew_id: "CRW-1",
        role: "Videographer",
        payment: "500000",
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: "2026-10-01T00:00:00.000Z",
      }),
    ],
    deliveries: [
      sheetRow("deliveries", {
        id: "DLV-1",
        job_id: "JOB-1",
        item_name: "Video Highlight",
        delivery_type: "VIDEO",
        quantity: "1",
        deadline: "2026-12-01",
        status: "NOT_STARTED",
      }),
    ],
    client_payments: [
      sheetRow("client_payments", {
        id: "CP-1",
        job_id: "JOB-1",
        term: "TERMIN_1",
        amount: "1000.00",
        due_date: "2026-11-01",
        paid_date: "2026-11-01",
        status: "PAID",
      }),
      sheetRow("client_payments", {
        id: "CP-2",
        job_id: "JOB-1",
        term: "TERMIN_2",
        amount: "500.00",
        paid_date: "2026-11-05",
        status: "PARTIAL",
      }),
      sheetRow("client_payments", {
        id: "CP-3",
        job_id: "JOB-1",
        term: "TERMIN_3",
        amount: "250.00",
        status: "UNPAID",
      }),
    ],
    vendor_payments: [
      sheetRow("vendor_payments", {
        id: "VP-1",
        job_id: "JOB-2",
        type: "DP",
        amount: "400.00",
        paid_date: "2026-11-03",
        status: "PAID",
      }),
    ],
    expenses: [
      sheetRow("expenses", {
        id: "EXP-1",
        job_id: "JOB-1",
        category: "TRANSPORT",
        description: "Bensin",
        amount: "75.50",
        expense_date: "2026-11-04",
      }),
      sheetRow("expenses", {
        id: "EXP-2",
        job_id: "JOB-1",
        category: "CREW",
        description: "Bayar crew",
        amount: "500000",
        expense_date: "2026-11-05",
      }),
      sheetRow("expenses", {
        id: "EXP-3",
        job_id: "JOB-2",
        category: "VENDOR",
        description: "Bayar vendor",
        amount: "400.00",
        expense_date: "2026-11-03",
      }),
      sheetRow("expenses", {
        id: "EXP-4",
        job_id: "JOB-1",
        category: "MISC",
        description: "Tidak jelas",
        amount: "10.00",
        expense_date: "2026-11-06",
      }),
    ],
  };
}

function entryFor(report: ReturnType<typeof runDryRun>, sheet: SheetTitle, sourceId: string) {
  return report.plan.find((entry) => entry.source.sheet === sheet && entry.source.sourceId === sourceId);
}

/* -------------------------------------------------------------------------- */
/* 1. Spesifikasi mapping & urutan migrasi                                     */
/* -------------------------------------------------------------------------- */

describe("spesifikasi mapping & urutan migrasi", () => {
  it("setiap kolom worksheet sumber punya disposisi eksplisit", () => {
    const outcome = validateSpecCoverage();
    expect(outcome.errors).toEqual([]);
    expect(outcome.ok).toBe(true);
  });

  it("coverage mendeteksi kolom yang belum dipetakan", () => {
    const broken = {
      ...SHEET_MAPPING_SPECS,
      jobs: {
        ...SHEET_MAPPING_SPECS.jobs,
        columns: Object.fromEntries(
          Object.entries(SHEET_MAPPING_SPECS.jobs.columns).filter(([column]) => column !== "job_type"),
        ),
      },
    };
    const outcome = validateSpecCoverage(broken);
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join(" ")).toMatch(/jobs\.job_type/);
  });

  it("urutan migrasi FK-safe dan memuat semua entity", () => {
    const outcome = validateMigrationOrder();
    expect(outcome.errors).toEqual([]);
    expect(new Set(MIGRATION_ORDER).size).toBe(MIGRATION_ORDER.length);
    expect(MIGRATION_ORDER.indexOf("crewRoles")).toBeLessThan(MIGRATION_ORDER.indexOf("crew"));
    expect(MIGRATION_ORDER.indexOf("jobs")).toBeLessThan(
      MIGRATION_ORDER.indexOf("clientPaymentSchedules"),
    );
    expect(MIGRATION_ORDER.indexOf("jobs")).toBeLessThan(MIGRATION_ORDER.indexOf("cashflows"));
  });

  it("urutan salah terdeteksi (crew sebelum crewRoles)", () => {
    const bad = ["crew", ...MIGRATION_ORDER.filter((entity) => entity !== "crew")] as typeof MIGRATION_ORDER;
    const outcome = validateMigrationOrder(bad);
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join(" ")).toMatch(/Urutan salah/);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Arsip venue                                                              */
/* -------------------------------------------------------------------------- */

describe("venue historis", () => {
  it("memetakan venue_id → legacy_venue_name tanpa mengarang nama", () => {
    const archive = buildVenueArchive([
      { id: "VNU-1", name: " Gedung Utama " },
      { id: "VNU-1", name: "Gedung Utama" },
    ]);
    const resolved = resolveLegacyVenueName({ venueId: "VNU-1", archive });
    expect(resolved.status).toBe("OK");
    expect(resolved.value?.legacyVenueName).toBe("Gedung Utama");
    expect(resolved.value?.audit.source_venue_id).toBe("VNU-1");
  });

  it("venue_id tanpa nama arsip → RECONCILIATION_REQUIRED", () => {
    const archive = buildVenueArchive([{ id: "VNU-1", name: "Gedung Utama" }]);
    const resolved = resolveLegacyVenueName({ venueId: "VNU-9", archive });
    expect(resolved.status).toBe("RECONCILIATION_REQUIRED");
    expect(resolved.value).toBeUndefined();
    expect(resolved.issues[0]?.code).toBe("VENUE_NAME_MISSING");
  });

  it("nama venue berbeda untuk venue_id yang sama → konflik arsip", () => {
    const archive = buildVenueArchive([
      { id: "VNU-1", name: "Gedung Utama" },
      { id: "VNU-1", name: "Gedung Lama" },
    ]);
    expect(archive.conflicts).toHaveLength(1);
    expect(resolveLegacyVenueName({ venueId: "VNU-1", archive }).status).toBe(
      "RECONCILIATION_REQUIRED",
    );
    expect(archive.issues[0]?.code).toBe("VENUE_ARCHIVE_CONFLICT");
  });

  it("venue_id tanpa nama → tercatat, bukan ditebak", () => {
    const archive = buildVenueArchive([{ id: "VNU-3", name: "  " }]);
    expect(archive.blankNameIds).toEqual(["VNU-3"]);
    expect(archive.nameById.has("VNU-3")).toBe(false);
    expect(archive.issues[0]?.code).toBe("VENUE_ARCHIVE_BLANK_NAME");
  });

  it("job tanpa venue_id tetap OK tanpa legacy_venue_name", () => {
    const archive = buildVenueArchive([]);
    const resolved = resolveLegacyVenueName({ venueId: "", archive });
    expect(resolved.status).toBe("OK");
    expect(resolved.value?.legacyVenueName).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Normalisasi crew role                                                    */
/* -------------------------------------------------------------------------- */

describe("kamus crew role", () => {
  it("menyatukan hanya variasi deterministik (case/spasi) dan menyimpan nilai asli", () => {
    const proposal = proposeCrewRoleDictionary([
      { value: "Videographer", sourceId: "CRW-1" },
      { value: " videographer ", sourceId: "CRW-2" },
      { value: "VIDEOGRAPHER", sourceId: "CRW-3" },
    ]);
    expect(proposal.approvalStatus).toBe("PROPOSED_NOT_APPROVED");
    expect(proposal.roles).toHaveLength(1);
    const role = proposal.roles[0]!;
    expect(role.normalizedKey).toBe("VIDEOGRAPHER");
    expect(role.totalRows).toBe(3);
    expect(role.sourceValues).toEqual([" videographer ", "VIDEOGRAPHER", "Videographer"]);
    expect(role.status).toBe("PROPOSED");
  });

  it("ejaan berbeda yang mirip TIDAK digabung, ditandai ambigu", () => {
    const proposal = proposeCrewRoleDictionary([
      { value: "Videographer" },
      { value: "Videografer" },
    ]);
    expect(proposal.roles).toHaveLength(2);
    expect(proposal.roles.every((role) => role.status === "AMBIGUOUS")).toBe(true);
    expect(proposal.issues.some((issue) => issue.code === "AMBIGUOUS_ROLE")).toBe(true);
  });

  it("role kosong dilaporkan, tidak diberi default", () => {
    const proposal = proposeCrewRoleDictionary([{ value: "   " }]);
    expect(proposal.roles).toHaveLength(0);
    expect(proposal.issues.some((issue) => issue.code === "EMPTY_ROLE")).toBe(true);
  });

  it("normalizeRoleKey hanya trim/rapikan spasi/uppercase", () => {
    expect(normalizeRoleKey("  Lead   Editor ")).toBe("LEAD EDITOR");
  });

  it("role tidak dapat diresolusi tanpa kamus yang disetujui", () => {
    const unresolved = resolveCrewRoleId("Videographer", undefined);
    expect(unresolved.status).toBe("RECONCILIATION_REQUIRED");
    expect(unresolved.issues[0]?.code).toBe("ROLE_DICTIONARY_NOT_APPROVED");
    expect(isApprovedDictionary({ roles: APPROVED_ROLES.roles })).toBe(false);
    expect(isApprovedDictionary(APPROVED_ROLES)).toBe(true);
  });

  it("kamus disetujui dipakai case-insensitive; role tak dikenal ditolak", () => {
    expect(resolveCrewRoleId("videographer", APPROVED_ROLES).value?.crewRoleId).toBe(
      "role-videographer",
    );
    const unknown = resolveCrewRoleId("Drone Pilot", APPROVED_ROLES);
    expect(unknown.status).toBe("RECONCILIATION_REQUIRED");
    expect(unknown.issues[0]?.code).toBe("UNKNOWN_ROLE");
  });

  it("dry-run tanpa kamus disetujui menahan baris crew & assignment", () => {
    const report = runDryRun({ source: fixtureSource() });
    expect(entryFor(report, "crew", "CRW-1")?.status).toBe("RECONCILIATION_REQUIRED");
    expect(entryFor(report, "job_crews", "JC-1")?.status).toBe("RECONCILIATION_REQUIRED");
  });
});

/* -------------------------------------------------------------------------- */
/* 4–5. Identitas & idempotensi deterministik                                  */
/* -------------------------------------------------------------------------- */

describe("identitas migrasi & idempotensi", () => {
  it("ID target deterministik dan berbeda per sumber/worksheet", () => {
    const first = deterministicMigrationId("jobs", "JOB-1");
    const second = deterministicMigrationId("jobs", "JOB-1");
    const otherSheet = deterministicMigrationId("clients", "JOB-1");
    const otherId = deterministicMigrationId("jobs", "JOB-2");
    expect(first).toBe(second);
    expect(isDeterministicMigrationId(first)).toBe(true);
    expect(otherSheet).not.toBe(first);
    expect(otherId).not.toBe(first);
  });

  it("kunci idempotensi kas deterministik dan tidak acak", () => {
    const key = migrationIdempotencyKey("expenses", "EXP-1");
    expect(key).toBe(migrationIdempotencyKey("expenses", "EXP-1"));
    expect(key).not.toBe(migrationIdempotencyKey("expenses", "EXP-2"));
    expect(key.startsWith("migration:expenses:")).toBe(true);
    expect(key.length).toBeLessThanOrEqual(190);
  });

  it("deteksi duplikat identitas sumber", () => {
    const duplicates = findDuplicateSourceIds([
      { sheet: "clients", sourceId: "CLI-1", rowNumber: 2 },
      { sheet: "clients", sourceId: "CLI-1", rowNumber: 7 },
      { sheet: "clients", sourceId: "CLI-2", rowNumber: 3 },
    ]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.rowNumbers).toEqual([2, 7]);
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Sidik jari & restart safety                                              */
/* -------------------------------------------------------------------------- */

describe("sidik jari sumber & restart", () => {
  it("sidik jari tidak bergantung urutan kolom dan berubah bila nilai berubah", () => {
    const a = sourceFingerprint({ a: "1", b: "2" });
    const b = sourceFingerprint({ b: "2", a: "1" });
    const c = sourceFingerprint({ a: "1", b: "3" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("deteksi perubahan antar-run", () => {
    expect(detectRunConflict(undefined, "x")).toBe("CHANGED");
    expect(detectRunConflict("x", "x")).toBe("UNCHANGED");
    expect(detectRunConflict("x", "y")).toBe("CHANGED");
  });

  it("snapshot fingerprint stabil untuk rencana yang sama", () => {
    const report = runDryRun({ source: fixtureSource() });
    const again = runDryRun({ source: fixtureSource() });
    expect(again.snapshotFingerprint).toBe(report.snapshotFingerprint);
    expect(snapshotFingerprint(report.plan)).toBe(report.snapshotFingerprint);
  });

  it("rerun konsisten dan melaporkan sumber baru/berubah/hilang", () => {
    const first = runDryRun({ source: fixtureSource() });
    const second = runDryRun({ source: fixtureSource() });
    expect(second.plan).toEqual(first.plan);

    const unchanged = runDryRun({
      source: fixtureSource(),
      previousRunFingerprints: fingerprintsBySource(first),
    });
    expect(unchanged.runComparison?.changedSources).toEqual([]);
    expect(unchanged.runComparison?.newSources).toEqual([]);
    expect(unchanged.runComparison?.disappearedSources).toEqual([]);

    const changedSource = fixtureSource();
    changedSource.clients![0]!.values[SHEET_HEADERS.clients.indexOf("name")] = "Klien Satu (ubah)";
    const changed = runDryRun({
      source: changedSource,
      previousRunFingerprints: fingerprintsBySource(first),
    });
    expect(changed.runComparison?.changedSources.map((source) => source.sourceId)).toContain("CLI-1");

    const removedSource = fixtureSource();
    removedSource.deliveries = [];
    const removed = runDryRun({
      source: removedSource,
      previousRunFingerprints: fingerprintsBySource(first),
    });
    expect(removed.runComparison?.disappearedSources.map((source) => source.sourceId)).toContain("DLV-1");
  });
});

/* -------------------------------------------------------------------------- */
/* 7. Rekonsiliasi status pembayaran tersimpan                                 */
/* -------------------------------------------------------------------------- */

describe("rekonsiliasi bukti pembayaran", () => {
  it("PAID + paid_date → kas DIAJUKAN (butuh persetujuan)", () => {
    const result = reconcileSchedulePayment({
      amount: "1000.00",
      storedStatus: "PAID",
      paidDate: "2026-11-01",
    });
    expect(result.status).toBe("PROPOSED_CASH");
    expect(result.proposedCash).toEqual({
      amount: "1000.00",
      occurredOn: "2026-11-01",
      basis: "stored_status=PAID + paid_date",
      requiresApproval: true,
    });
    expect(result.issues).toEqual([]);
  });

  it("PAID tanpa paid_date / PARTIAL / UNPAID+d paid_date / status tak dikenal → rekonsiliasi", () => {
    expect(reconcileSchedulePayment({ amount: "10.00", storedStatus: "PAID" }).issues[0]?.code).toBe(
      "MISSING_PAID_DATE",
    );
    expect(
      reconcileSchedulePayment({ amount: "10.00", storedStatus: "PARTIAL", paidDate: "2026-01-01" })
        .issues[0]?.code,
    ).toBe("PARTIAL_AMOUNT_UNKNOWN");
    expect(
      reconcileSchedulePayment({ amount: "10.00", storedStatus: "UNPAID", paidDate: "2026-01-01" })
        .issues[0]?.code,
    ).toBe("STATUS_EVIDENCE_CONFLICT");
    expect(reconcileSchedulePayment({ amount: "10.00", storedStatus: "LUNAS" }).issues[0]?.code).toBe(
      "UNKNOWN_STORED_STATUS",
    );
  });

  it("UNPAID tanpa tanggal → tidak ada kas dan tidak ada rekonsiliasi", () => {
    const result = reconcileSchedulePayment({ amount: "10.00", storedStatus: "UNPAID" });
    expect(result.status).toBe("NO_CASH");
    expect(result.derivedStatus).toBe("UNPAID");
    expect(result.issues).toEqual([]);
  });

  it("assignment crew tidak pernah menghasilkan kas otomatis", () => {
    const plain = reconcileCrewAssignmentPayment({ agreedAmount: "500000" });
    expect(plain.status).toBe("OBLIGATION_ONLY");
    expect(plain.obligationAmount).toBe("500000.00");
    expect(plain.proposedCash).toBeUndefined();

    const paid = reconcileCrewAssignmentPayment({
      agreedAmount: "500000",
      storedStatus: "PAID",
      candidateExpenseIds: ["EXP-2"],
    });
    expect(paid.status).toBe("RECONCILIATION_REQUIRED");
    expect(paid.proposedCash).toBeUndefined();
    expect(paid.issues.map((issue) => issue.code)).toEqual([
      "CREW_PAYMENT_STATUS_STORED",
      "CANDIDATE_EXPENSE_EVIDENCE",
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* 8. Expense CREW/VENDOR: deteksi duplikat                                    */
/* -------------------------------------------------------------------------- */

describe("klasifikasi expense historis", () => {
  const candidates = {
    candidates: [
      { referenceType: "vendor_payment" as const, referenceId: "VP-1", jobId: "JOB-2", amount: "400.00" },
      { referenceType: "job_crew" as const, referenceId: "JC-1", jobId: "JOB-1", amount: "500000.00" },
    ],
  };

  it("biaya umum deterministik → READY (kas EXPENSE)", () => {
    const result = classifyLegacyExpense(
      { id: "EXP-1", jobId: "JOB-1", category: "transport", description: "Bensin", amount: 75.5, date: "2026-11-04" },
      candidates,
    );
    expect(result.status).toBe("READY");
    expect(result.category).toBe("TRANSPORT");
    expect(isProvenDuplicate(result)).toBe(false);
  });

  // ATURAN DIPERKETAT (P0D-2A §6): nominal yang sama BUKAN bukti duplikat.
  it("nominal sama dengan jadwal → POTENTIAL_DUPLICATE (bukan bukti, tidak dilewati)", () => {
    const result = classifyLegacyExpense(
      { id: "EXP-3", jobId: "JOB-2", category: "VENDOR", description: "Bayar vendor", amount: "400.00", date: "2026-11-03" },
      candidates,
    );
    expect(result.status).toBe("POTENTIAL_DUPLICATE");
    expect(result.evidence).toBe("EQUAL_AMOUNT_CANDIDATE");
    expect(result.matchedReference?.referenceId).toBe("VP-1");
    expect(isProvenDuplicate(result)).toBe(false);
    expect(result.issues[0]?.code).toBe("POTENTIAL_DUPLICATE");
  });

  it("duplikat TERBUKTI hanya bila ada referensi eksplisit atau keputusan owner yang disetujui", () => {
    const explicit = classifyLegacyExpense(
      { id: "EXP-3", jobId: "JOB-2", category: "VENDOR", description: "Bayar vendor", amount: "400.00", date: "2026-11-03", sourceReference: "VP-1" },
      candidates,
    );
    expect(explicit.status).toBe("PROVEN_DUPLICATE");
    expect(explicit.evidence).toBe("EXPLICIT_SOURCE_REFERENCE");
    expect(isProvenDuplicate(explicit)).toBe(true);

    const approved = classifyLegacyExpense(
      { id: "EXP-3", jobId: "JOB-2", category: "VENDOR", description: "Bayar vendor", amount: "400.00", date: "2026-11-03" },
      candidates,
      {
        approvedDuplicateDecisions: [
          {
            expenseId: "EXP-3",
            duplicateOf: { referenceType: "vendor_payment", referenceId: "VP-1" },
            approvedBy: "owner-keuangan",
            reason: "dua baris untuk pembayaran yang sama",
          },
        ],
      },
    );
    expect(approved.status).toBe("PROVEN_DUPLICATE");
    expect(approved.evidence).toBe("APPROVED_ROW_DECISION");

    // Keputusan tanpa `approvedBy` eksplisit TIDAK membuktikan duplikat.
    const unauthorized = classifyLegacyExpense(
      { id: "EXP-3", jobId: "JOB-2", category: "VENDOR", description: "Bayar vendor", amount: "400.00", date: "2026-11-03" },
      candidates,
      {
        approvedDuplicateDecisions: [
          {
            expenseId: "EXP-3",
            duplicateOf: { referenceType: "vendor_payment", referenceId: "VP-1" },
            approvedBy: "   ",
            reason: "tanpa approver",
          },
        ],
      },
    );
    expect(unauthorized.status).toBe("POTENTIAL_DUPLICATE");
    expect(isProvenDuplicate(unauthorized)).toBe(false);
  });

  it("expense CREW tanpa padanan → RECONCILIATION_REQUIRED", () => {
    const result = classifyLegacyExpense(
      { id: "EXP-9", jobId: "JOB-3", category: "CREW", description: "Crew lain", amount: "123.00", date: "2026-11-07" },
      candidates,
    );
    expect(result.status).toBe("RECONCILIATION_REQUIRED");
    expect(result.issues[0]?.code).toBe("AMBIGUOUS_EXPENSE_CATEGORY");
  });

  it("kategori tak dikenal → RECONCILIATION_REQUIRED", () => {
    const result = classifyLegacyExpense(
      { id: "EXP-4", jobId: "JOB-1", category: "MISC", description: "x", amount: "10.00", date: "2026-11-06" },
      candidates,
    );
    expect(result.status).toBe("RECONCILIATION_REQUIRED");
    expect(result.issues[0]?.code).toBe("UNMAPPABLE_EXPENSE_CATEGORY");
  });

  it("ringkasan klasifikasi menghitung setiap kategori", () => {
    const summary = summarizeExpenseClassifications([
      classifyLegacyExpense({ id: "a", jobId: "J1", category: "OTHER", description: "x", amount: 1, date: "2026-01-01" }, candidates),
      classifyLegacyExpense({ id: "b", jobId: "JOB-2", category: "VENDOR", description: "x", amount: "400.00", date: "2026-01-01" }, candidates),
      classifyLegacyExpense({ id: "c", jobId: "J1", category: "CREW", description: "x", amount: 2, date: "2026-01-01" }, candidates),
    ]);
    expect(summary).toEqual({
      READY: 1,
      PROVEN_DUPLICATE: 0,
      POTENTIAL_DUPLICATE: 1,
      RECONCILIATION_REQUIRED: 1,
    });
  });
});

/* -------------------------------------------------------------------------- */
/* 9. Total finansial desimal-aman                                             */
/* -------------------------------------------------------------------------- */

describe("total finansial desimal-aman", () => {
  it("0.1 + 0.2 tetap 0.30 (bukan floating point)", () => {
    const totals = computeReconciliationTotals({
      cashflows: [
        { direction: "INCOME", category: "CLIENT_PAYMENT", amount: "0.10" },
        { direction: "INCOME", category: "CLIENT_PAYMENT", amount: "0.20" },
      ],
      obligations: [],
    });
    expect(totals.grand.income).toBe("0.30");
    expect(totals.grand.net).toBe("0.30");
  });

  it("nilai besar tetap presisi", () => {
    expect(totalAmounts(["9999999999999.99", "0.01"])).toBe("10000000000000.00");
  });

  it("obligasi, kas, dan outstanding dihitung per jenis & per job", () => {
    const totals = computeReconciliationTotals({
      cashflows: [
        { jobId: "J1", direction: "INCOME", category: "CLIENT_PAYMENT", amount: "400.25", referenceType: "client_payment", referenceId: "CP" },
        { jobId: "J1", direction: "EXPENSE", category: "TRANSPORT", amount: "25.25" },
      ],
      obligations: [
        { jobId: "J1", kind: "client", referenceId: "CP", amount: "1000.00" },
        { jobId: "J1", kind: "crew", referenceId: "JC", amount: "500000.00" },
      ],
    });
    expect(totals.byJob.J1).toEqual({ income: "400.25", expense: "25.25", net: "375.00" });
    expect(totals.byCategory).toEqual({ CLIENT_PAYMENT: "400.25", TRANSPORT: "25.25" });
    expect(totals.byReference["client_payment:CP"]).toBe("400.25");
    expect(totals.obligation.total).toBe("501000.00");
    expect(totals.paid.total).toBe("400.25");
    expect(totals.outstanding.client).toBe("599.75");
    expect(totals.outstanding.crew).toBe("500000.00");
    expect(totals.outstanding.total).toBe("500599.75");
  });

  it("perbedaan total terlihat eksplisit (tanpa perbedaan tersembunyi)", () => {
    const base = computeReconciliationTotals({
      cashflows: [{ jobId: "J1", direction: "INCOME", category: "CLIENT_PAYMENT", amount: "100.00" }],
      obligations: [],
    });
    const drifted = computeReconciliationTotals({
      cashflows: [{ jobId: "J1", direction: "INCOME", category: "CLIENT_PAYMENT", amount: "90.00" }],
      obligations: [],
    });
    const comparison = compareTotals(base, drifted);
    expect(comparison.matched).toBe(false);
    const income = comparison.discrepancies.find((item) => item.scope === "grand" && item.field === "income");
    expect(income).toMatchObject({ expected: "100.00", actual: "90.00", difference: "10.00" });
    expect(compareTotals(base, base).matched).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* 10. Referensi hilang & inventaris sumber                                    */
/* -------------------------------------------------------------------------- */

describe("inventaris & integritas referensi sumber", () => {
  it("referensi antar-worksheet yang hilang dilaporkan", () => {
    const source: SourceRows = {
      clients: [sheetRow("clients", { id: "CLI-1", name: "A" })],
      vendors: [],
      venues: [sheetRow("venues", { id: "VNU-1", name: "Gedung" })],
      crew: [sheetRow("crew", { id: "CRW-1", name: "B", role: "Editor", default_payment: "1" })],
      jobs: [
        sheetRow("jobs", {
          id: "JOB-1",
          job_number: "N-1",
          client_id: "CLI-HANTU",
          job_name: "X",
          job_type: "WEDDING",
          execution_date: "2026-01-01",
          status: "NOT_STARTED",
          created_at: "t",
          updated_at: "t",
        }),
      ],
      job_crews: [sheetRow("job_crews", { id: "JC-1", job_id: "JOB-1", crew_id: "CRW-HANTU", role: "Editor", payment: "1" })],
    };
    const issues = validateSourceReferences(source);
    const codes = issues.map((issue) => issue.code);
    expect(codes).toContain("MISSING_CLIENT_REFERENCE");
    expect(codes).toContain("MISSING_CREW_REFERENCE");
  });

  it("inventory menghitung baris, sel wajib kosong, duplikat id, dan nilai unik", () => {
    const inventory = inventorySheet("crew", [
      { rowNumber: 2, values: SHEET_HEADERS.crew.map((header) => ({ id: "C1", name: "A", role: "Editor", default_payment: "1", contact: "", notes: "", created_at: "", updated_at: "" })[header] ?? "") },
      { rowNumber: 3, values: SHEET_HEADERS.crew.map((header) => ({ id: "C1", name: "", role: "Videographer", default_payment: "1", contact: "", notes: "", created_at: "", updated_at: "" })[header] ?? "") },
    ]);
    expect(inventory.rowCount).toBe(2);
    expect(inventory.duplicateIds).toEqual([{ sourceId: "C1", rowNumbers: [2, 3] }]);
    expect(inventory.missingRequiredCells).toEqual([{ rowNumber: 3, column: "name" }]);
    expect(inventory.distinctValues.role).toEqual(["Editor", "Videographer"]);
    expect(buildSourceInventory({ crew: [] }).crew?.rowCount).toBe(0);
  });

  it("ketersediaan data sumber dilaporkan sebagai BLOCKED bila kredensial tidak ada", () => {
    if (isSourceDataAvailable()) {
      // Lingkungan dengan kredensial: P0D-1 tetap tidak membaca live.
      expect(() => assertSourceDataAvailable()).toThrow();
      return;
    }
    expect(() => assertSourceDataAvailable()).toThrow(SourceDataUnavailableError);
  });
});

/* -------------------------------------------------------------------------- */
/* 11. Dry-run menyeluruh                                                      */
/* -------------------------------------------------------------------------- */

describe("dry-run migrasi", () => {
  it("menghasilkan rencana tanpa menulis dan menahan baris ambigu", () => {
    const report = runDryRun({ source: fixtureSource(), approvedCrewRoleDictionary: APPROVED_ROLES });

    expect(report.writesAttempted).toBe(false);
    expect(report.plan.length).toBeGreaterThan(0);

    // client/vendor/job siap
    expect(entryFor(report, "clients", "CLI-1")?.status).toBe("READY");
    expect(entryFor(report, "vendors", "VND-1")?.status).toBe("READY");
    expect(entryFor(report, "jobs", "JOB-1")?.status).toBe("READY");

    // venue tidak dikenal → rekonsiliasi (tidak ditebak)
    const unknownVenueJob = entryFor(report, "jobs", "JOB-2");
    expect(unknownVenueJob?.status).toBe("RECONCILIATION_REQUIRED");
    expect(unknownVenueJob?.values).toEqual({});
    expect(unknownVenueJob?.audit?.source_venue_id).toBe("VNU-UNKNOWN");

    // crew role dinormalisasi dari kamus yang disetujui
    const crew = entryFor(report, "crew", "CRW-2");
    expect(crew?.status).toBe("READY");
    expect(crew?.values.crew_role_id).toBe("role-editor");
    expect(crew?.values.default_payment).toBe("800000.00");

    // assignment crew: kesepakatan (bukan kas); role teresolusi ke id kanonik.
    // Bila role sama dengan role master crew, repository kanonik menyimpan NULL
    // (override "ikuti crew") saat penulisan — normalisasi itu milik repository,
    // bukan perencanaan migrasi.
    const assignment = entryFor(report, "job_crews", "JC-1");
    expect(assignment?.status).toBe("READY");
    expect(assignment?.values.agreed_amount).toBe("500000.00");
    expect(assignment?.values.crew_role_id).toBe("role-videographer");
  });

  it("schedule PAID menghasilkan kas DIAJUKAN; PARTIAL ditahan", () => {
    const report = runDryRun({ source: fixtureSource(), approvedCrewRoleDictionary: APPROVED_ROLES });
    expect(entryFor(report, "client_payments", "CP-1")?.status).toBe("READY");
    expect(entryFor(report, "client_payments", "CP-3")?.status).toBe("READY");
    const partial = entryFor(report, "client_payments", "CP-2");
    expect(partial?.status).toBe("RECONCILIATION_REQUIRED");
    expect(partial?.issues[0]?.code).toBe("PARTIAL_AMOUNT_UNKNOWN");
    expect(partial?.values).toEqual({});
  });

  it("expense: biaya umum siap, kandidat duplikat DITAHAN, ambigu ditahan", () => {
    const report = runDryRun({ source: fixtureSource(), approvedCrewRoleDictionary: APPROVED_ROLES });

    const general = entryFor(report, "expenses", "EXP-1");
    expect(general?.status).toBe("READY");
    expect(general?.values.category).toBe("TRANSPORT");
    expect(general?.values.source).toBe("MIGRATION");
    expect(general?.values.amount).toBe("75.50");
    expect(general?.idempotencyKey).toBe("migration:expenses:EXP-1");

    // Nominal sama (EXP-2/EXP-3) TIDAK PERNAH menjadi SKIP_DUPLICATE.
    expect(report.duplicateEvidence).toEqual({ proven: 0, potential: 2 });
    for (const id of ["EXP-2", "EXP-3"]) {
      const entry = entryFor(report, "expenses", id);
      expect(entry?.status).toBe("RECONCILIATION_REQUIRED");
      expect(entry?.values).toEqual({});
      expect(entry?.idempotencyKey).toBeUndefined();
      expect(entry?.issues[0]?.code).toBe("POTENTIAL_DUPLICATE");
    }
    expect(entryFor(report, "expenses", "EXP-4")?.status).toBe("RECONCILIATION_REQUIRED");
    expect(report.plan.some((entry) => entry.status === "SKIP_DUPLICATE")).toBe(false);

    // hanya biaya umum yang menjadi kas tambahan
    const cashflowEntries = report.plan.filter((entry) => entry.entity === "cashflows" && entry.status === "READY");
    expect(cashflowEntries.map((entry) => entry.source.sourceId)).toEqual(["EXP-1"]);
  });

  it("menyusun laporan rekonsiliasi, total, dan urutan migrasi", () => {
    const report = runDryRun({ source: fixtureSource(), approvedCrewRoleDictionary: APPROVED_ROLES });
    const sources = report.reconciliations.map((item) => `${item.source.sheet}:${item.source.sourceId}`);
    expect(sources).toContain("jobs:JOB-2");
    expect(sources).toContain("client_payments:CP-2");
    expect(sources).toContain("expenses:EXP-4");

    expect(report.totals.grand.income).toBe("1000.00");
    expect(report.totals.grand.expense).toBe("475.50");
    expect(report.totals.grand.net).toBe("524.50");
    expect(report.totals.obligation.client).toBe("1250.00");
    expect(report.totals.outstanding.client).toBe("250.00");
    expect(report.order).toEqual([...MIGRATION_ORDER]);

    // tidak ada baris rekonsiliasi yang "dikonversi" diam-diam
    for (const item of report.reconciliations) {
      const entry = report.plan.find(
        (candidate) =>
          candidate.source.sheet === item.source.sheet && candidate.source.sourceId === item.source.sourceId,
      );
      expect(entry?.values).toEqual({});
    }
  });

  it("tidak ada satupun nilai yang dikarang: baris rekonsiliasi tidak punya nilai target", () => {
    const report = runDryRun({ source: fixtureSource() });
    const unresolved = report.plan.filter((entry) => entry.status === "RECONCILIATION_REQUIRED");
    expect(unresolved.length).toBeGreaterThan(0);
    expect(unresolved.every((entry) => Object.keys(entry.values).length === 0)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* 12. Batas modul: tanpa akses Google Sheets / MySQL                          */
/* -------------------------------------------------------------------------- */

describe("batas perencanaan migrasi", () => {
  const migrationDir = "src/migration";
  const forbidden = [
    "@/repositories/google\"",
    "@/lib/google-sheets",
    "@/repositories/index",
    "@/repositories/mysql",
    "@/db\"",
    "getRepositories",
  ];

  it("modul perencanaan tidak mengakses kredensial, jaringan, atau database", () => {
    const files = readdirSync(path.resolve(process.cwd(), migrationDir))
      .filter((entry) => entry.endsWith(".ts"))
      .map((entry) => path.join(migrationDir, entry));
    expect(files.length).toBeGreaterThan(5);

    for (const file of files) {
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
      for (const token of forbidden) {
        expect(code.includes(token), `${file} tidak boleh memakai '${token}'`).toBe(false);
      }
    }
  });
});
