"use server";

import { revalidatePath } from "next/cache";

import type { ClientType } from "@/domain/types";
import { isClientType } from "@/domain/validation";
import {
  createClient,
  createCrew,
  createCrewRole,
  createPackage,
  createVendor,
  deleteClient,
  deleteCrew,
  deleteCrewRole,
  deletePackage,
  deleteVendor,
  updateClient,
  updateCrew,
  updateCrewRole,
  updatePackage,
  updateVendor,
} from "@/services/master-service";
import { parseAmountInput } from "@/lib/utils";
import { assertAuthenticatedAdmin } from "@/lib/auth";

export type MasterActionResult = { ok: true } | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}

function requireText(values: Record<string, string>, key: string, label: string): string {
  const value = values[key]?.trim();
  if (!value) throw new Error(`${label} is required diisi.`);
  return value;
}

function optionalText(values: Record<string, string>, key: string): string | undefined {
  const value = values[key]?.trim();
  return value ? value : undefined;
}

async function run(
  action: () => Promise<unknown>,
  paths: string[],
): Promise<MasterActionResult> {
  try {
    await assertAuthenticatedAdmin();
    await action();
    for (const path of paths) revalidatePath(path);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/* -------------------------------------------------------------------------- */
/* Clients (canonical fields; NO legacy venue/expense concepts)                */
/* -------------------------------------------------------------------------- */

function clientInputFrom(values: Record<string, string>) {
  const clientType = values.clientType?.trim();
  if (clientType && !isClientType(clientType)) {
    throw new Error("Invalid client type.");
  }
  return {
    name: requireText(values, "name", "Client name"),
    companyName: optionalText(values, "companyName"),
    contactPerson: optionalText(values, "contactPerson"),
    phone: optionalText(values, "phone"),
    email: optionalText(values, "email"),
    address: optionalText(values, "address"),
    clientType: (clientType || undefined) as ClientType | undefined,
    notes: optionalText(values, "notes"),
  };
}

export async function createClientAction(
  values: Record<string, string>,
): Promise<MasterActionResult> {
  return run(() => createClient(clientInputFrom(values)), ["/clients", "/jobs"]);
}

export async function updateClientAction(
  id: string,
  values: Record<string, string>,
): Promise<MasterActionResult> {
  return run(() => updateClient(id, clientInputFrom(values)), ["/clients", "/jobs"]);
}

export async function deleteClientAction(id: string): Promise<MasterActionResult> {
  return run(() => deleteClient(id), ["/clients", "/jobs"]);
}

function packageInputFrom(values: Record<string, string>) {
  const sortOrderRaw = values.sortOrder?.trim();
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : 0;
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new Error("Sort order must be a whole number of zero or greater.");
  }
  return {
    name: requireText(values, "name", "Package name"),
    description: optionalText(values, "description"),
    sortOrder,
    isActive: values.isActive !== "false",
  };
}

export async function createPackageAction(values: Record<string, string>): Promise<MasterActionResult> {
  return run(() => createPackage(packageInputFrom(values)), ["/packages", "/jobs"]);
}

export async function updatePackageAction(id: string, values: Record<string, string>): Promise<MasterActionResult> {
  return run(() => updatePackage(id, packageInputFrom(values)), ["/packages", "/jobs"]);
}

export async function deletePackageAction(id: string): Promise<MasterActionResult> {
  return run(() => deletePackage(id), ["/packages", "/jobs"]);
}

/* -------------------------------------------------------------------------- */
/* Vendors                                                                    */
/* -------------------------------------------------------------------------- */

function vendorInputFrom(values: Record<string, string>) {
  return {
    name: requireText(values, "name", "Vendor name"),
    phone: optionalText(values, "contact"),
    email: optionalText(values, "email"),
    notes: optionalText(values, "notes"),
  };
}

export async function createVendorAction(
  values: Record<string, string>,
): Promise<MasterActionResult> {
  return run(() => createVendor(vendorInputFrom(values)), ["/vendors", "/jobs"]);
}

export async function updateVendorAction(
  id: string,
  values: Record<string, string>,
): Promise<MasterActionResult> {
  return run(() => updateVendor(id, vendorInputFrom(values)), ["/vendors", "/jobs"]);
}

export async function deleteVendorAction(id: string): Promise<MasterActionResult> {
  return run(() => deleteVendor(id), ["/vendors", "/jobs"]);
}

/* -------------------------------------------------------------------------- */
/* Crew roles (canonical crew_roles)                                          */
/* -------------------------------------------------------------------------- */

function crewRoleInputFrom(values: Record<string, string>) {
  const sortOrderRaw = values.sortOrder?.trim();
  let sortOrder: number | undefined;
  if (sortOrderRaw) {
    const parsed = Number(sortOrderRaw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error("Urutan role harus bilangan bulat >= 0.");
    }
    sortOrder = parsed;
  }
  return {
    name: requireText(values, "name", "Role name"),
    sortOrder,
    isActive: values.isActive === undefined ? undefined : values.isActive === "true",
  };
}

export async function createCrewRoleAction(
  values: Record<string, string>,
): Promise<MasterActionResult> {
  return run(() => createCrewRole(crewRoleInputFrom(values)), ["/crew"]);
}

export async function updateCrewRoleAction(
  id: string,
  values: Record<string, string>,
): Promise<MasterActionResult> {
  return run(() => updateCrewRole(id, crewRoleInputFrom(values)), ["/crew"]);
}

export async function deleteCrewRoleAction(id: string): Promise<MasterActionResult> {
  return run(() => deleteCrewRole(id), ["/crew"]);
}

/* -------------------------------------------------------------------------- */
/* Crew (role MUST reference crew_roles; no free-text role)                    */
/* -------------------------------------------------------------------------- */

function crewInputFrom(values: Record<string, string>) {
  const crewRoleId = requireText(values, "crewRoleId", "Role crew");
  const amount = parseAmountInput(values.defaultPayment);
  if (amount === null) {
    throw new Error("Default payment harus angka valid (mis. 1500000 atau 1500000.55).");
  }
  return {
    name: requireText(values, "name", "Crew name"),
    crewRoleId,
    defaultPayment: amount,
    phone: optionalText(values, "phone"),
    notes: optionalText(values, "notes"),
  };
}

export async function createCrewAction(
  values: Record<string, string>,
): Promise<MasterActionResult> {
  return run(() => createCrew(crewInputFrom(values)), ["/crew", "/jobs"]);
}

export async function updateCrewAction(
  id: string,
  values: Record<string, string>,
): Promise<MasterActionResult> {
  return run(() => updateCrew(id, crewInputFrom(values)), ["/crew", "/jobs"]);
}

export async function deleteCrewAction(id: string): Promise<MasterActionResult> {
  return run(() => deleteCrew(id), ["/crew", "/jobs"]);
}
