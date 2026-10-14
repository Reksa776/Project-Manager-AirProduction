import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb } from "@/db";
import {
  admins,
  cashflows,
  clientPayments,
  clients,
  crew,
  crewRoles,
  deliveries,
  jobCrews,
  jobs,
  vendorPayments,
  vendors,
} from "@/db/schema";
import {
  RepositoryBlockedError,
  RepositoryError,
  RepositoryNotFoundError,
} from "@/repositories/mysql/errors";
import {
  rowToAdmin,
  rowToClient,
  rowToClientPayment,
  rowToCrew,
  rowToDelivery,
  rowToJob,
  rowToJobCrew,
  rowToVendor,
  rowToVendorPayment,
  decimalToNumber,
  numberToDecimal,
  type ClientPaymentRow,
  type VendorPaymentRow,
} from "@/repositories/mysql/mapping";
import type {
  AdminRepository,
  ClientPaymentRepository,
  ClientRepository,
  CrewRepository,
  DataRepositories,
  DeliveryRepository,
  ExpenseRepository,
  JobCrewRepository,
  JobRepository,
  VendorPaymentRepository,
  VendorRepository,
  VenueRepository,
} from "@/repositories/types";
import type {
  Client,
  Crew,
  Delivery,
  Job,
  JobCrew,
  PaymentStatus,
  Venue,
  Vendor,
} from "@/lib/types";

/**
 * Repository MySQL (Drizzle + mysql2).
 *
 * STATUS: tidak diaktifkan. `src/repositories/index.ts` tetap mengembalikan
 * `googleRepositories`. Modul ini disiapkan untuk Phase berikutnya.
 *
 * Prinsip implementasi:
 * - Query Drizzle yang ter-parameter (tidak ada string SQL kecuali agregat
 *   `coalesce(sum(...))` yang terdokumentasi).
 * - Error driver (FK/CHECK/UNIQUE) DITERUSKAN apa adanya.
 * - ID baru = `crypto.randomUUID()`.
 * - Uang tetap `number` (kolom `decimal(15,2)`); tidak ada aritmetika float
 *   di repository.
 * - Tidak ada mock fallback dan tidak ada data hardcoded.
 * - Ketidaksesuaian domain↔skema tidak disembunyikan: method yang tidak
 *   dapat dipetakan MELEMPAR `RepositoryBlockedError` (lihat matrix di
 *   docs/PHASE-P0B-MYSQL-REPOSITORY.md).
 */

function newId(): string {
  return randomUUID();
}

function orNull(value: string | undefined): string | null {
  return value === undefined ? null : value;
}

function requireFinite(value: number, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RepositoryError(`Nilai '${field}' harus berupa angka valid.`);
  }
  return value;
}

/**
 * `Job.venueId` tidak memiliki kolom di skema MySQL (venue dihapus).
 * Menulis job dengan venueId tidak dapat dipenuhi tanpa mendiamkan input →
 * lempar error eksplisit.
 */
function assertNoVenue(venueId: string | undefined): void {
  if (venueId !== undefined && venueId !== "") {
    throw new RepositoryError(
      "Job.venueId tidak dapat dipetakan: skema MySQL tidak memiliki kolom venue (venue dihapus pada redesain).",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Jobs                                                                        */
/* -------------------------------------------------------------------------- */

async function getAllJobs(): Promise<Job[]> {
  const rows = await getDb().select().from(jobs);
  return rows.map(rowToJob);
}

async function getJobById(id: string): Promise<Job | null> {
  const rows = await getDb().select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return rows[0] ? rowToJob(rows[0]) : null;
}

async function getJobByNumber(jobNumber: string): Promise<Job | null> {
  const rows = await getDb()
    .select()
    .from(jobs)
    .where(eq(jobs.jobNumber, jobNumber))
    .limit(1);
  return rows[0] ? rowToJob(rows[0]) : null;
}

async function createJob(data: Parameters<JobRepository["create"]>[0]): Promise<Job> {
  assertNoVenue(data.venueId);
  const id = newId();
  return getDb().transaction(async (tx) => {
    await tx.insert(jobs).values({
      id,
      jobNumber: data.jobNumber,
      jobName: data.jobName,
      category: data.category,
      clientId: orNull(data.clientId),
      vendorId: orNull(data.vendorId),
      executionDate: data.executionDate,
      status: data.status,
      location: orNull(data.location),
      notes: orNull(data.notes),
    });
    const rows = await tx.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!rows[0]) {
      throw new RepositoryError("Gagal membaca ulang job yang baru dibuat.");
    }
    return rowToJob(rows[0]);
  });
}

async function updateJob(
  id: string,
  data: Parameters<JobRepository["update"]>[1],
): Promise<Job> {
  assertNoVenue(data.venueId);
  const db = getDb();
  const existing = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!existing[0]) throw new RepositoryNotFoundError("jobs", id);

  return db.transaction(async (tx) => {
    await tx
      .update(jobs)
      .set({
        jobNumber: data.jobNumber,
        jobName: data.jobName,
        category: data.category,
        clientId: orNull(data.clientId),
        vendorId: orNull(data.vendorId),
        executionDate: data.executionDate,
        status: data.status,
        location: orNull(data.location),
        notes: orNull(data.notes),
      })
      .where(eq(jobs.id, id));
    const rows = await tx.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!rows[0]) throw new RepositoryError("Gagal membaca ulang job yang diperbarui.");
    return rowToJob(rows[0]);
  });
}

