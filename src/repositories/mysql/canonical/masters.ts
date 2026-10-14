import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { Database } from "@/db";
import { clients, crew, crewRoles, vendors } from "@/db/schema";
import type {
  CreateClientInput,
  CreateCrewInput,
  CreateCrewRoleInput,
  CreateVendorInput,
} from "@/domain/inputs";
import type { Client, Crew, CrewRole, Vendor } from "@/domain/types";
import type {
  CanonicalClientRepository,
  CanonicalCrewRepository,
  CanonicalCrewRoleRepository,
  CanonicalVendorRepository,
} from "@/repositories/contract";
import {
  RepositoryError,
  RepositoryNotFoundError,
} from "@/repositories/mysql/errors";
import {
  rowToCanonicalClient,
  rowToCanonicalCrew,
  rowToCanonicalVendor,
  rowToCrewRole,
} from "@/repositories/mysql/canonical/mapping";
import { requireNonNegativeAmount } from "@/repositories/mysql/finance/values";

/**
 * Repository master KANONIK (Contract v2): clients, vendors, crew_roles, crew.
 *
 * Semua dibuat lewat factory dengan resolusi koneksi eksplisit (P0C-3) sehingga
 * factory kanonik menyuntikkan satu koneksi ke seluruh repository. Tidak ada
 * singleton modul untuk repository ini: aggregat hanya dibentuk oleh factory.
 *
 * Referensi yang tidak ada (mis. `crewRoleId`) diperiksa lebih dulu dan
 * menghasilkan error domain eksplisit; FK/UNIQUE driver tetap diteruskan apa
 * adanya sebagai jaring terakhir.
 */

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

function requireText(value: string | undefined, field: string, maxLength: number): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new RepositoryError(`'${field}' wajib diisi.`);
  if (trimmed.length > maxLength) {
    throw new RepositoryError(`'${field}' melebihi ${maxLength} karakter.`);
  }
  return trimmed;
}

function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/* -------------------------------------------------------------------------- */
/* Clients                                                                     */
/* -------------------------------------------------------------------------- */

async function getClientById(db: Database, id: string): Promise<Client | null> {
  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return rows[0] ? rowToCanonicalClient(rows[0]) : null;
}

async function createClient(db: Database, data: CreateClientInput): Promise<Client> {
  const name = requireText(data.name, "client.name", 120);
  const id = randomUUID();
  await db.insert(clients).values({
    id,
    name,
    companyName: optionalText(data.companyName),
    contactPerson: optionalText(data.contactPerson),
    phone: optionalText(data.phone),
    email: optionalText(data.email),
    address: optionalText(data.address),
    clientType: optionalText(data.clientType),
    notes: optionalText(data.notes),
  });
  const created = await getClientById(db, id);
  if (!created) throw new RepositoryError("Gagal membaca ulang client yang baru dibuat.");
  return created;
}

async function updateClient(
  db: Database,
  id: string,
  data: CreateClientInput,
): Promise<Client> {
  const existing = await getClientById(db, id);
  if (!existing) throw new RepositoryNotFoundError("clients", id);
  const name = requireText(data.name, "client.name", 120);
  await db
    .update(clients)
    .set({
      name,
      companyName: optionalText(data.companyName),
      contactPerson: optionalText(data.contactPerson),
      phone: optionalText(data.phone),
      email: optionalText(data.email),
      address: optionalText(data.address),
      clientType: optionalText(data.clientType),
      notes: optionalText(data.notes),
    })
    .where(eq(clients.id, id));
  const updated = await getClientById(db, id);
  if (!updated) throw new RepositoryError("Gagal membaca ulang client yang diperbarui.");
  return updated;
}

async function deleteClient(db: Database, id: string): Promise<void> {
  const existing = await getClientById(db, id);
  if (!existing) throw new RepositoryNotFoundError("clients", id);
  await db.delete(clients).where(eq(clients.id, id));
}

