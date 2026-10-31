"use server";

import { revalidatePath } from "next/cache";

import type { Cashflow, ClientPaymentTerm, VendorPaymentType } from "@/domain/types";
import { isClientPaymentTerm, isVendorPaymentType } from "@/domain/validation";
import { formatCurrency, parseAmountInput } from "@/lib/utils";
import { compareAmounts, fromMinorUnits, sumAmounts, toMinorUnits } from "@/domain/money";
import {
  createClientSchedule,
  createVendorSchedule,
  recordClientPayment,
  recordExpense,
  recordVendorPayment,
  rebalanceClientPaymentSchedules,
  rebalanceVendorPaymentSchedules,
  updateClientSchedule,
  updateVendorSchedule,
} from "@/services/job-service";
import { getApplication } from "@/services/runtime";
import { assertAuthenticatedAdmin } from "@/lib/auth";

export type FinanceActionResult = { ok: true } | { ok: false; error: string };

const GENERAL_EXPENSE_CATEGORIES = ["INTERNET", "ELECTRICITY", "SALARY", "RENT", "EQUIPMENT", "SUPPLIES"] as const;
type GeneralExpenseCategory = (typeof GENERAL_EXPENSE_CATEGORIES)[number];

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}

async function revalidateFinance(jobId?: string): Promise<void> {
  revalidatePath("/finance");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  if (jobId) {
    const job = await getApplication().services.jobs.getJobById(jobId);
    if (job) revalidatePath(`/jobs/${job.jobNumber}`);
  }
}