async function deleteJob(id: string): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!existing[0]) throw new RepositoryNotFoundError("jobs", id);
  await db.delete(jobs).where(eq(jobs.id, id));
}

export const mysqlJobs: JobRepository = {
  getAll: getAllJobs,
  getById: getJobById,
  getByJobNumber: getJobByNumber,
  create: createJob,
  update: updateJob,
  delete: deleteJob,
};

/* -------------------------------------------------------------------------- */
/* Clients                                                                     */
/* -------------------------------------------------------------------------- */

async function getAllClients(): Promise<Client[]> {
  const rows = await getDb().select().from(clients);
  return rows.map(rowToClient);
}

async function getClientById(id: string): Promise<Client | null> {
  const rows = await getDb().select().from(clients).where(eq(clients.id, id)).limit(1);
  return rows[0] ? rowToClient(rows[0]) : null;
}

async function createClient(
  data: Parameters<ClientRepository["create"]>[0],
): Promise<Client> {
  const id = newId();
  return getDb().transaction(async (tx) => {
    await tx.insert(clients).values({
      id,
      name: data.name,
      contactPerson: orNull(data.contactPerson),
      phone: orNull(data.phone),
      email: orNull(data.email),
      address: orNull(data.address),
      notes: orNull(data.notes),
    });
    const rows = await tx.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!rows[0]) throw new RepositoryError("Gagal membaca ulang client yang baru dibuat.");
    return rowToClient(rows[0]);
  });
}

async function updateClient(
  id: string,
  data: Parameters<ClientRepository["update"]>[1],
): Promise<Client> {
  const db = getDb();
  const existing = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, id)).limit(1);
  if (!existing[0]) throw new RepositoryNotFoundError("clients", id);
  return db.transaction(async (tx) => {
    await tx
      .update(clients)
      .set({
        name: data.name,
        contactPerson: orNull(data.contactPerson),
        phone: orNull(data.phone),
        email: orNull(data.email),
        address: orNull(data.address),
        notes: orNull(data.notes),
      })
      .where(eq(clients.id, id));
    const rows = await tx.select().from(clients).where(eq(clients.id, id)).limit(1);
    if (!rows[0]) throw new RepositoryError("Gagal membaca ulang client yang diperbarui.");
    return rowToClient(rows[0]);
  });
}

async function deleteClient(id: string): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, id)).limit(1);
  if (!existing[0]) throw new RepositoryNotFoundError("clients", id);
  await db.delete(clients).where(eq(clients.id, id));
}

export const mysqlClients: ClientRepository = {
  getAll: getAllClients,
  getById: getClientById,
  create: createClient,
  update: updateClient,
  delete: deleteClient,
};

/* -------------------------------------------------------------------------- */
/* Vendors                                                                     */
/* -------------------------------------------------------------------------- */

async function getAllVendors(): Promise<Vendor[]> {
  const rows = await getDb().select().from(vendors);
  return rows.map(rowToVendor);
}

async function getVendorById(id: string): Promise<Vendor | null> {
  const rows = await getDb().select().from(vendors).where(eq(vendors.id, id)).limit(1);
  return rows[0] ? rowToVendor(rows[0]) : null;
}

async function createVendor(
  data: Parameters<VendorRepository["create"]>[0],
): Promise<Vendor> {
  const id = newId();
  return getDb().transaction(async (tx) => {
    await tx.insert(vendors).values({
      id,
      name: data.name,
      contactPerson: orNull(data.contactPerson),
      phone: orNull(data.phone),
      email: orNull(data.email),
      notes: orNull(data.notes),
    });
    const rows = await tx.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!rows[0]) throw new RepositoryError("Gagal membaca ulang vendor yang baru dibuat.");
    return rowToVendor(rows[0]);
  });
}

