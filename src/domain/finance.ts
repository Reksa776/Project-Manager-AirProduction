import {
  addAmounts,
  compareAmounts,
  fromMinorUnits,
  parseAmount,
  toMinorUnits,
  ZERO_AMOUNT,
  type Amount,
} from "./money";
import {
  CASHFLOW_CATEGORIES,
  CASHFLOW_DIRECTIONS,
  CASHFLOW_REFERENCE_TYPES,
  type CashflowCategory,
  type CashflowDirection,
  type PaymentStatus,
} from "./types";

/**
 * Kalkulasi finansial murni (tanpa I/O). Semua aritmetika lewat `money.ts`
 * (BigInt minor units) — TIDAK ada floating point.
 *
 * Semantik (locked):
 * - `paymentStatus` selalu DITURUNKAN dari kas aktual, tidak pernah disimpan.
 * - `paidAmount` = total kas yang benar-benar tercatat.
 * - `remainingAmount` = max(obligation - paid, 0).
 * - Kelebihan bayar dilaporkan sebagai `overpaidAmount` (tidak dipotong diam-diam).
 */

export interface PaymentSettlement {
  obligationAmount: Amount;
  paidAmount: Amount;
  remainingAmount: Amount;
  overpaidAmount: Amount;
  overpaid: boolean;
  status: PaymentStatus;
}

/** Satu pergerakan kas minimal yang dibutuhkan untuk perhitungan. */
export interface CashAmount {
  amount: Amount;
}

function resolveAmount(value: Amount): Amount {
  return parseAmount(value);
}

/**
 * Turunkan status dari obligasi vs kas terbayar.
 * - paid <= 0 → UNPAID (nominal 0 termasuk UNPAID)
 * - 0 < paid < obligation → PARTIAL
 * - paid >= obligation → PAID (termasuk overpay)
 */
export function derivePaymentStatus(obligation: Amount, paid: Amount): PaymentStatus {
  const paidMinor = toMinorUnits(resolveAmount(paid));
  const obligationMinor = toMinorUnits(resolveAmount(obligation));
  if (paidMinor <= BigInt(0)) return "UNPAID";
  if (paidMinor >= obligationMinor) return "PAID";
  return "PARTIAL";
}

/** Total kas positif dari daftar catatan kas (nilai negatif ditolak). */
export function sumCashAmounts(cashflows: readonly CashAmount[]): Amount {
  let totalMinor = BigInt(0);
  for (const cashflow of cashflows) {
    const amount = resolveAmount(cashflow.amount);
    const minor = toMinorUnits(amount);
    if (minor < BigInt(0)) {
      throw new Error(`Nominal kas tidak boleh negatif: ${amount}.`);
    }
    totalMinor += minor;
  }
  return fromMinorUnits(totalMinor);
}

/** Settlement lengkap untuk sebuah obligasi (schedule / agreed crew). */
export function deriveSettlement(
  obligationAmount: Amount,
  cashflows: readonly CashAmount[],
): PaymentSettlement {
  const obligation = resolveAmount(obligationAmount);
  const paid = sumCashAmounts(cashflows);
  const obligationMinor = toMinorUnits(obligation);
  const paidMinor = toMinorUnits(paid);

  const remainingMinor = obligationMinor - paidMinor;
  const overpaidMinor = paidMinor - obligationMinor;

  return {
    obligationAmount: obligation,
    paidAmount: paid,
    remainingAmount: remainingMinor > BigInt(0) ? fromMinorUnits(remainingMinor) : ZERO_AMOUNT,
    overpaidAmount: overpaidMinor > BigInt(0) ? fromMinorUnits(overpaidMinor) : ZERO_AMOUNT,
    overpaid: overpaidMinor > BigInt(0),
    status: derivePaymentStatus(obligation, paid),
  };
}

export interface CashflowAggregate {
  income: Amount;
  expense: Amount;
  net: Amount;
}