async function run(
  action: () => Promise<string | undefined>,
): Promise<FinanceActionResult> {
  try {
    await assertAuthenticatedAdmin();
    const jobId = await action();
    await revalidateFinance(jobId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

function requireAmount(values: Record<string, string>, label: string): string {
  const amount = parseAmountInput(values.amount);
  if (amount === null) throw new Error(`${label} harus angka valid (> 0).`);
  return amount;
}

function requireDate(values: Record<string, string>, key: string, label: string): string {
  const value = values[key]?.trim();
  if (!value) throw new Error(`${label} is required diisi.`);
  return value;
}

function requireIdempotencyKey(values: Record<string, string>): string {
  const key = values.idempotencyKey?.trim();
  if (!key) throw new Error("An idempotency key is required to record a cash movement.");
  return key;
}

function ensureWithinJobPaymentBalance(
  schedules: ReadonlyArray<{ id: string; amount: string }>,
  cashflows: readonly Cashflow[],
  referenceType: "client_payment" | "vendor_payment",
  amount: string,
): void {
  const scheduleIds = new Set(schedules.map((schedule) => schedule.id));
  const paid = sumAmounts(cashflows
    .filter((flow) => flow.referenceType === referenceType && flow.referenceId && scheduleIds.has(flow.referenceId))
    .map((flow) => flow.amount));
  const obligation = sumAmounts(schedules.map((schedule) => schedule.amount));
  const remainingMinor = toMinorUnits(obligation) - toMinorUnits(paid);
  const remaining = fromMinorUnits(remainingMinor > BigInt(0) ? remainingMinor : BigInt(0));
  if (compareAmounts(amount, remaining) > 0) {
    throw new Error(`Nominal pembayaran melebihi sisa harga paket. Maksimal yang dapat dicatat: ${formatCurrency(remaining)}.`);
  }
}

/* -------------------------------------------------------------------------- */
/* Payment schedules (OBLIGATIONS — no cash movement, no stored status)       */
/* -------------------------------------------------------------------------- */

export async function createClientScheduleAction(
  values: Record<string, string>,
): Promise<FinanceActionResult> {
  return run(async () => {
    const jobId = values.jobId?.trim();
    if (!jobId) throw new Error("Please select a job.");
    const term = values.term?.trim() as ClientPaymentTerm;
    if (!isClientPaymentTerm(term)) throw new Error("Invalid installment.");
    await createClientSchedule({
      jobId,
      term,
      amount: requireAmount(values, "Amount"),
      dueDate: values.dueDate?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    });
    return jobId;
  });
}

export async function updateClientScheduleAction(
  id: string,
  values: Record<string, string>,
): Promise<FinanceActionResult> {
  return run(async () => {
    const jobId = values.jobId?.trim();
    if (!jobId) throw new Error("Please select a job.");
    const term = values.term?.trim() as ClientPaymentTerm;
    if (!isClientPaymentTerm(term)) throw new Error("Invalid installment.");
    await updateClientSchedule(id, {
      jobId,
      term,
      amount: requireAmount(values, "Amount"),
      dueDate: values.dueDate?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    });
    return jobId;
  });
}

export async function createVendorScheduleAction(
  values: Record<string, string>,
): Promise<FinanceActionResult> {
  return run(async () => {
    const jobId = values.jobId?.trim();
    if (!jobId) throw new Error("Please select a job.");
    const type = values.type?.trim() as VendorPaymentType;
    if (!isVendorPaymentType(type)) throw new Error("Invalid vendor payment type.");
    await createVendorSchedule({
      jobId,
      type,
      amount: requireAmount(values, "Amount"),
      dueDate: values.dueDate?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    });
    return jobId;
  });
}

export async function updateVendorScheduleAction(
  id: string,
  values: Record<string, string>,
): Promise<FinanceActionResult> {
  return run(async () => {
    const jobId = values.jobId?.trim();
    if (!jobId) throw new Error("Please select a job.");
    const type = values.type?.trim() as VendorPaymentType;
    if (!isVendorPaymentType(type)) throw new Error("Invalid vendor payment type.");
    await updateVendorSchedule(id, {
      jobId,
      type,
      amount: requireAmount(values, "Amount"),
      dueDate: values.dueDate?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
    });
    return jobId;
  });
}

/* -------------------------------------------------------------------------- */
/* ACTUAL CASH (canonical cashflows; idempotent, atomic)                      */
/* -------------------------------------------------------------------------- */

export async function recordClientPaymentAction(
  values: Record<string, string>,
): Promise<FinanceActionResult> {
  return run(async () => {
    const scheduleId = values.scheduleId?.trim();
    if (!scheduleId) throw new Error("Please select a client payment schedule.");
    const app = getApplication();
    const selectedSchedule = await app.repositories.clientPaymentSchedules.getById(scheduleId);
    if (!selectedSchedule) throw new Error("Client payment schedule tidak ditemukan.");
    const amount = requireAmount(values, "Amount");
    const [schedulesBeforePayment, cashflowsBeforePayment] = await Promise.all([
      app.repositories.clientPaymentSchedules.getByJobId(selectedSchedule.jobId),
      app.repositories.cashflows.getByJobId(selectedSchedule.jobId),
    ]);
    ensureWithinJobPaymentBalance(schedulesBeforePayment, cashflowsBeforePayment, "client_payment", amount);
    await recordClientPayment({
      scheduleId,
      amount,
      occurredOn: requireDate(values, "occurredOn", "Payment date"),
      description: values.description?.trim() || undefined,
      idempotencyKey: requireIdempotencyKey(values),
    });
    await rebalanceAndSaveClientSchedules(selectedSchedule.jobId);
    return selectedSchedule.jobId;
  });
}

async function rebalanceAndSaveClientSchedules(jobId: string): Promise<void> {
  const app = getApplication();
  const schedules = await app.repositories.clientPaymentSchedules.getByJobId(jobId);
  const cashflows = await app.repositories.cashflows.getByJobId(jobId);
  const rebalanced = new Map(
    rebalanceClientPaymentSchedules(schedules, cashflows).map((schedule) => [schedule.id, schedule]),
  );
  for (const schedule of schedules) {
    const adjusted = rebalanced.get(schedule.id);
    if (!adjusted) {
      await app.repositories.clientPaymentSchedules.delete(schedule.id);
    } else if (adjusted.amount !== schedule.amount) {
      await updateClientSchedule(schedule.id, { ...schedule, amount: adjusted.amount });
    }
  }
}

export async function recordVendorPaymentAction(
  values: Record<string, string>,
): Promise<FinanceActionResult> {
  return run(async () => {
    const scheduleId = values.scheduleId?.trim();
    if (!scheduleId) throw new Error("Please select a vendor payment schedule.");
    const app = getApplication();
    const selectedSchedule = await app.repositories.vendorPaymentSchedules.getById(scheduleId);
    if (!selectedSchedule) throw new Error("Vendor payment schedule tidak ditemukan.");
    const amount = requireAmount(values, "Amount");
    const [schedulesBeforePayment, cashflowsBeforePayment] = await Promise.all([
      app.repositories.vendorPaymentSchedules.getByJobId(selectedSchedule.jobId),
      app.repositories.cashflows.getByJobId(selectedSchedule.jobId),
    ]);
    ensureWithinJobPaymentBalance(schedulesBeforePayment, cashflowsBeforePayment, "vendor_payment", amount);
    await recordVendorPayment({
      scheduleId,
      amount,
      occurredOn: requireDate(values, "occurredOn", "Payment date"),
      description: values.description?.trim() || undefined,
      idempotencyKey: requireIdempotencyKey(values),
    });
    const [schedules, cashflows] = await Promise.all([
      app.repositories.vendorPaymentSchedules.getByJobId(selectedSchedule.jobId),
      app.repositories.cashflows.getByJobId(selectedSchedule.jobId),
    ]);
    const rebalanced = new Map(
      rebalanceVendorPaymentSchedules(schedules, cashflows).map((schedule) => [schedule.id, schedule]),
    );
    for (const schedule of schedules) {
      const adjusted = rebalanced.get(schedule.id);
      if (!adjusted) {
        await app.repositories.vendorPaymentSchedules.delete(schedule.id);
      } else if (adjusted.amount !== schedule.amount) {
        await updateVendorSchedule(schedule.id, { ...schedule, amount: adjusted.amount });
      }
    }
    return selectedSchedule.jobId;
  });
}

/* -------------------------------------------------------------------------- */
/* General operational expenses (canonical cashflow, job optional)            */
/* -------------------------------------------------------------------------- */

export async function recordExpenseAction(
  values: Record<string, string>,
): Promise<FinanceActionResult> {
  return run(async () => {
    const category = values.category?.trim() as GeneralExpenseCategory;
    if (!GENERAL_EXPENSE_CATEGORIES.includes(category)) {
      throw new Error("Kategori expense tidak valid.");
    }
    const description = values.description?.trim();
    if (!description) throw new Error("Description biaya is required diisi.");
    const jobId = values.jobId?.trim() || undefined;
    await recordExpense({
      jobId,
      category,
      amount: requireAmount(values, "Amount"),
      occurredOn: requireDate(values, "occurredOn", "Expense date"),
      description,
      idempotencyKey: requireIdempotencyKey(values),
    });
    return jobId;
  });
}
