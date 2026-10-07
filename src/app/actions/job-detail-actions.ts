"use server";

import { revalidatePath } from "next/cache";

import {
  createDelivery,
  createJobCrew,
  deleteDelivery,
  deleteJobCrew,
  updateDelivery,
  updateJobCrew,
} from "@/services/job-service";
import { getRepositories } from "@/repositories";
import type {
  Delivery,
  DeliveryStatus,
  JobCrew,
  PaymentStatus,
} from "@/lib/types";

export type JobDetailActionResult = { ok: true } | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}

async function revalidateJob(jobId: string): Promise<void> {
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  const job = await getRepositories().jobs.getById(jobId);
  if (job) revalidatePath(`/jobs/${job.jobNumber}`);
}

const DELIVERY_STATUS_VALUES: DeliveryStatus[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"];
const PAYMENT_STATUS_VALUES: PaymentStatus[] = ["UNPAID", "PARTIAL", "PAID"];

function parseDeliveryType(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseOptionalNumber(value: string): number | undefined | null {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed.replace(/\./g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/* ---- Crew assignment ---- */

export async function createJobCrewAction(
  jobId: string,
  values: Record<string, string>,
): Promise<JobDetailActionResult> {
  try {
    const payment = parseOptionalNumber(values.actualPayment);
    if (payment === null || payment === undefined) {
      return { ok: false, error: "Payment crew harus angka valid." };
    }
    const paymentStatus = values.paymentStatus?.trim();
    if (paymentStatus && !PAYMENT_STATUS_VALUES.includes(paymentStatus as PaymentStatus)) {
      return { ok: false, error: "Payment status crew tidak valid." };
    }
    const input: Omit<JobCrew, "id"> = {
      jobId,
      crewId: values.crewId ?? "",
      role: values.role ?? "",
      actualPayment: payment,
      paymentStatus: paymentStatus ? (paymentStatus as PaymentStatus) : undefined,
    };
    await createJobCrew(input);
    await revalidateJob(jobId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateJobCrewAction(
  id: string,
  jobId: string,
  values: Record<string, string>,
): Promise<JobDetailActionResult> {
  try {
    const payment = parseOptionalNumber(values.actualPayment);
    if (payment === null || payment === undefined) {
      return { ok: false, error: "Payment crew harus angka valid." };
    }
    const paymentStatus = values.paymentStatus?.trim();
    if (paymentStatus && !PAYMENT_STATUS_VALUES.includes(paymentStatus as PaymentStatus)) {
      return { ok: false, error: "Payment status crew tidak valid." };
    }
    const input: Omit<JobCrew, "id"> = {
      jobId,
      crewId: values.crewId ?? "",
      role: values.role ?? "",
      actualPayment: payment,
      paymentStatus: paymentStatus ? (paymentStatus as PaymentStatus) : undefined,
    };
    await updateJobCrew(id, input);
    await revalidateJob(jobId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function deleteJobCrewAction(id: string, jobId: string): Promise<JobDetailActionResult> {
  try {
    await deleteJobCrew(id);
    await revalidateJob(jobId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/* ---- Delivery ---- */

export async function createDeliveryAction(
  jobId: string,
  values: Record<string, string>,
): Promise<JobDetailActionResult> {
  try {
    if (values.status && !DELIVERY_STATUS_VALUES.includes(values.status as DeliveryStatus)) {
      return { ok: false, error: "Status delivery tidak valid." };
    }
    const quantity = values.quantity?.trim()
      ? parseOptionalNumber(values.quantity)
      : undefined;
    if (quantity === null) {
      return { ok: false, error: "Quantity harus angka valid." };
    }
    const input: Omit<Delivery, "id"> = {
      jobId,
      name: values.name ?? "",
      deliveryType: parseDeliveryType(values.deliveryType ?? ""),
      quantity: quantity === undefined ? undefined : quantity,
      deadline: values.deadline ?? "",
      status: (values.status as DeliveryStatus) ?? "NOT_STARTED",
      notes: values.notes?.trim() || undefined,
    };
    await createDelivery(input);
    await revalidateJob(jobId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateDeliveryAction(
  id: string,
  jobId: string,
  values: Record<string, string>,
): Promise<JobDetailActionResult> {
  try {
    if (values.status && !DELIVERY_STATUS_VALUES.includes(values.status as DeliveryStatus)) {
      return { ok: false, error: "Status delivery tidak valid." };
    }
    const quantity = values.quantity?.trim()
      ? parseOptionalNumber(values.quantity)
      : undefined;
    if (quantity === null) {
      return { ok: false, error: "Quantity harus angka valid." };
    }
    const input: Omit<Delivery, "id"> = {
      jobId,
      name: values.name ?? "",
      deliveryType: parseDeliveryType(values.deliveryType ?? ""),
      quantity: quantity === undefined ? undefined : quantity,
      deadline: values.deadline ?? "",
      status: (values.status as DeliveryStatus) ?? "NOT_STARTED",
      notes: values.notes?.trim() || undefined,
    };
    await updateDelivery(id, input);
    await revalidateJob(jobId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function deleteDeliveryAction(id: string, jobId: string): Promise<JobDetailActionResult> {
  try {
    await deleteDelivery(id);
    await revalidateJob(jobId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
