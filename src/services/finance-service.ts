import { eq, sql } from "drizzle-orm";

import { getDb, type Database } from "@/db";
import { cashflows, clientPayments, jobCrews, vendorPayments } from "@/db/schema";
import { deriveSettlement, type PaymentSettlement } from "@/domain/finance";
import type {
  CreateClientPaymentScheduleInput,
  CreateVendorPaymentScheduleInput,
} from "@/domain/inputs";
import { parseAmount, type Amount } from "@/domain/money";
import type {
  Cashflow,
  CashflowCategory,
  ClientPaymentSchedule,
  PaymentStatus,
  VendorPaymentSchedule,
} from "@/domain/types";
import type {
  FinancialOperations,
  PaymentHistoryQuery,
  RecordClientPaymentInput,
  RecordCrewPaymentInput,
  RecordGeneralExpenseInput,
  RecordPaymentResult,
  RecordVendorPaymentInput,
} from "@/repositories/contract";
import {
  RepositoryError,
  RepositoryNotFoundError,
} from "@/repositories/mysql/errors";
import {
  createFinanceRepositories,
  insertCashflow,
  sumPaidForReference,
} from "@/repositories/mysql/finance";
import { requirePositiveAmount } from "@/repositories/mysql/finance/values";

/**
 * Service finansial (P0C-2, di-inject koneksi pada P0C-3).
 *
 * Prinsip:
 * - OBLIGASI (jadwal/`agreed_amount`) dan KAS (`cashflows`) terpisah.
 * - Setiap pencatatan kas = SATU transaksi Drizzle (atomic): insert cashflow
 *   (+ update `paid_date` bila lunas). Gagal → ROLLBACK; tidak ada kas yatim.
 * - Idempotensi ter-dukung database (unique index + sidik jari payload).
 * - Semua input divalidasi di batas service sebelum menyentuh DB.
 * - Status pembayaran SELALU diturunkan dari kas aktual; tidak pernah disimpan.
 *
 * `createFinancialService(resolveDb)` menerima resolver koneksi sehingga seluruh
 * operasi (repository + transaksi) memakai koneksi yang sama dengan yang
 * disuntikkan factory kanonik. Singleton `financialOperations` / `financeService`
 * tetap ada dan memakai `getDb()` secara lazy (tidak membuka koneksi saat import).
 *
 * Tidak mengaktifkan MySQL untuk aplikasi: `getRepositories()` tetap Google.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value: string, field: string): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new RepositoryError(`'${field}' harus berformat YYYY-MM-DD (didapat '${value}').`);
  }
  return value;
}

function requireIdempotencyKey(value: string | undefined): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new RepositoryError("idempotencyKey wajib diisi untuk operasi finansial.");
  }
  return value.trim();
}

const GENERAL_EXPENSE_CATEGORIES: readonly CashflowCategory[] = [
  "TRANSPORT",
  "EQUIPMENT",
  "OTHER",
  "INTERNET",
  "ELECTRICITY",
  "SALARY",
  "RENT",
  "SUPPLIES",
];

export interface CrewSettlement {
  agreedAmount: Amount;
  paidAmount: Amount;
  remainingAmount: Amount;
  overpaid: boolean;
  overpaidAmount: Amount;
  status: PaymentStatus;
}

export interface JobFinancialSummary {
  jobId: string;
  income: Amount;
  expense: Amount;
  net: Amount;
  clientObligation: Amount;
  vendorObligation: Amount;
  crewAgreed: Amount;
  clientPaid: Amount;
  vendorPaid: Amount;
  crewPaid: Amount;
}

function toResult(
  cashflow: Cashflow,
  referenceType: RecordPaymentResult["referenceType"],
  referenceId: string,
  settlement: PaymentSettlement,
): RecordPaymentResult {
  return {
    cashflowId: cashflow.id,
    referenceType,
    referenceId,
    paidAmount: settlement.paidAmount,
    remainingAmount: settlement.remainingAmount,
    status: settlement.status,
  };
}

type TotalRow = { total: string | null };

/**
 * Membangun service finansial dengan koneksi yang disuntikkan.
 * `resolveDb` dipanggil per operasi (bukan saat module import).
 */
