import type {
  CreateClientInput,
  CreateCrewInput,
  CreateCrewRoleInput,
  CreatePackageInput,
  CreateVendorInput,
} from "@/domain/inputs";
import type { Client, Crew, CrewRole, Package, Vendor } from "@/domain/types";
import type { MySqlRepositories } from "@/repositories/contract";

/**
 * Service master data KANONIK (Contract v2).
 *
 * BATAS KOMPATIBILITAS: service ini hanya berbicara dengan `MySqlRepositories`
 * (Contract v2) — tidak pernah dengan `DataRepositories` (legacy/Google Sheets)
 * maupun `src/lib/types.ts`. Validasi field & referensi ditegakkan di repository
 * kanonik (satu sumber aturan); service menambahkan komposisi antar-entity.
 */

export interface CrewDirectoryEntry {
  crew: Crew;
  role: CrewRole | null;
}

export interface CanonicalMasterService {
  listClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | null>;
  createClient(input: CreateClientInput): Promise<Client>;
  updateClient(id: string, input: CreateClientInput): Promise<Client>;
  deleteClient(id: string): Promise<void>;

  listPackages(): Promise<Package[]>;
  getPackage(id: string): Promise<Package | null>;
  createPackage(input: CreatePackageInput): Promise<Package>;
  updatePackage(id: string, input: CreatePackageInput): Promise<Package>;
  deletePackage(id: string): Promise<void>;

  listVendors(): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | null>;
  createVendor(input: CreateVendorInput): Promise<Vendor>;
  updateVendor(id: string, input: CreateVendorInput): Promise<Vendor>;
  deleteVendor(id: string): Promise<void>;

  listCrewRoles(): Promise<CrewRole[]>;
  getCrewRole(id: string): Promise<CrewRole | null>;
  createCrewRole(input: CreateCrewRoleInput): Promise<CrewRole>;
  updateCrewRole(id: string, input: CreateCrewRoleInput): Promise<CrewRole>;
  deleteCrewRole(id: string): Promise<void>;

  listCrew(): Promise<Crew[]>;
  getCrew(id: string): Promise<Crew | null>;
  createCrew(input: CreateCrewInput): Promise<Crew>;
  updateCrew(id: string, input: CreateCrewInput): Promise<Crew>;
  deleteCrew(id: string): Promise<void>;

  /** Crew yang diperkaya nama role (komposisi crew + crew_roles). */
  listCrewDirectory(): Promise<CrewDirectoryEntry[]>;
}

function byName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export function createMasterService(
  repositories: MySqlRepositories,
): CanonicalMasterService {
  const { clients, packages, vendors, crew, crewRoles } = repositories;

  return {
    async listClients() {
      return byName(await clients.getAll());
    },
    getClient: (id) => clients.getById(id),
    createClient: (input) => clients.create(input),
    updateClient: (id, input) => clients.update(id, input),
    deleteClient: (id) => clients.delete(id),

    async listPackages() {
      const all = await packages.getAll();
      return all.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "en"));
    },
    getPackage: (id) => packages.getById(id),
    createPackage: (input) => packages.create(input),
    updatePackage: (id, input) => packages.update(id, input),
    deletePackage: (id) => packages.delete(id),

    async listVendors() {
      return byName(await vendors.getAll());
    },
    getVendor: (id) => vendors.getById(id),
    createVendor: (input) => vendors.create(input),
    updateVendor: (id, input) => vendors.update(id, input),
    deleteVendor: (id) => vendors.delete(id),

    async listCrewRoles() {
      const roles = await crewRoles.getAll();
      return [...roles].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "id"),
      );
    },
    getCrewRole: (id) => crewRoles.getById(id),
    createCrewRole: (input) => crewRoles.create(input),
    updateCrewRole: (id, input) => crewRoles.update(id, input),
    deleteCrewRole: (id) => crewRoles.delete(id),

    async listCrew() {
      return byName(await crew.getAll());
    },
    getCrew: (id) => crew.getById(id),
    createCrew: (input) => crew.create(input),
    updateCrew: (id, input) => crew.update(id, input),
    deleteCrew: (id) => crew.delete(id),

    async listCrewDirectory() {
      const [members, roles] = await Promise.all([crew.getAll(), crewRoles.getAll()]);
      const roleById = new Map(roles.map((role) => [role.id, role]));
      return byName(members).map((member) => ({
        crew: member,
        role: roleById.get(member.crewRoleId) ?? null,
      }));
    },
  };
}
