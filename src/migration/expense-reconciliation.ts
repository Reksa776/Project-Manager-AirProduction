import { compareAmounts, parseAmount, type Amount } from "@/domain/money";
import {
  reconcileLegacyExpenseCategory,
  type ReconciliationIssue,
} from "@/domain/reconciliation";
import type { CashflowCategory } from "@/domain/types";

/**
 * REKONSILIASI EXPENSE HISTORIS → CASHFLOW (P0D-1, aturan diperketat P0D-2A).
 *
 * Sumber: worksheet `expenses` (kolom `category` bebas, antara lain
 * `CREW`/`VENDOR`/`TRANSPORT`/`EQUIPMENT`/`OTHER`).
 *
 * KOREKSI ATURAN DUPLIKAT (P0D-2A §6):
 * nominal yang SAMA pada job yang sama **hanyalah kandidat** (`POTENTIAL_DUPLICATE`).
 * Nominal sama BUKAN bukti dan TIDAK BOLEH otomatis menjadi `SKIP_DUPLICATE`
 * maupun menghasilkan kas. Duplikat hanya boleh dinyatakan terbukti
 * (`PROVEN_DUPLICATE`) bila ada:
 * - referensi eksplisit pada sumber (`sourceReference` yang menunjuk kandidat), atau
 * - keputusan baris-level owner yang terdokumentasi dan disetujui
 *   (`ApprovedDuplicateDecision`, wajib memuat `approvedBy`).
 *
 * Empat status hasil klasifikasi:
 * - `READY` — biaya umum deterministik; aman untuk impor sebagai kas EXPENSE.
 * - `PROVEN_DUPLICATE` — bukti kuat; baris expense dilewati (kas dari jadwal).
 * - `POTENTIAL_DUPLICATE` — kesamaan sirkumstansial; butuh keputusan manual,
 *   TIDAK menghasilkan kas dan TIDAK dilewati otomatis.
 * - `RECONCILIATION_REQUIRED` — bukti tidak cukup/bertentangan; tidak dikonversi.
 */

export type LegacyExpenseClassification =
  | "READY"
  | "PROVEN_DUPLICATE"
  | "POTENTIAL_DUPLICATE"
  | "RECONCILIATION_REQUIRED";

/** Jenis bukti yang mendasari klasifikasi (audit). */
export type ExpenseDuplicateEvidence =
  | "NONE"
  | "EQUAL_AMOUNT_CANDIDATE"
  | "EXPLICIT_SOURCE_REFERENCE"
  | "APPROVED_ROW_DECISION";

export interface LegacyExpenseInput {
  id: string;
  jobId: string;
  category: string;
  description: string;
  amount: Amount | number | string;
  date: string;
  notes?: string;
  /**
   * Referensi eksplisit pada baris sumber (mis. catatan spreadsheet memuat ID
   * jadwal/assignment). Hanya dipakai bila benar-benar ada di sumber — tidak
   * pernah dikarang oleh perencana migrasi.
   */
  sourceReference?: string;
}

/** Kandidat pembayaran yang sudah tercatat pada jadwal/assignment (untuk dedup). */
export interface PaymentCandidate {
  referenceType: "client_payment" | "vendor_payment" | "job_crew";
  referenceId: string;
  jobId: string;
  amount: Amount;
}

export interface PaymentCandidateIndex {
  candidates: readonly PaymentCandidate[];
}

/**
 * Keputusan baris-level owner untuk menyatakan satu expense sebagai duplikat
 * yang TERBUKTI. Wajib punya `approvedBy` (tanpa itu, keputusan diabaikan).
 */
export interface ApprovedDuplicateDecision {
  expenseId: string;
  duplicateOf: {
    referenceType: PaymentCandidate["referenceType"];
    referenceId: string;
  };
  approvedBy: string;
  reason: string;
}