export function createClientRepository(
  resolveDb: () => Database,
): CanonicalClientRepository {
  return {
    getAll: async () => (await resolveDb().select().from(clients)).map(rowToCanonicalClient),
    getById: (id) => getClientById(resolveDb(), id),
    create: (data) => createClient(resolveDb(), data),
    update: (id, data) => updateClient(resolveDb(), id, data),
    delete: (id) => deleteClient(resolveDb(), id),
  };
}

/* -------------------------------------------------------------------------- */
/* Vendors                                                                     */
/* -------------------------------------------------------------------------- */

async function getVendorById(db: Database, id: string): Promise<Vendor | null> {
  const rows = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  return rows[0] ? rowToCanonicalVendor(rows[0]) : null;
}

async function createVendor(db: Database, data: CreateVendorInput): Promise<Vendor> {
  const name = requireText(data.name, "vendor.name", 120);
  const id = randomUUID();
  await db.insert(vendors).values({
    id,
    name,
    contactPerson: optionalText(data.contactPerson),
    phone: optionalText(data.phone),
    email: optionalText(data.email),
    notes: optionalText(data.notes),
  });
  const created = await getVendorById(db, id);
  if (!created) throw new RepositoryError("Gagal membaca ulang vendor yang baru dibuat.");
  return created;
}

async function updateVendor(
  db: Database,
  id: string,
  data: CreateVendorInput,
): Promise<Vendor> {
  const existing = await getVendorById(db, id);
  if (!existing) throw new RepositoryNotFoundError("vendors", id);
  const name = requireText(data.name, "vendor.name", 120);
  await db
    .update(vendors)
    .set({
      name,
      contactPerson: data.contactPerson === undefined ? existing.contactPerson : optionalText(data.contactPerson),
      phone: optionalText(data.phone),
      email: optionalText(data.email),
      notes: optionalText(data.notes),
    })
    .where(eq(vendors.id, id));
  const updated = await getVendorById(db, id);
  if (!updated) throw new RepositoryError("Gagal membaca ulang vendor yang diperbarui.");
  return updated;
}

async function deleteVendor(db: Database, id: string): Promise<void> {
  const existing = await getVendorById(db, id);
  if (!existing) throw new RepositoryNotFoundError("vendors", id);
  await db.delete(vendors).where(eq(vendors.id, id));
}

export function createVendorRepository(
  resolveDb: () => Database,
): CanonicalVendorRepository {
  return {
    getAll: async () => (await resolveDb().select().from(vendors)).map(rowToCanonicalVendor),
    getById: (id) => getVendorById(resolveDb(), id),
    create: (data) => createVendor(resolveDb(), data),
    update: (id, data) => updateVendor(resolveDb(), id, data),
    delete: (id) => deleteVendor(resolveDb(), id),
  };
}

/* -------------------------------------------------------------------------- */
/* Crew roles                                                                  */
/* -------------------------------------------------------------------------- */

async function getCrewRoleById(db: Database, id: string): Promise<CrewRole | null> {
  const rows = await db.select().from(crewRoles).where(eq(crewRoles.id, id)).limit(1);
  return rows[0] ? rowToCrewRole(rows[0]) : null;
}

async function createCrewRole(db: Database, data: CreateCrewRoleInput): Promise<CrewRole> {
  const name = requireText(data.name, "crewRole.name", 60);
  const id = randomUUID();
  await db.insert(crewRoles).values({
    id,
    name,
    sortOrder: data.sortOrder ?? 0,
    isActive: data.isActive ?? true,
  });
  const created = await getCrewRoleById(db, id);
  if (!created) throw new RepositoryError("Gagal membaca ulang crew role yang baru dibuat.");
  return created;
}

async function updateCrewRole(
  db: Database,
  id: string,
  data: CreateCrewRoleInput,
): Promise<CrewRole> {
  const existing = await getCrewRoleById(db, id);
  if (!existing) throw new RepositoryNotFoundError("crew_roles", id);
  const name = requireText(data.name, "crewRole.name", 60);
  await db
    .update(crewRoles)
    .set({
      name,
      sortOrder: data.sortOrder ?? existing.sortOrder,
      isActive: data.isActive ?? existing.isActive,
    })
    .where(eq(crewRoles.id, id));
  const updated = await getCrewRoleById(db, id);
  if (!updated) throw new RepositoryError("Gagal membaca ulang crew role yang diperbarui.");
  return updated;
}

