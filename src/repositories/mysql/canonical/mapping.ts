import type { InferSelectModel } from "drizzle-orm";

import {
  admins,
  clients,
  crew,
  crewRoles,
  deliveries,
  jobs,
  packages,
  sessions,
  vendors,
} from "@/db/schema";
import { parseAmount } from "@/domain/money";
import type {
  Admin,
  Client,
  Crew,
  CrewRole,
  Delivery,
  Job,
  Package,
  SessionRecord,
  Vendor,
} from "@/domain/types";
import {
  isAdminRole,
  isClientType,
  isDeliveryStatus,
  isJobCategory,
  isJobStatus,
} from "@/domain/validation";
import { RepositoryError } from "@/repositories/mysql/errors";

/**
 * Mapping murni baris MySQL → domain KANONIK (Contract v2).
 *
 * Berbeda dari `src/repositories/mysql/mapping.ts` (legacy: uang `number`,
 * crew pakai `role` string), mapping ini memakai:
 * - uang sebagai `Amount` (string desimal, tanpa floating point);
 * - `Crew.crewRoleId` (FK ternormalisasi), bukan nama role;
 * - `Job.legacyVenueName` (histori), tanpa `venueId`.
 *
 * Nilai enum divalidasi terhadap allow-list domain; nilai tak dikenal → error
 * eksplisit (tidak ada casting buta, tidak ada default bisnis yang dikarang).
 */

export type ClientRow = InferSelectModel<typeof clients>;
export type PackageRow = InferSelectModel<typeof packages>;
export type VendorRow = InferSelectModel<typeof vendors>;
export type CrewRoleRow = InferSelectModel<typeof crewRoles>;
export type CanonicalCrewRow = InferSelectModel<typeof crew>;
export type JobRow = InferSelectModel<typeof jobs>;
export type DeliveryRow = InferSelectModel<typeof deliveries>;
export type AdminRow = InferSelectModel<typeof admins>;
export type SessionRow = InferSelectModel<typeof sessions>;

function opt(value: string | null | undefined): string | undefined {
  return value === null || value === undefined ? undefined : value;
}

function requireEnum<T extends string>(
  value: string,
  guard: (candidate: string) => candidate is T,
  field: string,
): T {
  if (!guard(value)) {
    throw new RepositoryError(`Nilai kolom '${field}' tidak valid: '${value}'.`);
  }
  return value;
}

export function rowToCanonicalClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    companyName: opt(row.companyName),
    contactPerson: opt(row.contactPerson),
    phone: opt(row.phone),
    email: opt(row.email),
    address: opt(row.address),
    clientType: row.clientType === null ? undefined : requireEnum(row.clientType, isClientType, "clients.client_type"),
    notes: opt(row.notes),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToPackage(row: PackageRow): Package {
  return {
    id: row.id,
    name: row.name,
    description: opt(row.description),
    sortOrder: Number(row.sortOrder),
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToCanonicalVendor(row: VendorRow): Vendor {
  return {
    id: row.id,
    name: row.name,
    contactPerson: opt(row.contactPerson),
    phone: opt(row.phone),
    email: opt(row.email),
    notes: opt(row.notes),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToCrewRole(row: CrewRoleRow): CrewRole {
  return {
    id: row.id,
    name: row.name,
    sortOrder: Number(row.sortOrder),
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToCanonicalCrew(row: CanonicalCrewRow): Crew {
  return {
    id: row.id,
    name: row.name,
    crewRoleId: row.crewRoleId,
    defaultPayment: parseAmount(row.defaultPayment),
    phone: opt(row.phone),
    notes: opt(row.notes),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToCanonicalJob(row: JobRow): Job {
  return {
    id: row.id,
    jobNumber: row.jobNumber,
    jobName: row.jobName,
    category: requireEnum(row.category, isJobCategory, "jobs.category"),
    clientId: opt(row.clientId),
    vendorId: opt(row.vendorId),
    packageId: opt(row.packageId),
    executionDate: row.executionDate,
    status: requireEnum(row.status, isJobStatus, "jobs.status"),
    location: opt(row.location),
    notes: opt(row.notes),
    legacyVenueName: opt(row.legacyVenueName),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToCanonicalDelivery(row: DeliveryRow): Delivery {
  return {
    id: row.id,
    jobId: row.jobId,
    name: row.name,
    deliveryType: opt(row.deliveryType),
    quantity: row.quantity === null ? undefined : Number(row.quantity),
    deadline: row.deadline,
    status: requireEnum(row.status, isDeliveryStatus, "deliveries.status"),
    deliveredAt: opt(row.deliveredAt),
    notes: opt(row.notes),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToCanonicalAdmin(row: AdminRow): Admin {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: requireEnum(row.role, isAdminRole, "admins.role"),
    isActive: Boolean(row.isActive),
    lastLoginAt: opt(row.lastLoginAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToSessionRecord(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    adminId: row.adminId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    lastSeenAt: opt(row.lastSeenAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