async function updateVendor(
  id: string,
  data: Parameters<VendorRepository["update"]>[1],
): Promise<Vendor> {
  const db = getDb();
  const existing = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, id)).limit(1);
  if (!existing[0]) throw new RepositoryNotFoundError("vendors", id);
  return db.transaction(async (tx) => {
    await tx
      .update(vendors)
      .set({
        name: data.name,
        contactPerson: orNull(data.contactPerson),
        phone: orNull(data.phone),
        email: orNull(data.email),
        notes: orNull(data.notes),
      })
      .where(eq(vendors.id, id));
    const rows = await tx.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!rows[0]) throw new RepositoryError("Gagal membaca ulang vendor yang diperbarui.");
    return rowToVendor(rows[0]);
  });
}

async function deleteVendor(id: string): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, id)).limit(1);
  if (!existing[0]) throw new RepositoryNotFoundError("vendors", id);
  await db.delete(vendors).where(eq(vendors.id, id));
}

export const mysqlVendors: VendorRepository = {
  getAll: getAllVendors,
  getById: getVendorById,
  create: createVendor,
  update: updateVendor,
  delete: deleteVendor,
};

/* -------------------------------------------------------------------------- */
/* Crew (role dinormalisasi ke crew_roles)                                     */
/* -------------------------------------------------------------------------- */

async function getAllCrew(): Promise<Crew[]> {
  const rows = await getDb()
    .select({ c: crew, roleName: crewRoles.name })
    .from(crew)
    .innerJoin(crewRoles, eq(crew.crewRoleId, crewRoles.id));
  return rows.map((row) => rowToCrew(row.c, row.roleName));
}

async function getCrewById(id: string): Promise<Crew | null> {
  const rows = await getDb()
    .select({ c: crew, roleName: crewRoles.name })
    .from(crew)
    .innerJoin(crewRoles, eq(crew.crewRoleId, crewRoles.id))
    .where(eq(crew.id, id))
    .limit(1);
  return rows[0] ? rowToCrew(rows[0].c, rows[0].roleName) : null;
}

async function createCrew(data: Parameters<CrewRepository["create"]>[0]): Promise<Crew> {
  if (!data.role?.trim()) throw new RepositoryError("Role crew wajib diisi.");
  requireFinite(data.defaultPayment, "crew.defaultPayment");
  const id = newId();
  return getDb().transaction(async (tx) => {
    const roleRows = await tx
      .select({ id: crewRoles.id })
      .from(crewRoles)
      .where(eq(crewRoles.name, data.role.trim()))
      .limit(1);
    if (!roleRows[0]) {
      throw new RepositoryError(
        `Role crew '${data.role.trim()}' tidak ditemukan di tabel crew_roles. P0B tidak membuat role baru secara implisit.`,
      );
    }
    await tx.insert(crew).values({
      id,
      name: data.name,
      crewRoleId: roleRows[0].id,
      defaultPayment: numberToDecimal(data.defaultPayment, "crew.defaultPayment"),
      phone: orNull(data.phone),
      notes: orNull(data.notes),
    });
    const rows = await tx
      .select({ c: crew, roleName: crewRoles.name })
      .from(crew)
      .innerJoin(crewRoles, eq(crew.crewRoleId, crewRoles.id))
      .where(eq(crew.id, id))
      .limit(1);
    if (!rows[0]) throw new RepositoryError("Gagal membaca ulang crew yang baru dibuat.");
    return rowToCrew(rows[0].c, rows[0].roleName);
  });
}

async function updateCrew(
  id: string,
  data: Parameters<CrewRepository["update"]>[1],
): Promise<Crew> {
  if (!data.role?.trim()) throw new RepositoryError("Role crew wajib diisi.");
  requireFinite(data.defaultPayment, "crew.defaultPayment");
  const db = getDb();
  const existing = await db.select({ id: crew.id }).from(crew).where(eq(crew.id, id)).limit(1);
  if (!existing[0]) throw new RepositoryNotFoundError("crew", id);
  return db.transaction(async (tx) => {
    const roleRows = await tx
      .select({ id: crewRoles.id })
      .from(crewRoles)
      .where(eq(crewRoles.name, data.role.trim()))
      .limit(1);
    if (!roleRows[0]) {
      throw new RepositoryError(
        `Role crew '${data.role.trim()}' tidak ditemukan di tabel crew_roles. P0B tidak membuat role baru secara implisit.`,
      );
    }
    await tx
      .update(crew)
      .set({
        name: data.name,
        crewRoleId: roleRows[0].id,
        defaultPayment: numberToDecimal(data.defaultPayment, "crew.defaultPayment"),
        phone: orNull(data.phone),
        notes: orNull(data.notes),
      })
      .where(eq(crew.id, id));
    const rows = await tx
      .select({ c: crew, roleName: crewRoles.name })
      .from(crew)
      .innerJoin(crewRoles, eq(crew.crewRoleId, crewRoles.id))
      .where(eq(crew.id, id))
      .limit(1);
    if (!rows[0]) throw new RepositoryError("Gagal membaca ulang crew yang diperbarui.");
    return rowToCrew(rows[0].c, rows[0].roleName);
  });
}

