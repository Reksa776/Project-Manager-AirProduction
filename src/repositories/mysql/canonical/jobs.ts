import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { Database } from "@/db";
import { clients, jobSequences, jobs, packages, vendors } from "@/db/schema";
import type { CreateJobInput } from "@/domain/inputs";
import type { Job } from "@/domain/types";
import {
  isJobCategory,
  isJobStatus,
  validateJobCounterparty,
  validateJobNumber,
} from "@/domain/validation";
import type { CanonicalJobRepository } from "@/repositories/contract";
import {
  RepositoryError,
  RepositoryNotFoundError,
} from "@/repositories/mysql/errors";
import { rowToCanonicalJob } from "@/repositories/mysql/canonical/mapping";
import type { Executor } from "@/repositories/mysql/finance";

/**
 * Repository Job KANONIK (Contract v2).
 *
 * - Uang tidak ada di Job; kas/obligasi dikelola repository finansial.
 * - `venueId` tidak ada (venue dihapus dari domain kanonik). Histori nama venue
 *   disimpan di `legacyVenueName`.
 * - XOR client/vendor divalidasi di sini (selaras `chk_jobs_client_vendor_xor`);
 *   referensi client/vendor yang tidak ada ditolak eksplisit sebelum INSERT.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function assertJobInput(data: CreateJobInput): void {
  const number = validateJobNumber(data.jobNumber ?? "");
  if (!number.ok) throw new RepositoryError(number.errors.join(" "));
  if (!hasValue(data.jobName) || data.jobName.trim() === "") {
    throw new RepositoryError("jobName wajib diisi.");
  }
  if (!isJobCategory(data.category)) {
    throw new RepositoryError(`Kategori job tidak valid: '${data.category}'.`);
  }
  if (!isJobStatus(data.status)) {
    throw new RepositoryError(`Status job tidak valid: '${data.status}'.`);
  }
  if (!DATE_PATTERN.test(data.executionDate ?? "")) {
    throw new RepositoryError(`executionDate harus berformat YYYY-MM-DD (didapat '${data.executionDate}').`);
  }
  const xor = validateJobCounterparty(data.clientId, data.vendorId);
  if (!xor.ok) throw new RepositoryError(xor.errors.join(" "));
}

async function requireCounterparty(db: Executor, data: CreateJobInput): Promise<void> {
  if (hasValue(data.packageId)) {
    const rows = await db.select({ id: packages.id }).from(packages)
      .where(eq(packages.id, data.packageId)).limit(1);
    if (!rows[0]) throw new RepositoryNotFoundError("packages", data.packageId);
  }
  if (hasValue(data.clientId)) {
    const rows = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, data.clientId))
      .limit(1);
    if (!rows[0]) throw new RepositoryNotFoundError("clients", data.clientId);
  }
  if (hasValue(data.vendorId)) {
    const rows = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.id, data.vendorId))
      .limit(1);
    if (!rows[0]) throw new RepositoryNotFoundError("vendors", data.vendorId);
  }
}

async function getJobById(db: Executor, id: string): Promise<Job | null> {
  const rows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return rows[0] ? rowToCanonicalJob(rows[0]) : null;
}

async function getJobByNumber(db: Database, jobNumber: string): Promise<Job | null> {
  const rows = await db.select().from(jobs).where(eq(jobs.jobNumber, jobNumber)).limit(1);
  return rows[0] ? rowToCanonicalJob(rows[0]) : null;
}

async function createJob(db: Database, data: CreateJobInput): Promise<Job> {
  const id = randomUUID();
  return db.transaction(async (tx) => {
    await requireCounterparty(tx, data);
    let jobNumber = data.jobNumber?.trim();
    if (!jobNumber) {
      const year = new Date().getUTCFullYear();
      await tx.insert(jobSequences).values({ year, nextSeq: 1 }).onConflictDoNothing({
        target: jobSequences.year,
      });
      const sequenceRows = await tx.select().from(jobSequences).where(eq(jobSequences.year, year)).for("update");
      const sequence = sequenceRows[0];
      if (!sequence) throw new RepositoryError("Could not allocate a job number.");
      let nextSeq = sequence.nextSeq;
      do {
        jobNumber = `JOB-${year}-${String(nextSeq).padStart(6, "0")}`;
        nextSeq += 1;
      } while ((await tx.select({ id: jobs.id }).from(jobs).where(eq(jobs.jobNumber, jobNumber)).limit(1))[0]);
      await tx.update(jobSequences).set({ nextSeq }).where(eq(jobSequences.year, year));
    }
    const validated = { ...data, jobNumber };
    assertJobInput(validated);
    await tx.insert(jobs).values({
      id,
      jobNumber,
      jobName: data.jobName,
      category: data.category,
      clientId: data.clientId ?? null,
      vendorId: data.vendorId ?? null,
      packageId: data.packageId ?? null,
      executionDate: data.executionDate,
      status: data.status,
      location: optionalText(data.location),
      notes: optionalText(data.notes),
      legacyVenueName: optionalText(data.legacyVenueName),
    });
    const created = await getJobById(tx, id);
    if (!created) throw new RepositoryError("Gagal membaca ulang job yang baru dibuat.");
    return created;
  });
}

async function updateJob(db: Database, id: string, data: CreateJobInput): Promise<Job> {
  const existing = await getJobById(db, id);
  if (!existing) throw new RepositoryNotFoundError("jobs", id);
  const updateData = { ...data, jobNumber: existing.jobNumber };
  assertJobInput(updateData);
  return db.transaction(async (tx) => {
    await requireCounterparty(tx, updateData);
    await tx
      .update(jobs)
      .set({
        jobNumber: existing.jobNumber,
        jobName: updateData.jobName,
        category: updateData.category,
        clientId: updateData.clientId ?? null,
        vendorId: updateData.vendorId ?? null,
        packageId: updateData.packageId ?? null,
        executionDate: updateData.executionDate,
        status: updateData.status,
        location: optionalText(updateData.location),
        notes: optionalText(updateData.notes),
        legacyVenueName: optionalText(updateData.legacyVenueName),
      })
      .where(eq(jobs.id, id));
    const updated = await getJobById(tx, id);
    if (!updated) throw new RepositoryError("Gagal membaca ulang job yang diperbarui.");
    return updated;
  });
}

async function deleteJob(db: Database, id: string): Promise<void> {
  const existing = await getJobById(db, id);
  if (!existing) throw new RepositoryNotFoundError("jobs", id);
  await db.delete(jobs).where(eq(jobs.id, id));
}

export function createJobRepository(resolveDb: () => Database): CanonicalJobRepository {
  return {
    getAll: async () => (await resolveDb().select().from(jobs)).map(rowToCanonicalJob),
    getById: (id) => getJobById(resolveDb(), id),
    getByJobNumber: (jobNumber) => getJobByNumber(resolveDb(), jobNumber),
    create: (data) => createJob(resolveDb(), data),
    update: (id, data) => updateJob(resolveDb(), id, data),
    delete: (id) => deleteJob(resolveDb(), id),
  };
}
