"use server";

import { revalidatePath } from "next/cache";

import { createJob, deleteJob, updateJob } from "@/services/job-service";
import type { JobInput } from "@/services/job-service";
import type { JobCategory, JobStatus } from "@/lib/types";
import type { Job } from "@/lib/types";

export type JobActionResult = { ok: true } | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}

function authorizeAdmin(): void {
  // Periksa apakah admin terotentikasi
  // Bisa diperluas dengan Supabase auth check di sini
  // Untuk saat ini, asumsi: admin sudah terotentikasi melalui sesi/supervisor
  // TODO: Integrasi dengan Supabase Auth auth_user_id di Phase selanjutnya
}

async function run(action: () => Promise<unknown>): Promise<JobActionResult> {
  try {
    authorizeAdmin();
    await action();
    revalidatePath("/jobs");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/* ---- Create, Update, Delete ---- */

export async function createJobAction(values: Record<string, string>): Promise<JobActionResult> {
  return run(async () => {
    const counterpartyType = values.counterpartyType ?? "CLIENT";
    const input: JobInput = {
      jobNumber: values.jobNumber?.trim() || "",
      jobName: values.jobName?.trim() || "",
      category: (values.category || "WEDDING") as JobCategory,
      clientId: counterpartyType === "CLIENT" ? (values.counterpartyId || "") : undefined,
      vendorId: counterpartyType === "VENDOR" ? (values.counterpartyId || "") : undefined,
      venueId: values.venueId || undefined,
      executionDate: values.executionDate || "",
      status: (values.status || "NOT_STARTED") as JobStatus,
      location: values.location || "",
      notes: values.notes || "",
    };
    await createJob(input);
  });
}

export async function updateJobAction(
  id: string,
  values: Record<string, string>,
): Promise<JobActionResult> {
  return run(async () => {
    const counterpartyType = values.counterpartyType ?? "CLIENT";
    const input: JobInput = {
      jobNumber: values.jobNumber?.trim() || "",
      jobName: values.jobName?.trim() || "",
      category: (values.category || "WEDDING") as JobCategory,
      clientId: counterpartyType === "CLIENT" ? (values.counterpartyId || "") : undefined,
      vendorId: counterpartyType === "VENDOR" ? (values.counterpartyId || "") : undefined,
      venueId: values.venueId || undefined,
      executionDate: values.executionDate || "",
      status: (values.status || "NOT_STARTED") as JobStatus,
      location: values.location || "",
      notes: values.notes || "",
    };
    await updateJob(id, input);
  });
}

export async function deleteJobAction(id: string): Promise<JobActionResult> {
  return run(async () => {
    await deleteJob(id);
  });
}