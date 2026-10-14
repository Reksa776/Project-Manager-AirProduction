import {
  addAmounts,
  compareAmounts,
  parseAmount,
  subtractAmounts,
  ZERO_AMOUNT,
  type Amount,
} from "@/domain/money";
import type { CashflowCategory, CashflowDirection, CashflowReferenceType } from "@/domain/types";

/**
 * TOTAL FINANSIAL REKONSILIASI (P0D-1).
 *
 * Semua aritmetika memakai `Amount` (string desimal) + minor units `BigInt` dari
 * `src/domain/money.ts`. **Tidak ada penjumlahan floating point JavaScript.**
 *
 * Rekonsiliasi didefinisikan per:
 * - Job (`jobId`), kategori, dan referensi pembayaran;
 * - INCOME, EXPENSE, NET;
 * - obligasi (jadwal/kesepakatan crew) dan outstanding (obligasi − kas berbukti);
 * - grand total.
 *
 * `compareTotals` menampilkan SETIAP selisih (tidak ada perbedaan tersembunyi).
 */

export interface CashflowLike {
  jobId?: string;
  direction: CashflowDirection;
  category: CashflowCategory;
  amount: Amount | number | string;
  referenceType?: CashflowReferenceType;
  referenceId?: string;
}

export interface ObligationLike {
  jobId: string;
  kind: "client" | "vendor" | "crew";
  referenceId: string;
  amount: Amount | number | string;
}

export interface FinancialTotals {
  income: Amount;
  expense: Amount;
  net: Amount;
}

export interface ReconciliationTotals {
  grand: FinancialTotals;
  /** Total per job (kunci diurutkan untuk determinisme). */
  byJob: Record<string, FinancialTotals>;
  /** Total kas per kategori (nilai absolut, arah diabaikan). */
  byCategory: Record<string, Amount>;
  /** Total kas per referensi `referenceType:referenceId`. */
  byReference: Record<string, Amount>;
  obligation: { client: Amount; vendor: Amount; crew: Amount; total: Amount };
  paid: { client: Amount; vendor: Amount; crew: Amount; total: Amount };
  /** obligasi − kas, per jenis; tidak pernah negatif. */
  outstanding: { client: Amount; vendor: Amount; crew: Amount; total: Amount };
}

function emptyTotals(): FinancialTotals {
  return { income: ZERO_AMOUNT, expense: ZERO_AMOUNT, net: ZERO_AMOUNT };
}

function addCashflow(totals: FinancialTotals, cashflow: CashflowLike): FinancialTotals {
  const amount = parseAmount(cashflow.amount);
  if (cashflow.direction === "INCOME") {
    const income = addAmounts(totals.income, amount);
    return { income, expense: totals.expense, net: subtractAmounts(income, totals.expense) };
  }
  const expense = addAmounts(totals.expense, amount);
  return { income: totals.income, expense, net: subtractAmounts(totals.income, expense) };
}

function outstandingOf(obligation: Amount, paid: Amount): Amount {
  return compareAmounts(obligation, paid) > 0 ? subtractAmounts(obligation, paid) : ZERO_AMOUNT;
}

const PAID_BUCKET: Partial<Record<CashflowCategory, "client" | "vendor" | "crew">> = {
  CLIENT_PAYMENT: "client",
  VENDOR_PAYMENT: "vendor",
  CREW_PAYMENT: "crew",
};

