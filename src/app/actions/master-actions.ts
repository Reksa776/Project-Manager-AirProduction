"use server";

import { revalidatePath } from "next/cache";

import {
  createClient,
  createCrew,
  createVenue,
  createVendor,
  deleteClient,
  deleteCrew,
  deleteVenue,
  deleteVendor,
  updateClient,
  updateCrew,
  updateVenue,
  updateVendor,
} from "@/services/master-service";

export type MasterActionResult = { ok: true } | { ok: false; error: string };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}

async function run(action: () => Promise<unknown>, path: string): Promise<MasterActionResult> {
  try {
    await action();
    revalidatePath(path);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

function parseNumber(raw: string | undefined): number {
  if (!raw || !raw.trim()) return NaN;
  return Number(raw.replace(/\./g, "").replace(/,/g, "").trim());
}

/* Clients */
export async function createClientAction(values: Record<string, string>): Promise<MasterActionResult> {
  return run(() => createClient({ name: values.name, address: values.address, phone: values.phone, notes: values.notes }), "/clients");
}
export async function updateClientAction(id: string, values: Record<string, string>): Promise<MasterActionResult> {
  return run(() => updateClient(id, { name: values.name, address: values.address, phone: values.phone, notes: values.notes }), "/clients");
}
export async function deleteClientAction(id: string): Promise<MasterActionResult> {
  return run(() => deleteClient(id), "/clients");
}

/* Vendors */
export async function createVendorAction(values: Record<string, string>): Promise<MasterActionResult> {
  return run(() => createVendor({ name: values.name, phone: values.phone, notes: values.notes }), "/vendors");
}
export async function updateVendorAction(id: string, values: Record<string, string>): Promise<MasterActionResult> {
  return run(() => updateVendor(id, { name: values.name, phone: values.phone, notes: values.notes }), "/vendors");
}
export async function deleteVendorAction(id: string): Promise<MasterActionResult> {
  return run(() => deleteVendor(id), "/vendors");
}

/* Venues */
export async function createVenueAction(values: Record<string, string>): Promise<MasterActionResult> {
  return run(() => createVenue({ name: values.name, address: values.address, contact: values.contact, notes: values.notes }), "/venues");
}
export async function updateVenueAction(id: string, values: Record<string, string>): Promise<MasterActionResult> {
  return run(() => updateVenue(id, { name: values.name, address: values.address, contact: values.contact, notes: values.notes }), "/venues");
}
export async function deleteVenueAction(id: string): Promise<MasterActionResult> {
  return run(() => deleteVenue(id), "/venues");
}

/* Crew */
export async function createCrewAction(values: Record<string, string>): Promise<MasterActionResult> {
  return run(() => createCrew({ name: values.name, role: values.role, defaultPayment: parseNumber(values.defaultPayment), phone: values.phone, notes: values.notes }), "/crew");
}
export async function updateCrewAction(id: string, values: Record<string, string>): Promise<MasterActionResult> {
  return run(() => updateCrew(id, { name: values.name, role: values.role, defaultPayment: parseNumber(values.defaultPayment), phone: values.phone, notes: values.notes }), "/crew");
}
export async function deleteCrewAction(id: string): Promise<MasterActionResult> {
  return run(() => deleteCrew(id), "/crew");
}
