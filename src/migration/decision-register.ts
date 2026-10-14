import { SHEET_HEADERS, rowToRecord, type SheetTitle } from "@/repositories/google/mapping";

import type { DryRunReport } from "./dry-run";
import { opaqueRowRef } from "./source/sanitize";
import type { ValidatedSnapshot } from "./source/types";

/**
 * REGISTER KEPUTUSAN OWNER D1–D12 (P0D-2A §7).
 *
 * Prinsip:
 * - Tidak ada keputusan yang ditandai `APPROVED` tanpa otorisasi eksplisit
 *   (`approvedBy` non-kosong). Tanpa itu, keputusan tetap `NOT_APPROVED`.
 * - Bila bukti sumber belum tersedia (kredensial tidak ada / snapshot belum
 *   dibaca), keputusan berstatus `BLOCKED_SOURCE_UNAVAILABLE` dan jumlah baris
 *   yang terpengaruh adalah `null` — TIDAK ditebak.
 * - Contoh baris memakai referensi OPAQUE (worksheet + nomor baris + hash id),
 *   bukan nilai id/nama.
 */

export type DecisionId =
  | "D1"
  | "D2"
  | "D3"
  | "D4"
  | "D5"
  | "D6"
  | "D7"
  | "D8"
  | "D9"
  | "D10"
  | "D11"
  | "D12";

export type DecisionBlockingScope = "MIGRATION" | "ROWS";

export interface DecisionOption {
  id: string;
  label: string;
  consequence: string;
}

export interface DecisionDefinition {
  id: DecisionId;
  title: string;
  /** Apakah keputusan memblokir seluruh migrasi atau hanya sebagian baris. */
  blockingScope: DecisionBlockingScope;
  requiredApprover: string;
  evidenceNeeded: string;
  options: readonly DecisionOption[];
}