async function deleteCrew(id: string): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: crew.id }).from(crew).where(eq(crew.id, id)).limit(1);
  if (!existing[0]) throw new RepositoryNotFoundError("crew", id);
  await db.delete(crew).where(eq(crew.id, id));
}

export const mysqlCrew: CrewRepository = {
  getAll: getAllCrew,
  getById: getCrewById,
  create: createCrew,
  update: updateCrew,
  delete: deleteCrew,
};

/* -------------------------------------------------------------------------- */
/* Admins (read-only)                                                          */
/* -------------------------------------------------------------------------- */

async function getAllAdmins() {
  const rows = await getDb().select().from(admins);
  return rows.map(rowToAdmin);
}

async function getAdminById(id: string) {
  const rows = await getDb().select().from(admins).where(eq(admins.id, id)).limit(1);
  return rows[0] ? rowToAdmin(rows[0]) : null;
}

export const mysqlAdmins: AdminRepository = {
  getAll: getAllAdmins,
  getById: getAdminById,
};

/* -------------------------------------------------------------------------- */
/* Deliveries                                                                  */
/* -------------------------------------------------------------------------- */

async function getAllDeliveries(): Promise<Delivery[]> {
  const rows = await getDb().select().from(deliveries);
  return rows.map(rowToDelivery);
}

async function getDeliveryById(id: string): Promise<Delivery | null> {
  const rows = await getDb().select().from(deliveries).where(eq(deliveries.id, id)).limit(1);
  return rows[0] ? rowToDelivery(rows[0]) : null;
}

async function getDeliveriesByJobId(jobId: string): Promise<Delivery[]> {
  const rows = await getDb().select().from(deliveries).where(eq(deliveries.jobId, jobId));
  return rows.map(rowToDelivery);
}

async function createDelivery(
  data: Parameters<DeliveryRepository["create"]>[0],
): Promise<Delivery> {
  const id = newId();
  return getDb().transaction(async (tx) => {
    await tx.insert(deliveries).values({
      id,
      jobId: data.jobId,
      name: data.name,
      deliveryType: orNull(data.deliveryType),
      quantity: data.quantity === undefined ? null : data.quantity,
      deadline: data.deadline,
      status: data.status,
      deliveredAt: orNull(data.deliveredAt),
      notes: orNull(data.notes),
    });
    const rows = await tx.select().from(deliveries).where(eq(deliveries.id, id)).limit(1);
    if (!rows[0]) throw new RepositoryError("Gagal membaca ulang delivery yang baru dibuat.");
    return rowToDelivery(rows[0]);
  });
}

async function updateDelivery(
  id: string,
  data: Parameters<DeliveryRepository["update"]>[1],
): Promise<Delivery> {
  const db = getDb();
  const existing = await db.select({ id: deliveries.id }).from(deliveries).where(eq(deliveries.id, id)).limit(1);
  if (!existing[0]) throw new RepositoryNotFoundError("deliveries", id);
  return db.transaction(async (tx) => {
    await tx
      .update(deliveries)
      .set({
        jobId: data.jobId,
        name: data.name,
        deliveryType: orNull(data.deliveryType),
        quantity: data.quantity === undefined ? null : data.quantity,
        deadline: data.deadline,
        status: data.status,
        deliveredAt: orNull(data.deliveredAt),
        notes: orNull(data.notes),
      })
      .where(eq(deliveries.id, id));
    const rows = await tx.select().from(deliveries).where(eq(deliveries.id, id)).limit(1);
    if (!rows[0]) throw new RepositoryError("Gagal membaca ulang delivery yang diperbarui.");
    return rowToDelivery(rows[0]);
  });
}

async function deleteDelivery(id: string): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: deliveries.id }).from(deliveries).where(eq(deliveries.id, id)).limit(1);
  if (!existing[0]) throw new RepositoryNotFoundError("deliveries", id);
  await db.delete(deliveries).where(eq(deliveries.id, id));
}