export function createFinancialService(resolveDb: () => Database) {
  const repositories = createFinanceRepositories(resolveDb);

  /* ------------------------------------------------------------------------ */
  /* Recording actual payments                                                 */
  /* ------------------------------------------------------------------------ */

  async function recordClientPayment(
    input: RecordClientPaymentInput,
  ): Promise<RecordPaymentResult> {
    const amount = requirePositiveAmount(input.amount, "amount");
    assertDate(input.occurredOn, "occurredOn");
    const key = requireIdempotencyKey(input.idempotencyKey);

    const schedule = await repositories.clientPaymentSchedules.getById(input.scheduleId);
    if (!schedule) throw new RepositoryNotFoundError("client_payments", input.scheduleId);

    return resolveDb().transaction(async (tx) => {
      const cashflow = await insertCashflow(tx, {
        jobId: schedule.jobId,
        occurredOn: input.occurredOn,
        direction: "INCOME",
        category: "CLIENT_PAYMENT",
        amount,
        description: input.description?.trim() || `Pembayaran client (${schedule.term})`,
        referenceType: "client_payment",
        referenceId: schedule.id,
        source: "MANUAL",
        idempotencyKey: key,
      });
      const paid = await sumPaidForReference(tx, "client_payment", schedule.id);
      const settlement = deriveSettlement(schedule.amount, [{ amount: paid }]);
      if (settlement.status === "PAID" && schedule.paidDate !== input.occurredOn) {
        await tx
          .update(clientPayments)
          .set({ paidDate: input.occurredOn })
          .where(eq(clientPayments.id, schedule.id));
      }
      return toResult(cashflow, "client_payment", schedule.id, settlement);
    });
  }

  async function recordVendorPayment(
    input: RecordVendorPaymentInput,
  ): Promise<RecordPaymentResult> {
    const amount = requirePositiveAmount(input.amount, "amount");
    assertDate(input.occurredOn, "occurredOn");
    const key = requireIdempotencyKey(input.idempotencyKey);

    const schedule = await repositories.vendorPaymentSchedules.getById(input.scheduleId);
    if (!schedule) throw new RepositoryNotFoundError("vendor_payments", input.scheduleId);

    return resolveDb().transaction(async (tx) => {
      const cashflow = await insertCashflow(tx, {
        jobId: schedule.jobId,
        occurredOn: input.occurredOn,
        direction: "EXPENSE",
        category: "VENDOR_PAYMENT",
        amount,
        description: input.description?.trim() || `Pembayaran vendor (${schedule.type})`,
        referenceType: "vendor_payment",
        referenceId: schedule.id,
        source: "MANUAL",
        idempotencyKey: key,
      });
      const paid = await sumPaidForReference(tx, "vendor_payment", schedule.id);
      const settlement = deriveSettlement(schedule.amount, [{ amount: paid }]);
      if (settlement.status === "PAID" && schedule.paidDate !== input.occurredOn) {
        await tx
          .update(vendorPayments)
          .set({ paidDate: input.occurredOn })
          .where(eq(vendorPayments.id, schedule.id));
      }
      return toResult(cashflow, "vendor_payment", schedule.id, settlement);
    });
  }

  async function recordCrewPayment(
    input: RecordCrewPaymentInput,
  ): Promise<RecordPaymentResult> {
    const amount = requirePositiveAmount(input.amount, "amount");
    assertDate(input.occurredOn, "occurredOn");
    const key = requireIdempotencyKey(input.idempotencyKey);

    const assignment = await repositories.jobCrewAssignments.getById(input.assignmentId);
    if (!assignment) throw new RepositoryNotFoundError("job_crews", input.assignmentId);

    return resolveDb().transaction(async (tx) => {
      const cashflow = await insertCashflow(tx, {
        jobId: assignment.jobId,
        occurredOn: input.occurredOn,
        direction: "EXPENSE",
        category: "CREW_PAYMENT",
        amount,
        description: input.description?.trim() || "Pembayaran crew",
        referenceType: "job_crew",
        referenceId: assignment.id,
        source: "MANUAL",
        idempotencyKey: key,
      });
      const paid = await sumPaidForReference(tx, "job_crew", assignment.id);
      const settlement = deriveSettlement(assignment.agreedAmount, [{ amount: paid }]);
      return toResult(cashflow, "job_crew", assignment.id, settlement);
    });
  }

  /* ------------------------------------------------------------------------ */
  /* General operational expenses (tanpa Job diperbolehkan)                    */
  /* ------------------------------------------------------------------------ */

  async function recordGeneralExpense(
    input: RecordGeneralExpenseInput,
  ): Promise<Cashflow> {
    const amount = requirePositiveAmount(input.amount, "amount");
    assertDate(input.occurredOn, "occurredOn");
    const key = requireIdempotencyKey(input.idempotencyKey);
    if (!GENERAL_EXPENSE_CATEGORIES.includes(input.category)) {
      throw new RepositoryError(
        `Kategori biaya operasional tidak valid: '${input.category}'.`,
      );
    }
    const description = input.description?.trim();
    if (!description) throw new RepositoryError("Deskripsi biaya operasional wajib diisi.");

    return insertCashflow(resolveDb(), {
      jobId: input.jobId,
      occurredOn: input.occurredOn,
      direction: "EXPENSE",
      category: input.category,
      amount,
      description,
      source: "MANUAL",
      idempotencyKey: key,
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Reads & derivations                                                       */
  /* ------------------------------------------------------------------------ */

  async function readFinancialHistory(query: PaymentHistoryQuery): Promise<Cashflow[]> {
    return repositories.cashflows.query({
      jobId: query.jobId,
      referenceType: query.referenceType,
      referenceId: query.referenceId,
      from: query.from,
      to: query.to,
    });
  }

  async function deriveClientPaymentStatus(scheduleId: string): Promise<PaymentStatus> {
    const schedule = await repositories.clientPaymentSchedules.getById(scheduleId);
    if (!schedule) throw new RepositoryNotFoundError("client_payments", scheduleId);
    const paid = await sumPaidForReference(resolveDb(), "client_payment", scheduleId);
    return deriveSettlement(schedule.amount, [{ amount: paid }]).status;
  }

  async function deriveCrewSettlement(assignmentId: string): Promise<CrewSettlement> {
    const assignment = await repositories.jobCrewAssignments.getById(assignmentId);
    if (!assignment) throw new RepositoryNotFoundError("job_crews", assignmentId);
    const paid = await sumPaidForReference(resolveDb(), "job_crew", assignmentId);
    const settlement = deriveSettlement(assignment.agreedAmount, [{ amount: paid }]);
    return {
      agreedAmount: settlement.obligationAmount,
      paidAmount: settlement.paidAmount,
      remainingAmount: settlement.remainingAmount,
      overpaid: settlement.overpaid,
      overpaidAmount: settlement.overpaidAmount,
      status: settlement.status,
    };
  }

  async function firstTotal(run: () => PromiseLike<TotalRow[]>): Promise<Amount> {
    const rows = await run();
    return parseAmount(rows[0]?.total ?? "0.00");
  }

  async function getJobFinancialSummary(jobId: string): Promise<JobFinancialSummary> {
    const db = resolveDb();
    const paidByCategory = (category: CashflowCategory) =>
      firstTotal(() =>
        db
          .select({ total: sql<string>`cast(coalesce(sum(${cashflows.amount}), 0) as char)` })
          .from(cashflows)
          .where(sql`${cashflows.jobId} = ${jobId} and ${cashflows.category} = ${category}`),
      );

    const [totals, clientObligation, vendorObligation, crewAgreed, clientPaid, vendorPaid, crewPaid] =
      await Promise.all([
        repositories.cashflows.totals({ jobId }),
        firstTotal(() =>
          db
            .select({ total: sql<string>`cast(coalesce(sum(${clientPayments.amount}), 0) as char)` })
            .from(clientPayments)
            .where(eq(clientPayments.jobId, jobId)),
        ),
        firstTotal(() =>
          db
            .select({ total: sql<string>`cast(coalesce(sum(${vendorPayments.amount}), 0) as char)` })
            .from(vendorPayments)
            .where(eq(vendorPayments.jobId, jobId)),
        ),
        firstTotal(() =>
          db
            .select({ total: sql<string>`cast(coalesce(sum(${jobCrews.agreedAmount}), 0) as char)` })
            .from(jobCrews)
            .where(eq(jobCrews.jobId, jobId)),
        ),
        paidByCategory("CLIENT_PAYMENT"),
        paidByCategory("VENDOR_PAYMENT"),
        paidByCategory("CREW_PAYMENT"),
      ]);

    return {
      jobId,
      income: totals.income,
      expense: totals.expense,
      net: totals.net,
      clientObligation,
      vendorObligation,
      crewAgreed,
      clientPaid,
      vendorPaid,
      crewPaid,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Schedule operations (obligations)                                         */
  /* ------------------------------------------------------------------------ */

  async function createClientPaymentSchedule(
    data: CreateClientPaymentScheduleInput,
  ): Promise<ClientPaymentSchedule> {
    return repositories.clientPaymentSchedules.create(data);
  }

  async function updateClientPaymentSchedule(
    id: string,
    data: CreateClientPaymentScheduleInput,
  ): Promise<ClientPaymentSchedule> {
    return repositories.clientPaymentSchedules.update(id, data);
  }

  async function createVendorPaymentSchedule(
    data: CreateVendorPaymentScheduleInput,
  ): Promise<VendorPaymentSchedule> {
    return repositories.vendorPaymentSchedules.create(data);
  }

  async function updateVendorPaymentSchedule(
    id: string,
    data: CreateVendorPaymentScheduleInput,
  ): Promise<VendorPaymentSchedule> {
    return repositories.vendorPaymentSchedules.update(id, data);
  }

  return {
    repositories,
    createClientPaymentSchedule,
    createVendorPaymentSchedule,
    updateClientPaymentSchedule,
    updateVendorPaymentSchedule,
    recordClientPayment,
    recordVendorPayment,
    recordCrewPayment,
    recordGeneralExpense,
    readCashflows: readFinancialHistory,
    readFinancialHistory,
    deriveClientPaymentStatus,
    deriveCrewSettlement,
    getJobFinancialSummary,
  };
}

/** Bentuk instance service finansial (kontrak + helper tambahan). */
export type FinancialService = ReturnType<typeof createFinancialService>;

/** Singleton lama — resolusi koneksi lazy, tidak membuka koneksi saat import. */
const defaultFinancialService: FinancialService = createFinancialService(getDb);

/** Implementasi kontrak `FinancialOperations` (Contract v2). */
export const financialOperations: FinancialOperations = defaultFinancialService;

export const financeService: FinancialService = defaultFinancialService;

export const readFinancialHistory = defaultFinancialService.readFinancialHistory;
export const deriveClientPaymentStatus = defaultFinancialService.deriveClientPaymentStatus;
export const deriveCrewSettlement = defaultFinancialService.deriveCrewSettlement;
export const getJobFinancialSummary = defaultFinancialService.getJobFinancialSummary;