export function computeReconciliationTotals(input: {
  cashflows: readonly CashflowLike[];
  obligations: readonly ObligationLike[];
}): ReconciliationTotals {
  let grand = emptyTotals();
  const byJob = new Map<string, FinancialTotals>();
  const byCategory = new Map<string, Amount>();
  const byReference = new Map<string, Amount>();

  for (const cashflow of input.cashflows) {
    const amount = parseAmount(cashflow.amount);
    grand = addCashflow(grand, cashflow);

    const jobKey = cashflow.jobId ?? "(tanpa-job)";
    byJob.set(jobKey, addCashflow(byJob.get(jobKey) ?? emptyTotals(), cashflow));

    byCategory.set(cashflow.category, addAmounts(byCategory.get(cashflow.category) ?? ZERO_AMOUNT, amount));

    if (cashflow.referenceType && cashflow.referenceId) {
      const referenceKey = `${cashflow.referenceType}:${cashflow.referenceId}`;
      byReference.set(referenceKey, addAmounts(byReference.get(referenceKey) ?? ZERO_AMOUNT, amount));
    }
  }

  const obligation = { client: ZERO_AMOUNT, vendor: ZERO_AMOUNT, crew: ZERO_AMOUNT, total: ZERO_AMOUNT };
  for (const item of input.obligations) {
    const amount = parseAmount(item.amount);
    obligation[item.kind] = addAmounts(obligation[item.kind], amount);
    obligation.total = addAmounts(obligation.total, amount);
  }

  const paid = { client: ZERO_AMOUNT, vendor: ZERO_AMOUNT, crew: ZERO_AMOUNT, total: ZERO_AMOUNT };
  for (const cashflow of input.cashflows) {
    const bucket = PAID_BUCKET[cashflow.category];
    if (!bucket) continue;
    const amount = parseAmount(cashflow.amount);
    paid[bucket] = addAmounts(paid[bucket], amount);
    paid.total = addAmounts(paid.total, amount);
  }

  return {
    grand,
    byJob: Object.fromEntries([...byJob.keys()].sort().map((key) => [key, byJob.get(key)!])),
    byCategory: Object.fromEntries([...byCategory.keys()].sort().map((key) => [key, byCategory.get(key)!])),
    byReference: Object.fromEntries(
      [...byReference.keys()].sort().map((key) => [key, byReference.get(key)!]),
    ),
    obligation,
    paid,
    outstanding: {
      client: outstandingOf(obligation.client, paid.client),
      vendor: outstandingOf(obligation.vendor, paid.vendor),
      crew: outstandingOf(obligation.crew, paid.crew),
      total: outstandingOf(obligation.total, paid.total),
    },
  };
}

export interface TotalDiscrepancy {
  scope: string;
  field: string;
  expected: Amount;
  actual: Amount;
  difference: Amount;
}

export interface TotalsComparison {
  matched: boolean;
  discrepancies: TotalDiscrepancy[];
}

const TOTAL_FIELDS: readonly (keyof FinancialTotals)[] = ["income", "expense", "net"];

/** Bandingkan dua kumpulan total (mis. sebelum vs sesudah migrasi) per field & per job. */
export function compareTotals(
  expected: ReconciliationTotals,
  actual: ReconciliationTotals,
): TotalsComparison {
  const discrepancies: TotalDiscrepancy[] = [];

  const pushDiscrepancy = (scope: string, field: string, left: Amount, right: Amount): void => {
    if (compareAmounts(left, right) !== 0) {
      discrepancies.push({
        scope,
        field,
        expected: left,
        actual: right,
        difference: subtractAmounts(left, right),
      });
    }
  };

  for (const field of TOTAL_FIELDS) {
    pushDiscrepancy("grand", field, expected.grand[field], actual.grand[field]);
  }
  for (const field of ["client", "vendor", "crew", "total"] as const) {
    pushDiscrepancy("obligation", field, expected.obligation[field], actual.obligation[field]);
    pushDiscrepancy("paid", field, expected.paid[field], actual.paid[field]);
    pushDiscrepancy("outstanding", field, expected.outstanding[field], actual.outstanding[field]);
  }

  const jobKeys = new Set([...Object.keys(expected.byJob), ...Object.keys(actual.byJob)]);
  for (const jobId of [...jobKeys].sort()) {
    const left = expected.byJob[jobId] ?? emptyTotals();
    const right = actual.byJob[jobId] ?? emptyTotals();
    for (const field of TOTAL_FIELDS) {
      pushDiscrepancy(`job:${jobId}`, field, left[field], right[field]);
    }
  }

  const categoryKeys = new Set([...Object.keys(expected.byCategory), ...Object.keys(actual.byCategory)]);
  for (const category of [...categoryKeys].sort()) {
    pushDiscrepancy(
      `category:${category}`,
      "amount",
      expected.byCategory[category] ?? ZERO_AMOUNT,
      actual.byCategory[category] ?? ZERO_AMOUNT,
    );
  }

  const referenceKeys = new Set([...Object.keys(expected.byReference), ...Object.keys(actual.byReference)]);
  for (const reference of [...referenceKeys].sort()) {
    pushDiscrepancy(
      `reference:${reference}`,
      "amount",
      expected.byReference[reference] ?? ZERO_AMOUNT,
      actual.byReference[reference] ?? ZERO_AMOUNT,
    );
  }

  return { matched: discrepancies.length === 0, discrepancies };
}

/** Total sederhana dengan aritmetika desimal aman (tanpa `number`). */
export function totalAmounts(amounts: readonly (Amount | number | string)[]): Amount {
  let total = ZERO_AMOUNT;
  for (const amount of amounts) total = addAmounts(total, parseAmount(amount));
  return total;
}