export const mysqlDeliveries: DeliveryRepository = {
  getAll: getAllDeliveries,
  getById: getDeliveryById,
  getByJobId: getDeliveriesByJobId,
  create: createDelivery,
  update: updateDelivery,
  delete: deleteDelivery,
};

/* -------------------------------------------------------------------------- */
/* Job-Crew assignments                                                        */
/* -------------------------------------------------------------------------- */

const overrideRole = alias(crewRoles, "override_role");
const crewDefaultRole = alias(crewRoles, "crew_default_role");

type JobCrewJoinRow = {
  jc: JobCrew;
  overrideName: string | null;
  defaultName: string;
};
// Bentuk baris sebenarnya berasal dari Drizzle; tipe di atas hanya penanda.
type JobCrewSelectRow = {
  jc: Parameters<typeof rowToJobCrew>[0];
  overrideName: string | null;
  defaultName: string | null;
};

function mapJobCrewRow(row: JobCrewSelectRow): JobCrew {
  const roleName = row.overrideName ?? row.defaultName;
  if (!roleName) {
    throw new RepositoryError("Role assignment crew tidak dapat ditentukan (crew_roles kosong).");
  }
  // paymentStatus tidak tersimpan di skema MySQL → tidak diisi di sini
  // (dihitung dari cashflows pada service finance, di luar scope P0B).
  return rowToJobCrew(row.jc, roleName);
}

async function getAllJobCrews(): Promise<JobCrew[]> {
  const rows = await getDb()
    .select({ jc: jobCrews, overrideName: overrideRole.name, defaultName: crewDefaultRole.name })
    .from(jobCrews)
    .leftJoin(overrideRole, eq(jobCrews.crewRoleId, overrideRole.id))
    .innerJoin(crew, eq(jobCrews.crewId, crew.id))
    .innerJoin(crewDefaultRole, eq(crew.crewRoleId, crewDefaultRole.id));
  return rows.map(mapJobCrewRow);
}

async function getJobCrewById(id: string): Promise<JobCrew | null> {
  const rows = await getDb()
    .select({ jc: jobCrews, overrideName: overrideRole.name, defaultName: crewDefaultRole.name })
    .from(jobCrews)
    .leftJoin(overrideRole, eq(jobCrews.crewRoleId, overrideRole.id))
    .innerJoin(crew, eq(jobCrews.crewId, crew.id))
    .innerJoin(crewDefaultRole, eq(crew.crewRoleId, crewDefaultRole.id))
    .where(eq(jobCrews.id, id))
    .limit(1);
  return rows[0] ? mapJobCrewRow(rows[0]) : null;
}

async function getJobCrewsByJobId(jobId: string): Promise<JobCrew[]> {
  const rows = await getDb()
    .select({ jc: jobCrews, overrideName: overrideRole.name, defaultName: crewDefaultRole.name })
    .from(jobCrews)
    .leftJoin(overrideRole, eq(jobCrews.crewRoleId, overrideRole.id))
    .innerJoin(crew, eq(jobCrews.crewId, crew.id))
    .innerJoin(crewDefaultRole, eq(crew.crewRoleId, crewDefaultRole.id))
    .where(eq(jobCrews.jobId, jobId));
  return rows.map(mapJobCrewRow);
}

/**
 * Menentukan override `crew_role_id` berdasarkan role yang diminta.
 * Aturan (PHASE-MYSQL-REDESIGN §7): bila role sama dengan role master crew →
 * NULL (ikuti crew); bila berbeda → resolusi ke `crew_roles.id` (harus ada).
 */
function assertPaymentStatusNotProvided(paymentStatus: PaymentStatus | undefined): void {
  if (paymentStatus !== undefined) {
    throw new RepositoryError(
      "JobCrew.paymentStatus tidak disimpan pada skema MySQL (dihitung dari cashflows vs agreed_amount). Menyimpannya akan menyembunyikan perbedaan → ditolak.",
    );
  }
}