/** Agregasi income/expense/net dari kas (net boleh negatif). */
export function aggregateCashflows(
  cashflows: readonly { direction: CashflowDirection; amount: Amount }[],
): CashflowAggregate {
  let incomeMinor = BigInt(0);
  let expenseMinor = BigInt(0);
  for (const cashflow of cashflows) {
    const amount = resolveAmount(cashflow.amount);
    const minor = toMinorUnits(amount);
    if (minor < BigInt(0)) {
      throw new Error(`Nominal cashflow tidak boleh negatif: ${amount}.`);
    }
    if (cashflow.direction === "INCOME") incomeMinor += minor;
    else expenseMinor += minor;
  }
  const netMinor = incomeMinor - expenseMinor;
  return {
    income: fromMinorUnits(incomeMinor),
    expense: fromMinorUnits(expenseMinor),
    net: fromMinorUnits(netMinor),
  };
}

/**
 * Idempotency key deterministik untuk pencatatan kas dari sebuah referensi.
 * Dipakai untuk mencegah double-count (bukan pengganti UNIQUE index DB).
 */
export function paymentIdempotencyKey(input: {
  referenceType: string;
  referenceId: string;
  occurredOn: string;
  amount: Amount;
}): string {
  return [
    input.referenceType,
    input.referenceId,
    input.occurredOn,
    parseAmount(input.amount),
  ].join("|");
}

/* -------------------------------------------------------------------------- */
/* Guard invariant cashflow (selaras dengan CHECK di DB)                       */
/* -------------------------------------------------------------------------- */

export interface CashflowDraft {
  direction: CashflowDirection;
  category: CashflowCategory;
  amount: Amount;
  referenceType?: string;
  referenceId?: string;
}

export interface CashflowValidation {
  ok: boolean;
  errors: string[];
}

const INCOME_CATEGORIES: readonly CashflowCategory[] = ["CLIENT_PAYMENT"];
const EXPENSE_CATEGORIES: readonly CashflowCategory[] = [
  "CREW_PAYMENT",
  "VENDOR_PAYMENT",
  "TRANSPORT",
  "EQUIPMENT",
  "OTHER",
];

/** Validasi invariant cashflow tanpa menyentuh DB. */
export function validateCashflow(draft: CashflowDraft): CashflowValidation {
  const errors: string[] = [];

  if (!CASHFLOW_DIRECTIONS.includes(draft.direction)) {
    errors.push(`Direction tidak valid: ${draft.direction}.`);
  }
  if (!CASHFLOW_CATEGORIES.includes(draft.category)) {
    errors.push(`Kategori cashflow tidak valid: ${draft.category}.`);
  }
  try {
    parseAmount(draft.amount);
    if (toMinorUnits(draft.amount) <= BigInt(0)) {
      errors.push("Amount cashflow harus lebih besar dari 0.");
    }
  } catch {
    errors.push(`Amount cashflow tidak valid: ${draft.amount}.`);
  }

  const hasRefType = draft.referenceType !== undefined && draft.referenceType !== "";
  const hasRefId = draft.referenceId !== undefined && draft.referenceId !== "";
  if (hasRefType !== hasRefId) {
    errors.push("referenceType dan referenceId harus diisi bersama-sama atau kosong bersama-sama.");
  }
  if (
    hasRefType &&
    !CASHFLOW_REFERENCE_TYPES.includes(draft.referenceType as (typeof CASHFLOW_REFERENCE_TYPES)[number])
  ) {
    errors.push(`referenceType tidak dikenal: ${draft.referenceType}.`);
  }

  if (draft.direction === "INCOME" && !INCOME_CATEGORIES.includes(draft.category)) {
    errors.push("INCOME hanya boleh berkategori CLIENT_PAYMENT.");
  }
  if (draft.direction === "EXPENSE" && !EXPENSE_CATEGORIES.includes(draft.category)) {
    errors.push("EXPENSE tidak boleh berkategori CLIENT_PAYMENT.");
  }

  return { ok: errors.length === 0, errors };
}

/** Apakah paid sudah menutup obligasi (helper kenyamanan). */
export function isFullyPaid(obligation: Amount, paid: Amount): boolean {
  return compareAmounts(paid, obligation) >= 0 && toMinorUnits(paid) > BigInt(0);
}

/** Penjumlah sederhana (diekspor untuk pemakaian service/UI). */
export function totalOf(amounts: readonly Amount[]): Amount {
  return addAmounts(...amounts);
}
