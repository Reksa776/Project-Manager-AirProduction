import { derivePaymentStatus } from "@/domain/finance";
import { parseAmount, type Amount } from "@/domain/money";
import {
  reconcileStoredPaymentStatus,
  type ReconciliationIssue,
} from "@/domain/reconciliation";
import { isPaymentStatus } from "@/domain/validation";
import type { PaymentStatus } from "@/domain/types";

/**
 * REKONSILIASI BUKTI PEMBAYARAN (P0D-1).
 *
 * Prinsip yang dipertahankan: **status tersimpan bukan bukti kas**. Kas hanya
 * boleh diajukan bila ada bukti (untuk jadwal: `paid_date`), dan usulan itu
 * tetap berstatus PROPOSED sampai disetujui.
 *
 * Aturan usulan:
 * - `PAID` + `paid_date` → usulkan kas sebesar nominal penuh pada tanggal itu (PROPOSED).
 * - `PAID` tanpa `paid_date` → RECONCILIATION_REQUIRED (tanggal kas tidak diketahui).
 * - `PARTIAL` → RECONCILIATION_REQUIRED (nominal parsial TIDAK tersimpan; dilarang dikarang).
 * - `UNPAID` + ada `paid_date` → RECONCILIATION_REQUIRED (bertentangan).
 * - `UNPAID` tanpa `paid_date` → tidak ada kas.
 * - status tak dikenal → RECONCILIATION_REQUIRED.
 *
 * Untuk assignment crew, kas TIDAK PERNAH diajukan otomatis: `job_crews.payment`
 * adalah KESEPAKATAN (obligasi) dan `payment_status` tersimpan tidak dapat
 * dianggap bukti kas (tidak ada referensi pembayaran pada sumber).
 */

export type PaymentEvidenceStatus =
  | "PROPOSED_CASH"
  | "OBLIGATION_ONLY"
  | "NO_CASH"
  | "RECONCILIATION_REQUIRED";

export interface ProposedCashEvidence {
  amount: Amount;
  occurredOn: string;
  /** Dasar bukti yang dipakai (harus disetujui sebelum dipakai menulis kas). */
  basis: "stored_status=PAID + paid_date";
  requiresApproval: true;
}

export interface SchedulePaymentReconciliation {
  status: PaymentEvidenceStatus;
  /** Status yang benar-benar dapat diturunkan dari kas berbukti. */
  derivedStatus: PaymentStatus;
  /** Kas yang DIAJUKAN (belum disetujui) bila ada bukti. */
  proposedCash?: ProposedCashEvidence;
  issues: ReconciliationIssue[];
  audit: Record<string, string>;
}

function hasText(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== "";
}

/** Rekonsiliasi satu jadwal pembayaran (client/vendor). */
export function reconcileSchedulePayment(input: {
  amount: Amount | number | string;
  storedStatus: string;
  paidDate?: string;
}): SchedulePaymentReconciliation {
  const amount = parseAmount(input.amount);
  const storedStatus = (input.storedStatus ?? "").trim().toUpperCase();
  const paidDate = input.paidDate?.trim();
  const audit: Record<string, string> = {
    source_amount: amount,
    source_status: input.storedStatus,
    source_paid_date: paidDate ?? "",
  };
  const noCashDerived = derivePaymentStatus(amount, "0.00");

  if (!isPaymentStatus(storedStatus)) {
    return {
      status: "RECONCILIATION_REQUIRED",
      derivedStatus: noCashDerived,
      issues: [
        {
          code: "UNKNOWN_STORED_STATUS",
          message: `Status pembayaran tersimpan '${input.storedStatus}' tidak dikenal.`,
          field: "status",
        },
      ],
      audit,
    };
  }

  if (storedStatus === "UNPAID") {
    if (hasText(paidDate)) {
      return {
        status: "RECONCILIATION_REQUIRED",
        derivedStatus: noCashDerived,
        issues: [
          {
            code: "STATUS_EVIDENCE_CONFLICT",
            message: `Jadwal berstatus UNPAID tetapi memiliki paid_date '${paidDate}'; kontradiksi harus diselesaikan manual (tidak ada kas yang dikarang).`,
            field: "paid_date",
          },
        ],
        audit,
      };
    }
    return { status: "NO_CASH", derivedStatus: noCashDerived, issues: [], audit };
  }

  if (storedStatus === "PARTIAL") {
    return {
      status: "RECONCILIATION_REQUIRED",
      derivedStatus: noCashDerived,
      issues: [
        {
          code: "PARTIAL_AMOUNT_UNKNOWN",
          message: hasText(paidDate)
            ? `Jadwal PARTIAL dengan paid_date '${paidDate}' membuktikan ada kas, tetapi nominal parsial tidak tersimpan; nominal tidak boleh dikarang.`
            : "Jadwal PARTIAL tanpa nominal parsial yang tersimpan; nominal tidak boleh dikarang.",
          field: "amount",
        },
      ],
      audit,
    };
  }

  // storedStatus === "PAID"
  if (!hasText(paidDate)) {
    return {
      status: "RECONCILIATION_REQUIRED",
      derivedStatus: noCashDerived,
      issues: [
        {
          code: "MISSING_PAID_DATE",
          message: "Jadwal berstatus PAID tanpa paid_date; tanggal kas tidak dapat ditentukan tanpa keputusan manual.",
          field: "paid_date",
        },
      ],
      audit,
    };
  }

  const proposedCash: ProposedCashEvidence = {
    amount,
    occurredOn: paidDate,
    basis: "stored_status=PAID + paid_date",
    requiresApproval: true,
  };
  const consistency = reconcileStoredPaymentStatus(
    storedStatus,
    derivePaymentStatus(amount, amount),
  );
  return {
    status: "PROPOSED_CASH",
    derivedStatus: consistency.value?.derivedStatus ?? "PAID",
    proposedCash,
    issues: consistency.issues,
    audit,
  };
}

