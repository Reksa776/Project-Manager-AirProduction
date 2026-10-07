"use server";

import { revalidatePath } from "next/cache";

import { createJob, deleteJob, updateJob } from "@/services/job-service";
import type { JobCategory, JobStatus } from "@/lib/types";

export type JobActionResult = { ok: true } | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}

async function run(action: () => Promise<unknown>): Promise<JobActionResult> {
  try {
    await action();
    revalidatePath("/jobs");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

const CATEGORY_VALUES: JobCategory[] = ["WEDDING", "PREWEDDING", "CORPORATE", "EVENT", "OTHER"];
const STATUS_VALUES: JobStatus[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"];

type ParsedJob =
  | { ok: true; input: {
      jobNumber: string;
      jobName: string;
      category: JobCategory;
      status: JobStatus;
      clientId?: string;
      vendorId?: string;
      venueId?: string;
      executionDate: string;
      location?: string;
      notes?: string;
    } }
  | { ok: false; error: string };

function parseValues(values: Record<string, string>): ParsedJob {
  const category = values.category as JobCategory;
  const status = values.status as JobStatus;
  if (!CATEGORY_VALUES.includes(category)) {
    return { ok: false, error: "Kategori job tidak valid." };
  }
  if (!STATUS_VALUES.includes(status)) {
    return { ok: false, error: "Status job tidak valid." };
  }
  return {
    ok: true,
    input: {
      jobNumber: values.jobNumber ?? "",
      jobName: values.jobName ?? "",
      category,
      status,
      clientId: values.counterpartyType === "CLIENT" ? values.counterpartyId || undefined : undefined,
      vendorId: values.counterpartyType === "VENDOR" ? values.counterpartyId || undefined : undefined,
      venueId: values.venueId || undefined,
      executionDate: values.executionDate ?? "",
      location: values.location || undefined,
      notes: values.notes || undefined,
    },
  };
}

export async function createJobAction(values: Record<string, string>): Promise<JobActionResult> {
  const parsed = parseValues(values);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return run(() => createJob(parsed.input));
}

export async function updateJobAction(id: string, values: Record<string, string>): Promise<JobActionResult> {
  const parsed = parseValues(values);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return run(() => updateJob(id, parsed.input));
}

export async function deleteJobAction(id: string): Promise<JobActionResult> {
  return run(() => deleteJob(id));
}