export const DECISION_DEFINITIONS: readonly DecisionDefinition[] = [
  {
    id: "D1",
    title: "Kamus crew role yang disetujui & ejaan ambigu",
    blockingScope: "MIGRATION",
    requiredApprover: "Owner operasi (data master)",
    evidenceNeeded: "Daftar nilai `role` unik dari snapshot + ejaan yang mirip (AMBIGUOUS_ROLE).",
    options: [
      { id: "APPROVE_DICTIONARY", label: "Setujui kamus role (nama kanonik + pemetaan ejaan)", consequence: "Baris crew/assignment dapat dipetakan; ejaan yang tidak dipetakan tetap ditahan." },
      { id: "DEFER", label: "Tunda", consequence: "Semua baris crew dan job_crews tetap RECONCILIATION_REQUIRED (ROLE_DICTIONARY_NOT_APPROVED)." },
    ],
  },
  {
    id: "D2",
    title: "Arsip venue: nama konflik dan nama kosong",
    blockingScope: "ROWS",
    requiredApprover: "Owner operasi (venue)",
    evidenceNeeded: "Daftar venue_id dengan >1 nama dan venue_id tanpa nama.",
    options: [
      { id: "PICK_AUTHORITATIVE", label: "Tetapkan nama otoritatif per venue_id", consequence: "Job terkait dapat diisi legacy_venue_name; job lain tidak terpengaruh." },
      { id: "LEAVE_EMPTY", label: "Biarkan legacy_venue_name kosong", consequence: "Job terkait tetap RECONCILIATION_REQUIRED sampai diputuskan." },
    ],
  },
  {
    id: "D3",
    title: "Job yang menunjuk venue_id tidak dikenal",
    blockingScope: "ROWS",
    requiredApprover: "Owner operasi (venue)",
    evidenceNeeded: "Daftar job dengan venue_id yang tidak ada pada arsip venues.",
    options: [
      { id: "CORRECT_SOURCE", label: "Perbaiki venue_id di sumber", consequence: "Job menjadi READY pada dry-run berikutnya." },
      { id: "ACCEPT_EMPTY", label: "Terima legacy_venue_name kosong", consequence: "Job diimpor tanpa nama venue historis (jejak venue_id hilang kecuali di audit)." },
    ],
  },
  {
    id: "D4",
    title: "Kas yang diajukan dari status PAID + paid_date",
    blockingScope: "MIGRATION",
    requiredApprover: "Owner keuangan",
    evidenceNeeded: "Daftar jadwal PAID dengan paid_date, beserta nominalnya.",
    options: [
      { id: "APPROVE_PROPOSED_CASH", label: "Setujui kas = nominal penuh pada paid_date", consequence: "cashflow INCOME/EXPENSE dibuat untuk jadwal tersebut." },
      { id: "OBLIGATION_ONLY", label: "Impor sebagai obligasi saja", consequence: "Tidak ada kas historis; status pembayaran tidak dapat direkonstruksi sampai ada bukti." },
    ],
  },
  {
    id: "D5",
    title: "Nominal kas untuk jadwal PARTIAL",
    blockingScope: "ROWS",
    requiredApprover: "Owner keuangan",
    evidenceNeeded: "Daftar jadwal berstatus PARTIAL (nominal parsial tidak tersimpan di sumber).",
    options: [
      { id: "SUPPLY_AMOUNTS", label: "Isi nominal parsial per baris", consequence: "Kas dapat dibuat dengan bukti baru (tetap memerlukan pencatatan bukti)." },
      { id: "OBLIGATION_ONLY", label: "Impor obligasi saja", consequence: "Outstanding dihitung terhadap nomor penuh; kas parsial tidak tercatat." },
    ],
  },
  {
    id: "D6",
    title: "Expense CREW/VENDOR tanpa padanan jadwal",
    blockingScope: "ROWS",
    requiredApprover: "Owner keuangan",
    evidenceNeeded: "Daftar expense kategori CREW/VENDOR tanpa kandidat nominal sama pada job yang sama.",
    options: [
      { id: "TREAT_AS_CASH", label: "Perlakukan sebagai kas crew/vendor", consequence: "Baris diimpor sebagai cashflow EXPENSE (membutuhkan konfirmasi per baris)." },
      { id: "TREAT_AS_GENERAL", label: "Perlakukan sebagai biaya umum", consequence: "Kategori cashflow harus ditetapkan manual; tidak boleh dikarang." },
      { id: "EXCLUDE", label: "Kecualikan dari impor", consequence: "Baris tidak diimpor; tetap tercatat pada laporan rekonsiliasi." },
    ],
  },
  {
    id: "D7",
    title: "Bukti pembayaran crew & kandidat duplikat",
    blockingScope: "ROWS",
    requiredApprover: "Owner keuangan + owner operasi",
    evidenceNeeded: "Daftar assignment dengan payment_status tersimpan dan expense CREW bernominal sama (kandidat).",
    options: [
      { id: "APPROVE_EVIDENCE", label: "Setujui bukti kas crew per baris", consequence: "Kas crew dibuat hanya untuk baris yang disetujui eksplisit." },
      { id: "OBLIGATION_ONLY", label: "Impor kesepakatan saja", consequence: "Tidak ada kas crew historis; outstanding crew tetap terlihat." },
    ],
  },
  {
    id: "D8",
    title: "Referensi yatim (client/vendor/job/crew/venue)",
    blockingScope: "ROWS",
    requiredApprover: "Owner operasi",
    evidenceNeeded: "Daftar referensi yang tidak ditemukan pada worksheet tujuan.",
    options: [
      { id: "FIX_SOURCE", label: "Perbaiki referensi di sumber", consequence: "Baris menjadi READY bila semua referensi valid." },
      { id: "SKIP_ROWS", label: "Lewati baris terkait", consequence: "Baris tidak diimpor; tercatat pada laporan rekonsiliasi." },
    ],
  },
  {
    id: "D9",
    title: "Expense operasional tanpa job_id",
    blockingScope: "ROWS",
    requiredApprover: "Owner keuangan",
    evidenceNeeded: "Daftar expense dengan job_id kosong/tidak dikenal (memerlukan cashflows.job_id nullable — migrasi 0001).",
    options: [
      { id: "ALLOW_NULL_JOB", label: "Izinkan impor dengan job_id NULL", consequence: "Bergantung pada migrasi 0001 (job_id nullable) yang belum diterapkan." },
      { id: "SKIP_ROWS", label: "Lewati baris tanpa job", consequence: "Biaya operasional historis tidak diimpor; tetap tercatat pada laporan." },
    ],
  },
  {
    id: "D10",
    title: "Jadwal pembayaran duplikat (job_id + term/type)",
    blockingScope: "ROWS",
    requiredApprover: "Owner keuangan",
    evidenceNeeded: "Daftar kombinasi (job_id, term) dan (job_id, type) yang muncul lebih dari sekali.",
    options: [
      { id: "IMPORT_BOTH", label: "Impor keduanya", consequence: "Obligasi bertambah; total outstanding berubah." },
      { id: "MERGE", label: "Gabungkan", consequence: "Memerlukan penetapan nominal per baris; tidak boleh dikarang." },
      { id: "SKIP_DUPLICATE", label: "Lewati duplikat", consequence: "Hanya satu jadwal yang diimpor per kombinasi." },
    ],
  },
  {
    id: "D11",
    title: "Baris admin lama & kompatibilitas hash sandi",
    blockingScope: "ROWS",
    requiredApprover: "Owner sistem + P1A",
    evidenceNeeded: "Jumlah baris admins dan format password_hash.",
    options: [
      { id: "DEFER_TO_P1A", label: "Tunda ke P1A", consequence: "Baris admins tetap DEFERRED (tidak diimpor pada P0D)." },
      { id: "IMPORT_NOW", label: "Impor sekarang", consequence: "Memerlukan keputusan kompatibilitas hash sandi sebelum aktivasi runtime." },
    ],
  },
  {
    id: "D12",
    title: "Seeding urutan job number historis",
    blockingScope: "ROWS",
    requiredApprover: "Owner operasi + P2A",
    evidenceNeeded: "Jumlah job_number historis dan pola penomorannya.",
    options: [
      { id: "SEED_FROM_MAX", label: "Seed job_sequences dari nomor tertinggi", consequence: "Penomoran berikutnya melanjutkan riwayat (P2A)." },
      { id: "SEED_FROM_COUNT", label: "Seed dari jumlah baris", consequence: "Berisiko tabrakan bila ada nomor yang hilang; tidak disarankan." },
    ],
  },
];