export interface ExpenseClassification {
  status: LegacyExpenseClassification;
  /** Kategori cashflow yang diajukan (hanya untuk `READY`). */
  category?: CashflowCategory;
  /** Referensi yang cocok (untuk `PROVEN_DUPLICATE`/`POTENTIAL_DUPLICATE`). */
  matchedReference?: PaymentCandidate;
  /** Semua kandidat dengan nominal sama (audit; tidak dianggap duplikat). */
  candidatesWithSameAmount: PaymentCandidate[];
  /** Dasar klasifikasi; `EQUAL_AMOUNT_CANDIDATE` tidak pernah cukup untuk skip. */
  evidence: ExpenseDuplicateEvidence;
  issues: ReconciliationIssue[];
  audit: Record<string, string>;
}

export interface ClassifyExpenseOptions {
  /** Keputusan owner yang sudah disetujui (satu-satunya jalan dedup non-referensi). */
  approvedDuplicateDecisions?: readonly ApprovedDuplicateDecision[];
}

const CATEGORY_TO_REFERENCE: Record<string, PaymentCandidate["referenceType"]> = {
  CREW: "job_crew",
  VENDOR: "vendor_payment",
};

/** Apakah expense adalah kategori ambigu (berisiko tumpang tindih dengan jadwal). */
export function isAmbiguousExpenseCategory(category: string): boolean {
  return CATEGORY_TO_REFERENCE[category.trim().toUpperCase()] !== undefined;
}