async function createJobCrew(
  data: Parameters<JobCrewRepository["create"]>[0],
): Promise<JobCrew> {
  assertPaymentStatusNotProvided(data.paymentStatus);
  requireFinite(data.actualPayment, "job_crews.agreed_amount");
  const id = newId();
  return getDb().transaction(async (tx) => {
    const crewRows = await tx
      .select({ roleId: crew.crewRoleId, roleName: crewRoles.name })
      .from(crew)
      .innerJoin(crewRoles, eq(crew.crewRoleId, crewRoles.id))
      .where(eq(crew.id, data.crewId))
      .limit(1);
    if (!crewRows[0]) {
      throw new RepositoryError(`Crew '${data.crewId}' tidak ditemukan.`);
    }
    let overrideRoleId: string | null = null;
    if (data.role !== crewRows[0].roleName) {
      const roleRows = await tx
        .select({ id: crewRoles.id })
        .from(crewRoles)
        .where(eq(crewRoles.name, data.role))
        .limit(1);
      if (!roleRows[0]) {
        throw new RepositoryError(
          `Role crew '${data.role}' tidak ditemukan di tabel crew_roles.`,
        );
      }
      overrideRoleId = roleRows[0].id;
    }
    await tx.insert(jobCrews).values({
      id,
      jobId: data.jobId,
      crewId: data.crewId,
      crewRoleId: overrideRoleId,
      agreedAmount: numberToDecimal(data.actualPayment, "job_crews.agreedAmount"),
      notes: orNull(data.notes),
    });
    const rows = await tx
      .select({ jc: jobCrews, overrideName: overrideRole.name, defaultName: crewDefaultRole.name })
      .from(jobCrews)
      .leftJoin(overrideRole, eq(jobCrews.crewRoleId, overrideRole.id))
      .innerJoin(crew, eq(jobCrews.crewId, crew.id))
      .innerJoin(crewDefaultRole, eq(crew.crewRoleId, crewDefaultRole.id))
      .where(eq(jobCrews.id, id))
      .limit(1);
    if (!rows[0]) throw new RepositoryError("Gagal membaca ulang assignment crew.");
    return mapJobCrewRow(rows[0]);
  });
}

async function updateJobCrew(
  id: string,
  data: Parameters<JobCrewRepository["update"]>[1],
): Promise<JobCrew> {
  assertPaymentStatusNotProvided(data.paymentStatus);
  requireFinite(data.actualPayment, "job_crews.agreed_amount");
  const db = getDb();
  const existing = await db.select({ id: jobCrews.id }).from(jobCrews).where(eq(jobCrews.id, id)).limit(1);
  if (!existing[0]) throw new RepositoryNotFoundError("job_crews", id);
  return db.transaction(async (tx) => {
    const crewRows = await tx
      .select({ roleId: crew.crewRoleId, roleName: crewRoles.name })
      .from(crew)
      .innerJoin(crewRoles, eq(crew.crewRoleId, crewRoles.id))
      .where(eq(crew.id, data.crewId))
      .limit(1);
    if (!crewRows[0]) throw new RepositoryError(`Crew '${data.crewId}' tidak ditemukan.`);
    let overrideRoleId: string | null = null;
    if (data.role !== crewRows[0].roleName) {
      const roleRows = await tx
        .select({ id: crewRoles.id })
        .from(crewRoles)
        .where(eq(crewRoles.name, data.role))
        .limit(1);
      if (!roleRows[0]) {
        throw new RepositoryError(`Role crew '${data.role}' tidak ditemukan di tabel crew_roles.`);
      }
      overrideRoleId = roleRows[0].id;
    }
    await tx
      .update(jobCrews)
      .set({
        jobId: data.jobId,
        crewId: data.crewId,
        crewRoleId: overrideRoleId,
        agreedAmount: numberToDecimal(data.actualPayment, "job_crews.agreedAmount"),
        notes: orNull(data.notes),
      })
      .where(eq(jobCrews.id, id));
    const rows = await tx
      .select({ jc: jobCrews, overrideName: overrideRole.name, defaultName: crewDefaultRole.name })
      .from(jobCrews)
      .leftJoin(overrideRole, eq(jobCrews.crewRoleId, overrideRole.id))
      .innerJoin(crew, eq(jobCrews.crewId, crew.id))
      .innerJoin(crewDefaultRole, eq(crew.crewRoleId, crewDefaultRole.id))
      .where(eq(jobCrews.id, id))
      .limit(1);
    if (!rows[0]) throw new RepositoryError("Gagal membaca ulang assignment crew.");
    return mapJobCrewRow(rows[0]);
  });
}

async function deleteJobCrew(id: string): Promise<void> {
  const db = getDb();
  const existing = await db.select({ id: jobCrews.id }).from(jobCrews).where(eq(jobCrews.id, id)).limit(1);
  if (!existing[0]) throw new RepositoryNotFoundError("job_crews", id);
  await db.delete(jobCrews).where(eq(jobCrews.id, id));
}

export const mysqlJobCrews: JobCrewRepository = {
  getAll: getAllJobCrews,
  getById: getJobCrewById,
  getByJobId: getJobCrewsByJobId,
  create: createJobCrew,
  update: updateJobCrew,
  delete: deleteJobCrew,
};