export interface OwnerApproval {
  decisionId: DecisionId;
  optionId: string;
  /** Wajib non-kosong agar keputusan dianggap APPROVED. */
  approvedBy: string;
  approvedAt: string;
  note?: string;
}

export type DecisionApprovalState = "APPROVED" | "NOT_APPROVED" | "BLOCKED_SOURCE_UNAVAILABLE";

export interface DecisionRegisterEntry {
  id: DecisionId;
  title: string;
  blockingScope: DecisionBlockingScope;
  requiredApprover: string;
  evidenceNeeded: string;
  options: readonly DecisionOption[];
  /** Jumlah baris sumber terdampak; `null` bila bukti sumber belum tersedia. */
  affectedRowCount: number | null;
  /** Bukti aman (kode issue + hitungan + referensi opaque), tanpa nilai sensitif. */
  evidence: string[];
  approvalState: DecisionApprovalState;
  approvedBy?: string;
  approvedAt?: string;
  approvedOption?: string;
}

export interface DecisionRegisterInput {
  snapshot?: ValidatedSnapshot;
  report?: DryRunReport;
  approvals?: readonly OwnerApproval[];
  /** Apakah bukti sumber nyata tersedia (default: snapshot ada). */
  sourceAvailable?: boolean;
}

function issueCodeCounts(report: DryRunReport): Record<string, number> {
  const counts: Record<string, number> = {};
  const bump = (code: string): void => {
    counts[code] = (counts[code] ?? 0) + 1;
  };
  for (const entry of report.plan) for (const issue of entry.issues) bump(issue.code);
  for (const issue of report.referenceIssues) bump(issue.code);
  for (const issue of report.venueArchive.issues) bump(issue.code);
  for (const item of report.reconciliations) for (const issue of item.issues) bump(issue.code);
  return counts;
}