/** Klasifikasi satu baris expense historis. */
export function classifyLegacyExpense(
  expense: LegacyExpenseInput,
  index: PaymentCandidateIndex,
  options: ClassifyExpenseOptions = {},
): ExpenseClassification {
  const normalizedCategory = expense.category.trim().toUpperCase();
  const amount = parseAmount(expense.amount);
  const audit: Record<string, string> = {
    source_category: expense.category,
    normalized_category: normalizedCategory,
    source_amount: amount,
  };

  const sameAmount = index.candidates.filter(
    (candidate) =>
      candidate.jobId === expense.jobId && compareAmounts(candidate.amount, amount) === 0,
  );

  const expectedReference = CATEGORY_TO_REFERENCE[normalizedCategory];
  if (expectedReference) {
    const expectedCandidates = sameAmount.filter(
      (candidate) => candidate.referenceType === expectedReference,
    );

    // (1) Bukti terkuat: referensi eksplisit pada sumber menunjuk kandidat.
    const sourceReference = expense.sourceReference?.trim();
    if (sourceReference !== undefined && sourceReference !== "") {
      const referenced = expectedCandidates.find(
        (candidate) => candidate.referenceId === sourceReference,
      );
      if (referenced) {
        return {
          status: "PROVEN_DUPLICATE",
          matchedReference: referenced,
          candidatesWithSameAmount: sameAmount,
          evidence: "EXPLICIT_SOURCE_REFERENCE",
          issues: [
            {
              code: "PROVEN_DUPLICATE",
              message: `Expense ${normalizedCategory} memiliki referensi eksplisit '${sourceReference}' pada sumber; baris expense dilewati agar pembayaran tidak tercatat dua kali.`,
              field: "category",
            },
          ],
          audit: {
            ...audit,
            matched_reference_type: referenced.referenceType,
            matched_reference_id: referenced.referenceId,
            duplicate_evidence: "EXPLICIT_SOURCE_REFERENCE",
          },
        };
      }
      audit.source_reference_unmatched = sourceReference;
    }

    // (2) Bukti kuat kedua: keputusan baris-level owner yang disetujui.
    const approved = options.approvedDuplicateDecisions?.find(
      (decision) =>
        decision.expenseId === expense.id &&
        decision.approvedBy.trim() !== "" &&
        decision.duplicateOf.referenceType === expectedReference,
    );
    if (approved) {
      const referenced = expectedCandidates.find(
        (candidate) => candidate.referenceId === approved.duplicateOf.referenceId,
      );
      if (referenced) {
        return {
          status: "PROVEN_DUPLICATE",
          matchedReference: referenced,
          candidatesWithSameAmount: sameAmount,
          evidence: "APPROVED_ROW_DECISION",
          issues: [
            {
              code: "PROVEN_DUPLICATE",
              message: `Expense ${normalizedCategory} ditetapkan duplikat dari ${referenced.referenceType} '${referenced.referenceId}' melalui keputusan owner (${approved.approvedBy}); baris expense dilewati.`,
              field: "category",
            },
          ],
          audit: {
            ...audit,
            matched_reference_type: referenced.referenceType,
            matched_reference_id: referenced.referenceId,
            duplicate_evidence: "APPROVED_ROW_DECISION",
            approved_by: approved.approvedBy,
          },
        };
      }
    }

    // (3) Nominal sama = kandidat saja. Tidak dilewati otomatis, tanpa kas.
    const potential = expectedCandidates[0];
    if (potential) {
      return {
        status: "POTENTIAL_DUPLICATE",
        matchedReference: potential,
        candidatesWithSameAmount: sameAmount,
        evidence: "EQUAL_AMOUNT_CANDIDATE",
        issues: [
          {
            code: "POTENTIAL_DUPLICATE",
            message: `Expense ${normalizedCategory} bernominal sama dengan ${potential.referenceType} '${potential.referenceId}' pada job yang sama. Kesamaan nominal HANYA kandidat, bukan bukti: baris ini TIDAK dilewati dan TIDAK menghasilkan kas sampai ada bukti eksplisit atau keputusan owner.`,
            field: "category",
          },
        ],
        audit: {
          ...audit,
          candidate_reference_type: potential.referenceType,
          candidate_reference_id: potential.referenceId,
          duplicate_evidence: "EQUAL_AMOUNT_CANDIDATE",
        },
      };
    }

    return {
      status: "RECONCILIATION_REQUIRED",
      candidatesWithSameAmount: sameAmount,
      evidence: "NONE",
      issues: [
        {
          code: "AMBIGUOUS_EXPENSE_CATEGORY",
          message: `Expense kategori '${normalizedCategory}' ambigu: tidak ada ${expectedReference} dengan nominal sama pada job ini, sehingga tidak dapat dibedakan antara kas crew/vendor aktual dan biaya umum.`,
          field: "category",
        },
      ],
      audit,
    };
  }

  const mapping = reconcileLegacyExpenseCategory(expense.category);
  if (mapping.status !== "OK" || !mapping.value) {
    return {
      status: "RECONCILIATION_REQUIRED",
      candidatesWithSameAmount: sameAmount,
      evidence: "NONE",
      issues: mapping.issues,
      audit,
    };
  }

  return {
    status: "READY",
    category: mapping.value.category,
    candidatesWithSameAmount: sameAmount,
    evidence: sameAmount.length > 0 ? "EQUAL_AMOUNT_CANDIDATE" : "NONE",
    issues:
      sameAmount.length > 0
        ? [
            {
              code: "SAME_AMOUNT_AS_SCHEDULE",
              message: `Biaya umum memiliki nominal sama dengan ${sameAmount.length} baris jadwal/assignment pada job yang sama; mohon dipastikan bukan duplikat.`,
              field: "amount",
            },
          ]
        : [],
    audit,
  };
}

/** Ringkasan klasifikasi untuk laporan rekonsiliasi. */
export function summarizeExpenseClassifications(
  classifications: readonly ExpenseClassification[],
): Record<LegacyExpenseClassification, number> {
  const summary: Record<LegacyExpenseClassification, number> = {
    READY: 0,
    PROVEN_DUPLICATE: 0,
    POTENTIAL_DUPLICATE: 0,
    RECONCILIATION_REQUIRED: 0,
  };
  for (const classification of classifications) summary[classification.status] += 1;
  return summary;
}

/** Bukti duplikat yang benar-benar membolehkan baris dilewati (dan tanpa kas). */
export function isProvenDuplicate(classification: ExpenseClassification): boolean {
  return (
    classification.status === "PROVEN_DUPLICATE" &&
    (classification.evidence === "EXPLICIT_SOURCE_REFERENCE" ||
      classification.evidence === "APPROVED_ROW_DECISION")
  );
}

/**
 * Helper agar pemanggil tidak lupa bahwa klasifikasi ambigu/sirkumstansial
 * tidak boleh ditulis.
 */
export function isImportableExpense(classification: ExpenseClassification): boolean {
  return classification.status === "READY" && classification.category !== undefined;
}