// Referensi tipe agar `JobCrewJoinRow` tidak dianggap unused oleh lint.
export type { JobCrewJoinRow };

/* -------------------------------------------------------------------------- */
/* Payments (schedule) — READ ONLY (status derived)                            */
/* -------------------------------------------------------------------------- */

type PaymentReferenceType = "client_payment" | "vendor_payment";

/**
 * Total kas terbayar per `reference_id` dari `cashflows`. Agregat
 * `coalesce(sum(...))` adalah satu-satunya SQL mentah di sini dan
 * terdokumentasi (status dihitung, tidak disimpan — PHASE-MYSQL-REDESIGN §8).
 */
async function paidTotals(referenceType: PaymentReferenceType): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({
      ref: cashflows.referenceId,
      total: sql<string>`coalesce(sum(${cashflows.amount}), 0)`,
    })
    .from(cashflows)
    .where(eq(cashflows.referenceType, referenceType))
    .groupBy(cashflows.referenceId);
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.ref) map.set(row.ref, Number(row.total));
  }
  return map;
}

function derivePaymentStatus(amount: number, paid: number): PaymentStatus {
  if (paid <= 0) return "UNPAID";
  if (paid < amount) return "PARTIAL";
  return "PAID";
}

async function clientPaymentRows(): Promise<Array<{ row: ClientPaymentRow; status: PaymentStatus }>> {
  const db = getDb();
  const rows = await db.select().from(clientPayments);
  const paid = await paidTotals("client_payment");
  return rows.map((row) => ({
    row,
    status: derivePaymentStatus(decimalToNumber(row.amount, "payment.amount"), paid.get(row.id) ?? 0),
  }));
}

async function getAllClientPayments() {
  const rows = await clientPaymentRows();
  return rows.map(({ row, status }) => rowToClientPayment(row, status));
}

async function getClientPaymentById(id: string) {
  const db = getDb();
  const rows = await db.select().from(clientPayments).where(eq(clientPayments.id, id)).limit(1);
  if (!rows[0]) return null;
  const paid = await paidTotals("client_payment");
  return rowToClientPayment(
    rows[0],
    derivePaymentStatus(decimalToNumber(rows[0].amount, "client_payments.amount"), paid.get(id) ?? 0),
  );
}

async function getClientPaymentsByJobId(jobId: string) {
  const db = getDb();
  const rows = await db.select().from(clientPayments).where(eq(clientPayments.jobId, jobId));
  const paid = await paidTotals("client_payment");
  return rows.map((row) =>
    rowToClientPayment(
      row,
      derivePaymentStatus(decimalToNumber(row.amount, "client_payments.amount"), paid.get(row.id) ?? 0),
    ),
  );
}

async function vendorPaymentRows(): Promise<Array<{ row: VendorPaymentRow; status: PaymentStatus }>> {
  const db = getDb();
  const rows = await db.select().from(vendorPayments);
  const paid = await paidTotals("vendor_payment");
  return rows.map((row) => ({
    row,
    status: derivePaymentStatus(decimalToNumber(row.amount, "payment.amount"), paid.get(row.id) ?? 0),
  }));
}

async function getAllVendorPayments() {
  const rows = await vendorPaymentRows();
  return rows.map(({ row, status }) => rowToVendorPayment(row, status));
}

async function getVendorPaymentById(id: string) {
  const db = getDb();
  const rows = await db.select().from(vendorPayments).where(eq(vendorPayments.id, id)).limit(1);
  if (!rows[0]) return null;
  const paid = await paidTotals("vendor_payment");
  return rowToVendorPayment(
    rows[0],
    derivePaymentStatus(decimalToNumber(rows[0].amount, "vendor_payments.amount"), paid.get(id) ?? 0),
  );
}

async function getVendorPaymentsByJobId(jobId: string) {
  const db = getDb();
  const rows = await db.select().from(vendorPayments).where(eq(vendorPayments.jobId, jobId));
  const paid = await paidTotals("vendor_payment");
  return rows.map((row) =>
    rowToVendorPayment(
      row,
      derivePaymentStatus(decimalToNumber(row.amount, "vendor_payments.amount"), paid.get(row.id) ?? 0),
    ),
  );
}

const CLIENT_PAYMENT_WRITE_REASON =
  "Kontrak mewajibkan field 'status' (UNPAID/PARTIAL/PAID) yang secara desain tidak disimpan di kolom (dihitung dari cashflows). Menulis jadwal tanpa menyimpan status berisiko menyembunyikan perbedaan, sehingga write diblokir sampai adapter/keputusan disetujui.";