function sumCodes(counts: Record<string, number>, codes: readonly string[]): number {
  return codes.reduce((total, code) => total + (counts[code] ?? 0), 0);
}

function snapshotSheetRows(
  snapshot: ValidatedSnapshot | undefined,
  sheet: SheetTitle,
): Array<{ rowNumber: number; record: Record<string, string> }> {
  if (!snapshot) return [];
  return snapshot.sheets[sheet].rows.map((row) => ({
    rowNumber: row.rowNumber,
    record: rowToRecord(snapshot.sheets[sheet].headers, row.values),
  }));
}

function countDuplicateSchedules(
  snapshot: ValidatedSnapshot | undefined,
  sheet: "client_payments" | "vendor_payments",
  keyColumn: "term" | "type",
): number {
  const buckets = new Map<string, number>();
  for (const { record } of snapshotSheetRows(snapshot, sheet)) {
    const jobId = record.job_id ?? "";
    const key = record[keyColumn] ?? "";
    if (jobId === "" || key === "") continue;
    const bucketKey = `${jobId}|${key}`;
    buckets.set(bucketKey, (buckets.get(bucketKey) ?? 0) + 1);
  }
  return [...buckets.values()].filter((count) => count > 1).length;
}

function examplesOf(
  snapshot: ValidatedSnapshot | undefined,
  sheet: SheetTitle,
  predicate: (record: Record<string, string>) => boolean,
  limit = 5,
): string[] {
  const refs: string[] = [];
  for (const { rowNumber, record } of snapshotSheetRows(snapshot, sheet)) {
    if (!predicate(record)) continue;
    refs.push(opaqueRowRef(sheet, rowNumber, record.id ?? ""));
    if (refs.length >= limit) break;
  }
  return refs;
}

/** Jumlah baris sumber per keputusan (null bila snapshot tidak tersedia). */
function affectedRowCounts(input: DecisionRegisterInput): Record<DecisionId, number | null> {
  const { snapshot, report } = input;
  const available = input.sourceAvailable ?? snapshot !== undefined;
  if (!available) {
    return Object.fromEntries(
      DECISION_DEFINITIONS.map((definition) => [definition.id, null]),
    ) as Record<DecisionId, number | null>;
  }

  const counts = report ? issueCodeCounts(report) : {};
  const expensesWithoutJob = snapshotSheetRows(snapshot, "expenses").filter(
    ({ record }) => (record.job_id ?? "") === "",
  ).length;
  const jobs = snapshotSheetRows(snapshot, "jobs");
  const distinctJobNumbers = new Set(jobs.map(({ record }) => record.job_number ?? "").filter((v) => v !== ""));
  const adminsRows = snapshotSheetRows(snapshot, "admins").length;

  return {
    D1: sumCodes(counts, ["ROLE_DICTIONARY_NOT_APPROVED", "UNKNOWN_ROLE", "EMPTY_ROLE", "AMBIGUOUS_ROLE"]),
    D2: (report?.venueArchive.conflicts ?? 0) + (report?.venueArchive.blankNames ?? 0),
    D3: sumCodes(counts, ["VENUE_NAME_MISSING", "VENUE_ARCHIVE_CONFLICT"]),
    D4: sumCodes(counts, ["MISSING_PAID_DATE", "STATUS_MISMATCH"]),
    D5: sumCodes(counts, ["PARTIAL_AMOUNT_UNKNOWN"]),
    D6: sumCodes(counts, ["AMBIGUOUS_EXPENSE_CATEGORY", "UNMAPPABLE_EXPENSE_CATEGORY"]),
    D7: sumCodes(counts, ["CANDIDATE_EXPENSE_EVIDENCE", "CREW_PAYMENT_STATUS_STORED"]),
    D8: sumCodes(counts, [
      "MISSING_CLIENT_REFERENCE",
      "MISSING_VENDOR_REFERENCE",
      "MISSING_VENUE_REFERENCE",
      "MISSING_JOB_REFERENCE",
      "MISSING_CREW_REFERENCE",
    ]),
    D9: expensesWithoutJob,
    D10:
      countDuplicateSchedules(snapshot, "client_payments", "term") +
      countDuplicateSchedules(snapshot, "vendor_payments", "type"),
    D11: adminsRows,
    D12: distinctJobNumbers.size,
  };
}

