"use server";

import { revalidatePath } from "next/cache";

import type { ClientPaymentTerm, VendorPaymentType } from "@/domain/types";
import { isClientPaymentTerm, isVendorPaymentType } from "@/domain/validation";
import { parseAmountInput } from "@/lib/utils";
import { compareAmounts, fromMinorUnits, sumAmounts, toMinorUnits } from "@/domain/money";
import {
  createClientSchedule,
  createVendorSchedule,
  recordClientPayment,
  recordExpense,
  recordVendorPayment,
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
    await recordClientPayment({
      scheduleId,
      amount: requireAmount(values, "Amount"),
      occurredOn: requireDate(values, "occurredOn", "Payment date"),
      description: values.description?.trim() || undefined,
      idempotencyKey: requireIdempotencyKey(values),
    });
    if (selectedSchedule.term === "TERMIN_1") await adjustClientInstallmentsAfterDeposit(selectedSchedule.jobId);
    return selectedSchedule.jobId;
  });
}

async function adjustClientInstallmentsAfterDeposit(jobId: string): Promise<void> {
  const app = getApplication();
  const schedules = await app.repositories.clientPaymentSchedules.getByJobId(jobId);
  const deposit = schedules.find((schedule) => schedule.term === "TERMIN_1");
  const second = schedules.find((schedule) => schedule.term === "TERMIN_2");
  const final = schedules.find((schedule) => schedule.term === "TERMIN_3");
  if (!deposit || !final) return;
  const cashflows = await app.repositories.cashflows.getByJobId(jobId);
  const paidBySchedule = (scheduleId: string) => sumAmounts(cashflows
    .filter((flow) => flow.referenceType === "client_payment" && flow.referenceId === scheduleId)
    .map((flow) => flow.amount));
  const depositPaid = paidBySchedule(deposit.id);
  if (compareAmounts(depositPaid, deposit.amount) <= 0) return;

  const excess = toMinorUnits(depositPaid) - toMinorUnits(deposit.amount);
  const secondPaid = second ? paidBySchedule(second.id) : "0.00";
  const finalPaid = paidBySchedule(final.id);
  const secondAmount = second ? toMinorUnits(second.amount) : BigInt(0);
  const secondPaidMinor = toMinorUnits(secondPaid);
  const rawSecondOutstanding = secondAmount - secondPaidMinor;
  const secondOutstanding = rawSecondOutstanding > BigInt(0) ? rawSecondOutstanding : BigInt(0);
  const reduceSecondBy = excess < secondOutstanding ? excess : secondOutstanding;
  const adjustedSecond = secondAmount - reduceSecondBy;
  const excessAfterSecond = excess - reduceSecondBy;
  const rawFinalOutstanding = toMinorUnits(final.amount) - toMinorUnits(finalPaid);
  const finalOutstanding = rawFinalOutstanding > BigInt(0) ? rawFinalOutstanding : BigInt(0);
  const reduceFinalBy = excessAfterSecond < finalOutstanding ? excessAfterSecond : finalOutstanding;
  const adjustedFinal = toMinorUnits(final.amount) - reduceFinalBy;
  await updateClientSchedule(deposit.id, { ...deposit, amount: depositPaid });
  if (second) {
    if (adjustedSecond <= BigInt(0) && secondPaidMinor <= BigInt(0)) await app.repositories.clientPaymentSchedules.delete(second.id);
    else await updateClientSchedule(second.id, { ...second, amount: fromMinorUnits(adjustedSecond) });
  }
  if (adjustedFinal <= BigInt(0)) await app.repositories.clientPaymentSchedules.delete(final.id);
  else await updateClientSchedule(final.id, { ...final, amount: fromMinorUnits(adjustedFinal) });
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
    await recordVendorPayment({
      scheduleId,
      amount: requireAmount(values, "Amount"),
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