const VENDOR_PAYMENT_WRITE_REASON =
  "Kontrak mewajibkan field 'status' (UNPAID/PARTIAL/PAID) yang secara desain tidak disimpan di kolom (dihitung dari cashflows). Menulis jadwal tanpa menyimpan status berisiko menyembunyikan perbedaan, sehingga write diblokir sampai adapter/keputusan disetujui.";

export const mysqlClientPayments: ClientPaymentRepository = {
  getAll: getAllClientPayments,
  getById: getClientPaymentById,
  getByJobId: getClientPaymentsByJobId,
  create: async () => {
    throw new RepositoryBlockedError("client_payments.create", CLIENT_PAYMENT_WRITE_REASON);
  },
  update: async () => {
    throw new RepositoryBlockedError("client_payments.update", CLIENT_PAYMENT_WRITE_REASON);
  },
  delete: async () => {
    throw new RepositoryBlockedError("client_payments.delete", CLIENT_PAYMENT_WRITE_REASON);
  },
};

export const mysqlVendorPayments: VendorPaymentRepository = {
  getAll: getAllVendorPayments,
  getById: getVendorPaymentById,
  getByJobId: getVendorPaymentsByJobId,
  create: async () => {
    throw new RepositoryBlockedError("vendor_payments.create", VENDOR_PAYMENT_WRITE_REASON);
  },
  update: async () => {
    throw new RepositoryBlockedError("vendor_payments.update", VENDOR_PAYMENT_WRITE_REASON);
  },
  delete: async () => {
    throw new RepositoryBlockedError("vendor_payments.delete", VENDOR_PAYMENT_WRITE_REASON);
  },
};

/* -------------------------------------------------------------------------- */
/* Blocked repositories: venues, expenses                                      */
/* -------------------------------------------------------------------------- */

const VENUE_REASON =
  "Tabel 'venues' tidak ada pada skema MySQL (konsep Venue dihapus); domain Venue tidak memiliki representasi persistence.";
const EXPENSE_REASON =
  "Tabel 'expenses' tidak ada pada skema MySQL; redesain menggantinya dengan 'cashflows' (direction=EXPENSE) yang bukan bagian dari kontrak DataRepositories.";

export const mysqlVenues: VenueRepository = {
  getAll: async (): Promise<Venue[]> => {
    throw new RepositoryBlockedError("venues.getAll", VENUE_REASON);
  },
  getById: async (): Promise<Venue | null> => {
    throw new RepositoryBlockedError("venues.getById", VENUE_REASON);
  },
  create: async (): Promise<Venue> => {
    throw new RepositoryBlockedError("venues.create", VENUE_REASON);
  },
  update: async (): Promise<Venue> => {
    throw new RepositoryBlockedError("venues.update", VENUE_REASON);
  },
  delete: async (): Promise<void> => {
    throw new RepositoryBlockedError("venues.delete", VENUE_REASON);
  },
};

export const mysqlExpenses: ExpenseRepository = {
  getAll: async (): Promise<never[]> => {
    throw new RepositoryBlockedError("expenses.getAll", EXPENSE_REASON);
  },
  getById: async (): Promise<null> => {
    throw new RepositoryBlockedError("expenses.getById", EXPENSE_REASON);
  },
  getByJobId: async (): Promise<never[]> => {
    throw new RepositoryBlockedError("expenses.getByJobId", EXPENSE_REASON);
  },
  create: async (): Promise<never> => {
    throw new RepositoryBlockedError("expenses.create", EXPENSE_REASON);
  },
  update: async (): Promise<never> => {
    throw new RepositoryBlockedError("expenses.update", EXPENSE_REASON);
  },
  delete: async (): Promise<void> => {
    throw new RepositoryBlockedError("expenses.delete", EXPENSE_REASON);
  },
};

/* -------------------------------------------------------------------------- */
/* Aggregate export                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Kumpulan repository MySQL. BELUM diaktifkan — `getRepositories()` tetap
 * mengembalikan `googleRepositories`. Termasuk stub BLOCKED untuk `venues`
 * dan `expenses` serta write `clientPayments`/`vendorPayments`.
 */
export const mysqlRepositories: DataRepositories = {
  jobs: mysqlJobs,
  clients: mysqlClients,
  vendors: mysqlVendors,
  venues: mysqlVenues,
  crew: mysqlCrew,
  deliveries: mysqlDeliveries,
  jobCrews: mysqlJobCrews,
  clientPayments: mysqlClientPayments,
  vendorPayments: mysqlVendorPayments,
  expenses: mysqlExpenses,
  admins: mysqlAdmins,
};
