"use server";

import { revalidatePath } from "next/cache";

import {
  createClientPayment,
  createExpense,
  createVendorPayment,
  deleteClientPayment,
  deleteExpense,
  deleteVendorPayment,
  updateClientPayment,
  updateExpense,
  updateVendorPayment,
} from "@/services/job-service";
import type {
  ClientPaymentTerm,
  PaymentStatus,
  VendorPaymentType,
} from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/labels";

export type FinanceActionResult = { ok: true } | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}

async function run(action: () => Promise<unknown>): Promise<FinanceActionResult> {
  try {
    await action();
    revalidatePath("/finance");
    revalidatePath("/jobs");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

const TERM_OPTIONS: ClientPaymentTerm[] = ["TERMIN_1", "TERMIN_2", "TERMIN_3"];
const TYPE_OPTIONS: VendorPaymentType[] = ["DP", "PELUNASAN"];
const STATUS_OPTIONS: PaymentStatus[] = ["UNPAID", "PARTIAL", "PAID"];
const EXPENSE_CATEGORY_OPTIONS: readonly string[] = EXPENSE_CATEGORIES;

function parseAmount(raw: string | undefined): number {
  if (!raw || !raw.trim()) return NaN;
  return Number(raw.replace(/\./g, "").replace(/,/g, "").trim());
}

/* Client payments */
export async function createClientPaymentAction(values: Record<string, string>): Promise<FinanceActionResult> {
  const term = values.term as ClientPaymentTerm;
  const status = values.status as PaymentStatus;
  const amount = parseAmount(values.amount);
  if (!values.jobId?.trim()) return { ok: false, error: "Job wajib dipilih." };
  if (!TERM_OPTIONS.includes(term)) return { ok: false, error: "Termin tidak valid." };
  if (!STATUS_OPTIONS.includes(status)) return { ok: false, error: "Status pembayaran tidak valid." };
  if (!Number.isFinite(amount)) return { ok: false, error: "Amount harus angka valid." };
  return run(() =>
    createClientPayment({
      jobId: values.jobId, term, amount,
      dueDate: values.dueDate?.trim() || undefined,
      paidDate: values.paidDate?.trim() || undefined,
      status, notes: values.notes?.trim() || undefined,
    }),
  );
}

export async function updateClientPaymentAction(id: string, values: Record<string, string>): Promise<FinanceActionResult> {
  const term = values.term as ClientPaymentTerm;
  const status = values.status as PaymentStatus;
  const amount = parseAmount(values.amount);
  if (!values.jobId?.trim()) return { ok: false, error: "Job wajib dipilih." };
  if (!TERM_OPTIONS.includes(term)) return { ok: false, error: "Termin tidak valid." };
  if (!STATUS_OPTIONS.includes(status)) return { ok: false, error: "Status pembayaran tidak valid." };
  if (!Number.isFinite(amount)) return { ok: false, error: "Amount harus angka valid." };
  return run(() =>
    updateClientPayment(id, {
      jobId: values.jobId, term, amount,
      dueDate: values.dueDate?.trim() || undefined,
      paidDate: values.paidDate?.trim() || undefined,
      status, notes: values.notes?.trim() || undefined,
    }),
  );
}

export async function deleteClientPaymentAction(id: string): Promise<FinanceActionResult> {
  return run(() => deleteClientPayment(id));
}

/* Vendor payments */
export async function createVendorPaymentAction(values: Record<string, string>): Promise<FinanceActionResult> {
  const type = values.type as VendorPaymentType;
  const status = values.status as PaymentStatus;
  const amount = parseAmount(values.amount);
  if (!values.jobId?.trim()) return { ok: false, error: "Job wajib dipilih." };
  if (!TYPE_OPTIONS.includes(type)) return { ok: false, error: "Tipe pembayaran vendor tidak valid." };
  if (!STATUS_OPTIONS.includes(status)) return { ok: false, error: "Status pembayaran tidak valid." };
  if (!Number.isFinite(amount)) return { ok: false, error: "Amount harus angka valid." };
  return run(() =>
    createVendorPayment({
      jobId: values.jobId, type, amount,
      dueDate: values.dueDate?.trim() || undefined,
      paidDate: values.paidDate?.trim() || undefined,
      status, notes: values.notes?.trim() || undefined,
    }),
  );
}

export async function updateVendorPaymentAction(id: string, values: Record<string, string>): Promise<FinanceActionResult> {
  const type = values.type as VendorPaymentType;
  const status = values.status as PaymentStatus;
  const amount = parseAmount(values.amount);
  if (!values.jobId?.trim()) return { ok: false, error: "Job wajib dipilih." };
  if (!TYPE_OPTIONS.includes(type)) return { ok: false, error: "Tipe pembayaran vendor tidak valid." };
  if (!STATUS_OPTIONS.includes(status)) return { ok: false, error: "Status pembayaran tidak valid." };
  if (!Number.isFinite(amount)) return { ok: false, error: "Amount harus angka valid." };
  return run(() =>
    updateVendorPayment(id, {
      jobId: values.jobId, type, amount,
      dueDate: values.dueDate?.trim() || undefined,
      paidDate: values.paidDate?.trim() || undefined,
      status, notes: values.notes?.trim() || undefined,
    }),
  );
}

export async function deleteVendorPaymentAction(id: string): Promise<FinanceActionResult> {
  return run(() => deleteVendorPayment(id));
}

/* Expense */
export async function createExpenseAction(values: Record<string, string>): Promise<FinanceActionResult> {
  const amount = parseAmount(values.amount);
  if (!values.jobId?.trim()) return { ok: false, error: "Job wajib dipilih." };
  if (!values.category?.trim()) return { ok: false, error: "Kategori wajib diisi." };
  if (!EXPENSE_CATEGORY_OPTIONS.includes(values.category)) return { ok: false, error: "Kategori expense tidak valid." };
  if (!values.description?.trim()) return { ok: false, error: "Deskripsi wajib diisi." };
  if (!values.date?.trim()) return { ok: false, error: "Tanggal expense wajib diisi." };
  if (!Number.isFinite(amount)) return { ok: false, error: "Amount harus angka valid." };
  return run(() =>
    createExpense({
      jobId: values.jobId,
      category: values.category,
      description: values.description,
      amount,
      date: values.date,
      notes: values.notes?.trim() || undefined,
    }),
  );
}

export async function updateExpenseAction(id: string, values: Record<string, string>): Promise<FinanceActionResult> {
  const amount = parseAmount(values.amount);
  if (!values.jobId?.trim()) return { ok: false, error: "Job wajib dipilih." };
  if (!values.category?.trim()) return { ok: false, error: "Kategori wajib diisi." };
  if (!EXPENSE_CATEGORY_OPTIONS.includes(values.category)) return { ok: false, error: "Kategori expense tidak valid." };
  if (!values.description?.trim()) return { ok: false, error: "Deskripsi wajib diisi." };
  if (!values.date?.trim()) return { ok: false, error: "Tanggal expense wajib diisi." };
  if (!Number.isFinite(amount)) return { ok: false, error: "Amount harus angka valid." };
  return run(() =>
    updateExpense(id, {
      jobId: values.jobId,
      category: values.category,
      description: values.description,
      amount,
      date: values.date,
      notes: values.notes?.trim() || undefined,
    }),
  );
}

export async function deleteExpenseAction(id: string): Promise<FinanceActionResult> {
  return run(() => deleteExpense(id));
}