async function deleteCrewRole(db: Database, id: string): Promise<void> {
  const existing = await getCrewRoleById(db, id);
  if (!existing) throw new RepositoryNotFoundError("crew_roles", id);
  // crew.crew_role_id & job_crews.crew_role_id memakai RESTRICT/SET NULL dari DB.
  await db.delete(crewRoles).where(eq(crewRoles.id, id));
}

export function createCrewRoleRepository(
  resolveDb: () => Database,
): CanonicalCrewRoleRepository {
  return {
    getAll: async () =>
      (await resolveDb().select().from(crewRoles)).map(rowToCrewRole),
    getById: (id) => getCrewRoleById(resolveDb(), id),
    create: (data) => createCrewRole(resolveDb(), data),
    update: (id, data) => updateCrewRole(resolveDb(), id, data),
    delete: (id) => deleteCrewRole(resolveDb(), id),
  };
}

/* -------------------------------------------------------------------------- */
/* Crew                                                                        */
/* -------------------------------------------------------------------------- */

async function getCrewById(db: Database, id: string): Promise<Crew | null> {
  const rows = await db.select().from(crew).where(eq(crew.id, id)).limit(1);
  return rows[0] ? rowToCanonicalCrew(rows[0]) : null;
}

/** `crewRoleId` harus ada di `crew_roles` (tidak ada pembuatan role implisit). */
async function requireCrewRole(db: Database, crewRoleId: string): Promise<void> {
  if (!hasValue(crewRoleId)) throw new RepositoryError("crew.crewRoleId wajib diisi.");
  const rows = await db
    .select({ id: crewRoles.id })
    .from(crewRoles)
    .where(eq(crewRoles.id, crewRoleId))
    .limit(1);
  if (!rows[0]) throw new RepositoryNotFoundError("crew_roles", crewRoleId);
}

async function createCrew(db: Database, data: CreateCrewInput): Promise<Crew> {
  const name = requireText(data.name, "crew.name", 120);
  const defaultPayment = requireNonNegativeAmount(data.defaultPayment, "crew.defaultPayment");
  await requireCrewRole(db, data.crewRoleId);
  const id = randomUUID();
  await db.insert(crew).values({
    id,
    name,
    crewRoleId: data.crewRoleId,
    defaultPayment,
    phone: optionalText(data.phone),
    notes: optionalText(data.notes),
  });
  const created = await getCrewById(db, id);
  if (!created) throw new RepositoryError("Gagal membaca ulang crew yang baru dibuat.");
  return created;
}

async function updateCrew(db: Database, id: string, data: CreateCrewInput): Promise<Crew> {
  const existing = await getCrewById(db, id);
  if (!existing) throw new RepositoryNotFoundError("crew", id);
  const name = requireText(data.name, "crew.name", 120);
  const defaultPayment = requireNonNegativeAmount(data.defaultPayment, "crew.defaultPayment");
  await requireCrewRole(db, data.crewRoleId);
  await db
    .update(crew)
    .set({
      name,
      crewRoleId: data.crewRoleId,
      defaultPayment,
      phone: optionalText(data.phone),
      notes: optionalText(data.notes),
    })
    .where(eq(crew.id, id));
  const updated = await getCrewById(db, id);
  if (!updated) throw new RepositoryError("Gagal membaca ulang crew yang diperbarui.");
  return updated;
}

async function deleteCrew(db: Database, id: string): Promise<void> {
  const existing = await getCrewById(db, id);
  if (!existing) throw new RepositoryNotFoundError("crew", id);
  await db.delete(crew).where(eq(crew.id, id));
}

export function createCrewRepository(resolveDb: () => Database): CanonicalCrewRepository {
  return {
    getAll: async () => (await resolveDb().select().from(crew)).map(rowToCanonicalCrew),
    getById: (id) => getCrewById(resolveDb(), id),
    create: (data) => createCrew(resolveDb(), data),
    update: (id, data) => updateCrew(resolveDb(), id, data),
    delete: (id) => deleteCrew(resolveDb(), id),
  };
}

