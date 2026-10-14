import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { Database } from "@/db";
import { deliveries, jobs } from "@/db/schema";
import type { CreateDeliveryInput } from "@/domain/inputs";
import type { Delivery } from "@/domain/types";
import { isDeliveryStatus } from "@/domain/validation";
import type { CanonicalDeliveryRepository } from "@/repositories/contract";
import {
  RepositoryError,
  RepositoryNotFoundError,
} from "@/repositories/mysql/errors";
import { rowToCanonicalDelivery } from "@/repositories/mysql/canonical/mapping";
import type { Executor } from "@/repositories/mysql/finance";

/**
 * Repository Delivery KANONIK (Contract v2).
 * Status delivery independen dari status job; referensi job yang tidak ada
 * ditolak eksplisit sebelum INSERT (FK tetap menjadi jaring terakhir).
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function optionalDate(value: string | undefined, field: string): string | null {
  if (!hasValue(value)) return null;
  if (!DATE_PATTERN.test(value)) {
    throw new RepositoryError(`'${field}' harus berformat YYYY-MM-DD (didapat '${value}').`);
  }
  return value;
}

function assertDeliveryInput(data: CreateDeliveryInput): void {
  if (!hasValue(data.jobId)) throw new RepositoryError("jobId wajib diisi.");
  if (!hasValue(data.name) || data.name.trim() === "") {
    throw new RepositoryError("Nama delivery wajib diisi.");
  }
  if (!DATE_PATTERN.test(data.deadline ?? "")) {
    throw new RepositoryError(`deadline harus berformat YYYY-MM-DD (didapat '${data.deadline}').`);
  }
  if (!isDeliveryStatus(data.status)) {
    throw new RepositoryError(`Status delivery tidak valid: '${data.status}'.`);
  }
  if (data.quantity !== undefined && (!Number.isInteger(data.quantity) || data.quantity < 0)) {
    throw new RepositoryError("quantity harus bilangan bulat >= 0.");
  }
}

async function requireJob(db: Executor, jobId: string): Promise<void> {
  const rows = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!rows[0]) throw new RepositoryNotFoundError("jobs", jobId);
}

async function getDeliveryById(db: Executor, id: string): Promise<Delivery | null> {
  const rows = await db.select().from(deliveries).where(eq(deliveries.id, id)).limit(1);
  return rows[0] ? rowToCanonicalDelivery(rows[0]) : null;
}

async function createDelivery(db: Database, data: CreateDeliveryInput): Promise<Delivery> {
  assertDeliveryInput(data);
  const id = randomUUID();
  return db.transaction(async (tx) => {
    await requireJob(tx, data.jobId);
    await tx.insert(deliveries).values({
      id,
      jobId: data.jobId,
      name: data.name,
      deliveryType: optionalText(data.deliveryType),
      quantity: data.quantity === undefined ? null : data.quantity,
      deadline: data.deadline,
      status: data.status,
      deliveredAt: optionalDate(data.deliveredAt, "deliveredAt"),
      notes: optionalText(data.notes),
    });
    const created = await getDeliveryById(tx, id);
    if (!created) throw new RepositoryError("Gagal membaca ulang delivery yang baru dibuat.");
    return created;
  });
}

async function updateDelivery(
  db: Database,
  id: string,
  data: CreateDeliveryInput,
): Promise<Delivery> {
  const existing = await getDeliveryById(db, id);
  if (!existing) throw new RepositoryNotFoundError("deliveries", id);
  assertDeliveryInput(data);
  return db.transaction(async (tx) => {
    await requireJob(tx, data.jobId);
    await tx
      .update(deliveries)
      .set({
        jobId: data.jobId,
        name: data.name,
        deliveryType: optionalText(data.deliveryType),
        quantity: data.quantity === undefined ? null : data.quantity,
        deadline: data.deadline,
        status: data.status,
        deliveredAt: optionalDate(data.deliveredAt, "deliveredAt"),
        notes: optionalText(data.notes),
      })
      .where(eq(deliveries.id, id));
    const updated = await getDeliveryById(tx, id);
    if (!updated) throw new RepositoryError("Gagal membaca ulang delivery yang diperbarui.");
    return updated;
  });
}

async function deleteDelivery(db: Database, id: string): Promise<void> {
  const existing = await getDeliveryById(db, id);
  if (!existing) throw new RepositoryNotFoundError("deliveries", id);
  await db.delete(deliveries).where(eq(deliveries.id, id));
}

export function createDeliveryRepository(
  resolveDb: () => Database,
): CanonicalDeliveryRepository {
  return {
    getAll: async () =>
      (await resolveDb().select().from(deliveries)).map(rowToCanonicalDelivery),
    getById: (id) => getDeliveryById(resolveDb(), id),
    getByJobId: async (jobId) =>
      (
        await resolveDb()
          .select()
          .from(deliveries)
          .where(eq(deliveries.jobId, jobId))
      ).map(rowToCanonicalDelivery),
    create: (data) => createDelivery(resolveDb(), data),
    update: (id, data) => updateDelivery(resolveDb(), id, data),
    delete: (id) => deleteDelivery(resolveDb(), id),
  };
}
