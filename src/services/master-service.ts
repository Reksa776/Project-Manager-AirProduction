import type {
  CreateClientInput,
  CreateCrewInput,
  CreateCrewRoleInput,
  CreatePackageInput,
} from "@/domain/inputs";
import type { Amount } from "@/domain/money";
import type { Client, Crew, CrewRole, Package, Vendor } from "@/domain/types";
import { getApplication } from "@/services/runtime";
import type { CrewDirectoryRow } from "@/services/types";

/**
 * Service master data KANONIK (Contract v2).
 *
 * - Tidak ada Venue (konsep dihapus pada redesain; histori hanya
 *   `Job.legacyVenueName`).
 * - Tidak ada Expense (penggantinya Cashflow kanonik).
 * - Crew memakai `crewRoleId` (role ternormalisasi), bukan string bebas.
 * - Semua uang memakai `Amount` (string desimal).
 *
 * Semua operasi melewati `getApplication()` (batas komposisi tunggal) sehingga
 * satu-satunya sumber data adalah MySQL kanonik, tanpa fallback Google Sheets.
 */

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function getClients(): Promise<Client[]> {
  return getApplication().services.master.listClients();
}

export async function getVendors(): Promise<Vendor[]> {
  return getApplication().services.master.listVendors();
}

export async function getPackages(activeOnly = false): Promise<Package[]> {
  const all = await getApplication().services.master.listPackages();
  return activeOnly ? all.filter((item) => item.isActive) : all;
}

export async function getCrew(): Promise<Crew[]> {
  return getApplication().services.master.listCrew();
}

export async function getCrewRoles(): Promise<CrewRole[]> {
  return getApplication().services.master.listCrewRoles();
}

export async function getCrewDirectory(): Promise<CrewDirectoryRow[]> {
  return getApplication().services.master.listCrewDirectory();
}

/**
 * Admin pertama untuk keperluan tampilan. READ-ONLY dan TIDAK dipakai untuk
 * otorisasi: autentikasi/otorisasi adalah P1A/P1B. Root layout TIDAK memanggil
 * fungsi ini (build harus bebas kredensial & bebas baca DB saat prerender).
 */
export async function getCurrentAdmin(): Promise<{ id: string; name: string } | null> {
  const admins = await getApplication().services.adminSessions.listAdmins();
  const first = admins[0];
  return first ? { id: first.id, name: first.name } : null;
}

/* -------------------------------------------------------------------------- */
/* Input types (presentation-facing, all values are plain form strings)       */
/* -------------------------------------------------------------------------- */

export interface ClientInput {
  name: string;
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  clientType?: CreateClientInput["clientType"];
  notes?: string;
}

export interface VendorInput {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface CrewRoleInput {
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CrewInput {
  name: string;
  crewRoleId: string;
  defaultPayment: Amount;
  phone?: string;
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export async function createClient(input: ClientInput): Promise<Client> {
  return getApplication().services.master.createClient(input);
}

export async function updateClient(id: string, input: ClientInput): Promise<Client> {
  return getApplication().services.master.updateClient(id, input);
}

export async function deleteClient(id: string): Promise<void> {
  return getApplication().services.master.deleteClient(id);
}

export async function createPackage(input: CreatePackageInput): Promise<Package> {
  return getApplication().services.master.createPackage(input);
}

export async function updatePackage(id: string, input: CreatePackageInput): Promise<Package> {
  return getApplication().services.master.updatePackage(id, input);
}

export async function deletePackage(id: string): Promise<void> {
  return getApplication().services.master.deletePackage(id);
}

export async function createVendor(input: VendorInput): Promise<Vendor> {
  return getApplication().services.master.createVendor(input);
}

export async function updateVendor(id: string, input: VendorInput): Promise<Vendor> {
  return getApplication().services.master.updateVendor(id, input);
}

export async function deleteVendor(id: string): Promise<void> {
  return getApplication().services.master.deleteVendor(id);
}

export async function createCrewRole(input: CreateCrewRoleInput): Promise<CrewRole> {
  return getApplication().services.master.createCrewRole(input);
}

export async function updateCrewRole(id: string, input: CreateCrewRoleInput): Promise<CrewRole> {
  return getApplication().services.master.updateCrewRole(id, input);
}

export async function deleteCrewRole(id: string): Promise<void> {
  return getApplication().services.master.deleteCrewRole(id);
}

export async function createCrew(input: CreateCrewInput): Promise<Crew> {
  return getApplication().services.master.createCrew(input);
}

export async function updateCrew(id: string, input: CreateCrewInput): Promise<Crew> {
  return getApplication().services.master.updateCrew(id, input);
}

export async function deleteCrew(id: string): Promise<void> {
  return getApplication().services.master.deleteCrew(id);
}
