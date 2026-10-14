import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb, type Database } from "@/db";
import { cashflows, jobCrews } from "@/db/schema";
import type { CreateJobCrewAssignmentInput } from "@/domain/inputs";
import type { JobCrewAssignment } from "@/domain/types";
import type { CanonicalJobCrewAssignmentRepository } from "@/repositories/contract";
import {
  RepositoryError,
  RepositoryInUseError,
  RepositoryNotFoundError,
} from "@/repositories/mysql/errors";
import { rowToJobCrewAssignment } from "@/repositories/mysql/finance/mapping";
import { requireNonNegativeAmount } from "@/repositories/mysql/finance/values";

/**
 * Assignment crew = OBLIGASI (kesepakatan `agreed_amount`), bukan kas.
 *
 * - Membuat/mengubah assignment tidak memindahkan uang; kas crew bergerak lewat
 *   `cashflows` (direction EXPENSE, category CREW_PAYMENT, reference `job_crew`).
 * - `paymentStatus` tidak disimpan; diturunkan di service dari kas aktual.
 * - Menghapus assignment yang sudah punya kas ditolak (mencegah orphan).
 *
 * P0C-3: dibuat lewat factory dengan resolusi koneksi eksplisit (singleton lama
 * tetap ada, resolusi lazy lewat `getDb()`).
 */

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

function validateAssignment(data: CreateJobCrewAssignmentInput) {
  if (!hasValue(data.jobId)) throw new RepositoryError("jobId wajib diisi.");
  if (!hasValue(data.crewId)) throw new RepositoryError("crewId wajib diisi.");
  if (data.crewRoleId !== null && !hasValue(data.crewRoleId)) {
    throw new RepositoryError("crewRoleId harus berupa id atau null.");
  }
  return requireNonNegativeAmount(data.agreedAmount, "jobCrew.agreedAmount");
}

async function countPaymentsForAssignment(
  db: Database,
  assignmentId: string,
): Promise<number> {
  const rows = await db
    .select({ id: cashflows.id })
    .from(cashflows)
    .where(
      and(
        eq(cashflows.referenceType, "job_crew"),
        eq(cashflows.referenceId, assignmentId),
      ),
    );
  return rows.length;
}

async function getAssignmentById(
  db: Database,
  id: string,
): Promise<JobCrewAssignment | null> {
  const rows = await db.select().from(jobCrews).where(eq(jobCrews.id, id)).limit(1);
  return rows[0] ? rowToJobCrewAssignment(rows[0]) : null;
}

async function listAssignments(db: Database, jobId?: string): Promise<JobCrewAssignment[]> {
  const rows = await db
    .select()
    .from(jobCrews)
    .where(hasValue(jobId) ? eq(jobCrews.jobId, jobId) : undefined);
  return rows.map(rowToJobCrewAssignment);
}

async function createAssignment(
  db: Database,
  data: CreateJobCrewAssignmentInput,
): Promise<JobCrewAssignment> {
  const agreedAmount = validateAssignment(data);
  const id = randomUUID();
  await db.insert(jobCrews).values({
    id,
    jobId: data.jobId,
    crewId: data.crewId,
    crewRoleId: data.crewRoleId,
    agreedAmount,
    notes: hasValue(data.notes) ? data.notes : null,
  });
  const created = await getAssignmentById(db, id);
  if (!created) throw new RepositoryError("Gagal membaca ulang assignment crew yang baru dibuat.");
  return created;
}

async function updateAssignment(
  db: Database,
  id: string,
  data: CreateJobCrewAssignmentInput,
): Promise<JobCrewAssignment> {
  const existing = await getAssignmentById(db, id);
  if (!existing) throw new RepositoryNotFoundError("job_crews", id);
  const agreedAmount = validateAssignment(data);
  await db
    .update(jobCrews)
    .set({
      jobId: data.jobId,
      crewId: data.crewId,
      crewRoleId: data.crewRoleId,
      agreedAmount,
      notes: hasValue(data.notes) ? data.notes : null,
    })
    .where(eq(jobCrews.id, id));
  const updated = await getAssignmentById(db, id);
  if (!updated) throw new RepositoryError("Gagal membaca ulang assignment crew yang diperbarui.");
  return updated;
}

async function deleteAssignment(db: Database, id: string): Promise<void> {
  const existing = await getAssignmentById(db, id);
  if (!existing) throw new RepositoryNotFoundError("job_crews", id);
  const paid = await countPaymentsForAssignment(db, id);
  if (paid > 0) {
    throw new RepositoryInUseError(
      "job_crews",
      id,
      "ada kas crew yang merujuk assignment ini; menghapus akan membuat catatan kas yatim.",
    );
  }
  await db.delete(jobCrews).where(eq(jobCrews.id, id));
}

/** Factory assignment crew. `resolveDb` dipanggil per operasi. */
export function createJobCrewAssignmentRepository(
  resolveDb: () => Database,
): CanonicalJobCrewAssignmentRepository {
  return {
    getAll: () => listAssignments(resolveDb()),
    getById: (id) => getAssignmentById(resolveDb(), id),
    getByJobId: (jobId) => listAssignments(resolveDb(), jobId),
    create: (data) => createAssignment(resolveDb(), data),
    update: (id, data) => updateAssignment(resolveDb(), id, data),
    delete: (id) => deleteAssignment(resolveDb(), id),
  };
}

export const mysqlJobCrewAssignments: CanonicalJobCrewAssignmentRepository =
  createJobCrewAssignmentRepository(getDb);
