"use server";

import { revalidatePath } from "next/cache";

import type { DeliveryStatus } from "@/domain/types";
import { isDeliveryStatus } from "@/domain/validation";
import {
  createDelivery,
  createJobCrew,
  deleteDelivery,
  deleteJobCrew,
  recordCrewPayment,
  updateDelivery,
  updateJobCrew,
} from "@/services/job-service";
import { parseAmountInput, parseQuantityInput } from "@/lib/utils";
import { getApplication } from "@/services/runtime";
import { assertAuthenticatedAdmin } from "@/lib/auth";

export type JobDetailActionResult = { ok: true } | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}

/**
 * Revalidasi path job memakai service kanonik (bukan repository legacy).
 * `jobNumber` dibutuhkan untuk path dinamis `/jobs/[jobNumber]`.
 */
async function revalidateJob(jobId: string): Promise<void> {
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
  revalidatePath("/finance");
  const job = await getApplication().services.jobs.getJobById(jobId);
  if (job) revalidatePath(`/jobs/${job.jobNumber}`);
}

function requireIdempotencyKey(values: Record<string, string>): string {
  const key = values.idempotencyKey?.trim();
  if (!key) throw new Error("An idempotency key is required to record a cash movement.");
  return key;
}

/* ---- Crew assignment (obligation only: agreedAmount) ---- */

function parseRoleOverride(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createJobCrewAction(
  jobId: string,
  values: Record<string, string>,
): Promise<JobDetailActionResult> {
  try {
    await assertAuthenticatedAdmin();
    const agreedAmount = parseAmountInput(values.agreedAmount);
    if (agreedAmount === null) {
      return { ok: false, error: "Nilai kesepakatan crew harus angka valid." };
    }
    const crewId = values.crewId?.trim();
    if (!crewId) return { ok: false, error: "Please select a crew member." };

    await createJobCrew({
      jobId,
      crewId,
      crewRoleId: parseRoleOverride(values.crewRoleId),
      agreedAmount,
      notes: values.notes?.trim() || undefined,
    });
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
    await assertAuthenticatedAdmin();
    const agreedAmount = parseAmountInput(values.agreedAmount);
    if (agreedAmount === null) {
      return { ok: false, error: "Nilai kesepakatan crew harus angka valid." };
    }
    const crewId = values.crewId?.trim();
    if (!crewId) return { ok: false, error: "Please select a crew member." };

    await updateJobCrew(id, {
      jobId,
      crewId,
      crewRoleId: parseRoleOverride(values.crewRoleId),
      agreedAmount,
      notes: values.notes?.trim() || undefined,
    });
    await revalidateJob(jobId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function deleteJobCrewAction(
  id: string,
  jobId: string,
): Promise<JobDetailActionResult> {
  try {
    await assertAuthenticatedAdmin();
    await deleteJobCrew(id);
    await revalidateJob(jobId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** Catat KAS pembayaran crew (obligasi tidak berubah). */
export async function recordCrewPaymentAction(
  assignmentId: string,
  jobId: string,
  values: Record<string, string>,
): Promise<JobDetailActionResult> {
  try {
    await assertAuthenticatedAdmin();
    const amount = parseAmountInput(values.amount);
    if (amount === null) return { ok: false, error: "Amount must be a valid number greater than zero." };
    const occurredOn = values.occurredOn?.trim();
    if (!occurredOn) return { ok: false, error: "Payment date is required." };

    await recordCrewPayment({
      assignmentId,
      amount,
      occurredOn,
      description: values.description?.trim() || undefined,
      idempotencyKey: requireIdempotencyKey(values),
    });
    await revalidateJob(jobId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/* ---- Delivery ---- */

function deliveryInputFrom(jobId: string, values: Record<string, string>) {
  const status = (values.status as DeliveryStatus) ?? "NOT_STARTED";
  if (!isDeliveryStatus(status)) throw new Error("Invalid deliverable status.");
  const name = values.name?.trim();
  if (!name) throw new Error("Deliverable name is required diisi.");
  const deadline = values.deadline?.trim();
  if (!deadline) throw new Error("Deliverable deadline is required.");

  const quantityRaw = values.quantity?.trim();
  let quantity: number | undefined;
  if (quantityRaw) {
    const parsed = parseQuantityInput(quantityRaw);
    if (parsed === null) throw new Error("Quantity harus bilangan bulat >= 0.");
    quantity = parsed;
  }

  return {
    jobId,
    name,
    deliveryType: values.deliveryType?.trim() || undefined,
    quantity,
    deadline,
    status,
    deliveredAt: values.deliveredAt?.trim() || undefined,
    notes: values.notes?.trim() || undefined,
  };
}

export async function createDeliveryAction(
  jobId: string,
  values: Record<string, string>,
): Promise<JobDetailActionResult> {
  try {
    await assertAuthenticatedAdmin();
    await createDelivery(deliveryInputFrom(jobId, values));
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
    await assertAuthenticatedAdmin();
    await updateDelivery(id, deliveryInputFrom(jobId, values));
    await revalidateJob(jobId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function deleteDeliveryAction(
  id: string,
  jobId: string,
): Promise<JobDetailActionResult> {
  try {
    await assertAuthenticatedAdmin();
    await deleteDelivery(id);
    await revalidateJob(jobId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