export interface CrewAssignmentEvidenceInput {
  agreedAmount: Amount | number | string;
  storedStatus?: string;
  /** Expense CREW dengan nominal sama pada job yang sama (kandidat bukti, bukan keputusan). */
  candidateExpenseIds?: readonly string[];
}

export interface CrewAssignmentReconciliation {
  status: "OBLIGATION_ONLY" | "RECONCILIATION_REQUIRED";
  /** `job_crews.payment` = kesepakatan (obligasi), bukan kas. */
  obligationAmount: Amount;
  /** Kas crew TIDAK PERNAH diajukan otomatis. */
  proposedCash?: undefined;
  candidateExpenseIds: string[];
  issues: ReconciliationIssue[];
}

/** Rekonsiliasi satu assignment crew (obligasi vs kas berbukti). */
export function reconcileCrewAssignmentPayment(
  input: CrewAssignmentEvidenceInput,
): CrewAssignmentReconciliation {
  const obligationAmount = parseAmount(input.agreedAmount);
  const storedStatus = (input.storedStatus ?? "").trim().toUpperCase();
  const candidateExpenseIds = [...(input.candidateExpenseIds ?? [])].sort();

  if (storedStatus === "" || storedStatus === "UNPAID") {
    return {
      status: "OBLIGATION_ONLY",
      obligationAmount,
      candidateExpenseIds,
      issues: [],
    };
  }

  const issues: ReconciliationIssue[] = [
    {
      code: "CREW_PAYMENT_STATUS_STORED",
      message:
        "Status pembayaran crew tersimpan tidak dapat dipakai sebagai bukti kas (tidak ada referensi pembayaran crew pada sumber); kas aktual harus ditentukan manual.",
      field: "payment_status",
    },
  ];
  if (candidateExpenseIds.length > 0) {
    issues.push({
      code: "CANDIDATE_EXPENSE_EVIDENCE",
      message: `Ditemukan ${candidateExpenseIds.length} baris expense CREW dengan nominal sama pada job yang sama (${candidateExpenseIds.join(", ")}); perlu keputusan manual untuk memakai/menolaknya sebagai bukti kas.`,
      field: "amount",
    });
  }
  if (storedStatus === "PARTIAL") {
    issues.push({
      code: "PARTIAL_AMOUNT_UNKNOWN",
      message: "Assignment crew berstatus PARTIAL tanpa nominal kas tersimpan; nominal tidak boleh dikarang.",
      field: "payment_status",
    });
  }

  return {
    status: "RECONCILIATION_REQUIRED",
    obligationAmount,
    candidateExpenseIds,
    issues,
  };
}

export function summarizeScheduleReconciliations(
  items: readonly SchedulePaymentReconciliation[],
): Record<PaymentEvidenceStatus, number> {
  const summary: Record<PaymentEvidenceStatus, number> = {
    PROPOSED_CASH: 0,
    OBLIGATION_ONLY: 0,
    NO_CASH: 0,
    RECONCILIATION_REQUIRED: 0,
  };
  for (const item of items) summary[item.status] += 1;
  return summary;
}