function evidenceFor(
  definition: DecisionDefinition,
  input: DecisionRegisterInput,
  affected: number | null,
): string[] {
  const { snapshot, report } = input;
  const available = input.sourceAvailable ?? snapshot !== undefined;
  if (!available) {
    return [
      "BLOCKED: bukti sumber belum tersedia (GOOGLE_SHEETS_ID tidak ada / snapshot belum dibaca).",
      `Bukti yang dibutuhkan: ${definition.evidenceNeeded}`,
    ];
  }

  const counts = report ? issueCodeCounts(report) : {};
  const evidence: string[] = [`Baris terdampak: ${affected ?? 0}`];
  switch (definition.id) {
    case "D1": {
      const roles = report?.crewRoleProposal.roles ?? [];
      evidence.push(`Kamus diajukan (belum disetujui): ${roles.length} role; ambigu: ${roles.filter((role) => role.status === "AMBIGUOUS").length}.`);
      evidence.push(...roles.slice(0, 10).map((role) => `role '${role.normalizedKey}': ${role.totalRows} baris`));
      break;
    }
    case "D2":
    case "D3":
      evidence.push(`Konflik arsip venue: ${report?.venueArchive.conflicts ?? 0}; nama kosong: ${report?.venueArchive.blankNames ?? 0}.`);
      evidence.push(...examplesOf(snapshot, "jobs", (record) => (record.venue_id ?? "") !== "").map((ref) => `contoh job dengan venue: ${ref}`));
      break;
    case "D4":
      evidence.push(
        `Jadwal berstatus PAID: ${(report?.plan ?? []).filter((entry) => (entry.entity === "clientPaymentSchedules" || entry.entity === "vendorPaymentSchedules") && entry.audit?.source_status === "PAID").length}.`,
      );
      break;
    case "D5":
      evidence.push(`Kode PARTIAL_AMOUNT_UNKNOWN: ${counts.PARTIAL_AMOUNT_UNKNOWN ?? 0}.`);
      break;
    case "D6":
      evidence.push(
        `Kode AMBIGUOUS_EXPENSE_CATEGORY: ${counts.AMBIGUOUS_EXPENSE_CATEGORY ?? 0}; UNMAPPABLE: ${counts.UNMAPPABLE_EXPENSE_CATEGORY ?? 0}.`,
      );
      evidence.push(...examplesOf(snapshot, "expenses", (record) => ["CREW", "VENDOR"].includes((record.category ?? "").toUpperCase())));
      break;
    case "D7":
      evidence.push(
        `Kandidat bukti kas crew: ${counts.CANDIDATE_EXPENSE_EVIDENCE ?? 0}; status crew tersimpan: ${counts.CREW_PAYMENT_STATUS_STORED ?? 0}.`,
      );
      break;
    case "D8":
      evidence.push(
        `Referensi yatim: ${(report?.referenceIssues ?? []).length}.`,
        ...(report?.referenceIssues ?? []).slice(0, 5).map((issue) => `${issue.sheet}#${issue.rowNumber}: ${issue.code}`),
      );
      break;
    case "D9":
      evidence.push(`Baris expense tanpa job_id: ${affected ?? 0}.`);
      evidence.push(...examplesOf(snapshot, "expenses", (record) => (record.job_id ?? "") === ""));
      break;
    case "D10":
      evidence.push(`Kombinasi jadwal duplikat: ${affected ?? 0}.`);
      break;
    case "D11":
      evidence.push(`Baris admins: ${affected ?? 0} (status rencana DEFERRED).`);
      break;
    case "D12":
      evidence.push(`Nomor job historis unik: ${affected ?? 0} (seeding job_sequences = P2A).`);
      break;
    default:
      break;
  }
  return evidence;
}

/** Membangun register keputusan owner dari bukti snapshot/dry-run + approval. */
export function buildDecisionRegister(input: DecisionRegisterInput = {}): DecisionRegisterEntry[] {
  const available = input.sourceAvailable ?? input.snapshot !== undefined;
  const counts = affectedRowCounts(input);
  const approvals = (input.approvals ?? []).filter(
    (approval) => approval.approvedBy.trim() !== "" && approval.approvedAt.trim() !== "",
  );

  return DECISION_DEFINITIONS.map((definition) => {
    const approval = approvals.find((candidate) => candidate.decisionId === definition.id);
    const entry: DecisionRegisterEntry = {
      id: definition.id,
      title: definition.title,
      blockingScope: definition.blockingScope,
      requiredApprover: definition.requiredApprover,
      evidenceNeeded: definition.evidenceNeeded,
      options: definition.options,
      affectedRowCount: counts[definition.id],
      evidence: evidenceFor(definition, input, counts[definition.id]),
      approvalState: approval
        ? "APPROVED"
        : available
          ? "NOT_APPROVED"
          : "BLOCKED_SOURCE_UNAVAILABLE",
    };
    if (approval) {
      entry.approvedBy = approval.approvedBy;
      entry.approvedAt = approval.approvedAt;
      entry.approvedOption = approval.optionId;
    }
    return entry;
  });
}

export function isDecisionApproved(
  register: readonly DecisionRegisterEntry[],
  id: DecisionId,
): boolean {
  return register.find((entry) => entry.id === id)?.approvalState === "APPROVED";
}

/** Keputusan yang masih memblokir migrasi (belum disetujui). */
export function blockingDecisions(
  register: readonly DecisionRegisterEntry[],
): DecisionRegisterEntry[] {
  return register.filter((entry) => entry.approvalState !== "APPROVED");
}

/** Keputusan yang memblokir SELURUH migrasi dan belum disetujui. */
export function migrationBlockers(
  register: readonly DecisionRegisterEntry[],
): DecisionRegisterEntry[] {
  return blockingDecisions(register).filter((entry) => entry.blockingScope === "MIGRATION");
}

export const DECISION_IDS: readonly DecisionId[] = DECISION_DEFINITIONS.map(
  (definition) => definition.id,
);

/** Guard: tidak boleh ada `APPROVED` tanpa otorisasi eksplisit. */
export function assertApprovalsAreAuthorized(
  register: readonly DecisionRegisterEntry[],
): void {
  for (const entry of register) {
    if (entry.approvalState === "APPROVED" && (entry.approvedBy ?? "").trim() === "") {
      throw new Error(`Keputusan ${entry.id} berstatus APPROVED tanpa approver eksplisit.`);
    }
  }
}

/** Sheet apa yang menjadi bukti utama sebuah keputusan (untuk laporan). */
export const DECISION_EVIDENCE_SHEETS: Record<DecisionId, readonly SheetTitle[]> = {
  D1: ["crew", "job_crews"],
  D2: ["venues", "jobs"],
  D3: ["jobs", "venues"],
  D4: ["client_payments", "vendor_payments"],
  D5: ["client_payments", "vendor_payments"],
  D6: ["expenses", "vendor_payments", "job_crews"],
  D7: ["job_crews", "expenses"],
  D8: ["jobs", "job_crews", "deliveries", "client_payments", "vendor_payments", "expenses"],
  D9: ["expenses"],
  D10: ["client_payments", "vendor_payments"],
  D11: ["admins"],
  D12: ["jobs"],
};

/** Header kontrak yang relevan bagi sebuah keputusan (audit dokumen). */
export function decisionEvidenceHeaders(id: DecisionId): Record<string, string[]> {
  return Object.fromEntries(
    DECISION_EVIDENCE_SHEETS[id].map((sheet) => [sheet, [...SHEET_HEADERS[sheet]]]),
  );
}
