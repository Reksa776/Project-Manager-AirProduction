import { getRepositories } from "@/repositories";
import { buildLookup } from "@/services/shared";
import type {
  Admin,
  Client,
  ClientPayment,
  Crew,
  Expense,
  Vendor,
  VendorPayment,
  Venue,
} from "@/lib/types";

/** Service untuk data master Client, Vendor, Venue, dan Crew. */

export async function getClients(): Promise<Client[]> {
  const clients = await getRepositories().clients.getAll();
  return [...clients].sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export async function getVendors(): Promise<Vendor[]> {
  const vendors = await getRepositories().vendors.getAll();
  return [...vendors].sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export async function getVenues(): Promise<Venue[]> {
  const venues = await getRepositories().venues.getAll();
  return [...venues].sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export async function getCrew(): Promise<Crew[]> {
  const crew = await getRepositories().crew.getAll();
  return [...crew].sort((a, b) => a.name.localeCompare(b.name, "id"));
}

export async function getCurrentAdmin(): Promise<Admin | null> {
  const admins = await getRepositories().admins.getAll();
  return admins[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Master CRUD — validasi business di service, persistence di repository.     */
/* -------------------------------------------------------------------------- */

export interface ClientInput {
  name: string;
  address?: string;
  phone?: string;
  notes?: string;
}

export interface VendorInput {
  name: string;
  phone?: string;
  notes?: string;
}

export interface VenueInput {
  name: string;
  address?: string;
  contact?: string;
  notes?: string;
}

export interface CrewInput {
  name: string;
  role: string;
  defaultPayment: number;
  phone?: string;
  notes?: string;
}

function requireNonEmpty(value: string | undefined, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${label} wajib diisi.`);
  }
  return trimmed;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export async function createClient(input: ClientInput): Promise<Client> {
  return getRepositories().clients.create({
    name: requireNonEmpty(input.name, "Nama client"),
    address: normalizeOptional(input.address),
    phone: normalizeOptional(input.phone),
    notes: normalizeOptional(input.notes),
  });
}

export async function updateClient(id: string, input: ClientInput): Promise<Client> {
  return getRepositories().clients.update(id, {
    name: requireNonEmpty(input.name, "Nama client"),
    address: normalizeOptional(input.address),
    phone: normalizeOptional(input.phone),
    notes: normalizeOptional(input.notes),
  });
}

export async function deleteClient(id: string): Promise<void> {
  return getRepositories().clients.delete(id);
}

export async function createVendor(input: VendorInput): Promise<Vendor> {
  return getRepositories().vendors.create({
    name: requireNonEmpty(input.name, "Nama vendor"),
    phone: normalizeOptional(input.phone),
    notes: normalizeOptional(input.notes),
  });
}

export async function updateVendor(id: string, input: VendorInput): Promise<Vendor> {
  return getRepositories().vendors.update(id, {
    name: requireNonEmpty(input.name, "Nama vendor"),
    phone: normalizeOptional(input.phone),
    notes: normalizeOptional(input.notes),
  });
}

export async function deleteVendor(id: string): Promise<void> {
  return getRepositories().vendors.delete(id);
}

export async function createVenue(input: VenueInput): Promise<Venue> {
  return getRepositories().venues.create({
    name: requireNonEmpty(input.name, "Nama venue"),
    address: normalizeOptional(input.address),
    contact: normalizeOptional(input.contact),
    notes: normalizeOptional(input.notes),
  });
}

export async function updateVenue(id: string, input: VenueInput): Promise<Venue> {
  return getRepositories().venues.update(id, {
    name: requireNonEmpty(input.name, "Nama venue"),
    address: normalizeOptional(input.address),
    contact: normalizeOptional(input.contact),
    notes: normalizeOptional(input.notes),
  });
}

export async function deleteVenue(id: string): Promise<void> {
  return getRepositories().venues.delete(id);
}

export async function createCrew(input: CrewInput): Promise<Crew> {
  if (!Number.isFinite(input.defaultPayment) || input.defaultPayment < 0) {
    throw new Error("Default payment crew harus angka valid (>= 0).");
  }
  return getRepositories().crew.create({
    name: requireNonEmpty(input.name, "Nama crew"),
    role: requireNonEmpty(input.role, "Role crew"),
    defaultPayment: input.defaultPayment,
    phone: normalizeOptional(input.phone),
    notes: normalizeOptional(input.notes),
  });
}

export async function updateCrew(id: string, input: CrewInput): Promise<Crew> {
  if (!Number.isFinite(input.defaultPayment) || input.defaultPayment < 0) {
    throw new Error("Default payment crew harus angka valid (>= 0).");
  }
  return getRepositories().crew.update(id, {
    name: requireNonEmpty(input.name, "Nama crew"),
    role: requireNonEmpty(input.role, "Role crew"),
    defaultPayment: input.defaultPayment,
    phone: normalizeOptional(input.phone),
    notes: normalizeOptional(input.notes),
  });
}

export async function deleteCrew(id: string): Promise<void> {
  return getRepositories().crew.delete(id);
}

/* -------------------------------------------------------------------------- */
/* Finance                                                                    */
/* -------------------------------------------------------------------------- */

export interface ClientPaymentRow extends ClientPayment {
  jobNumber: string;
  clientName: string;
}

export interface VendorPaymentRow extends VendorPayment {
  jobNumber: string;
  vendorName: string;
}

export interface ExpenseRow extends Expense {
  jobNumber: string;
}

export interface FinanceOverview {
  clientPayments: ClientPaymentRow[];
  vendorPayments: VendorPaymentRow[];
  expenses: ExpenseRow[];
}

/** Daftar transaksi finansial lengkap dengan nama Job untuk ditampilkan. */
export async function getFinanceOverview(): Promise<FinanceOverview> {
  const repos = getRepositories();
  const [jobs, clients, vendors, clientPayments, vendorPayments, expenses] =
    await Promise.all([
      repos.jobs.getAll(),
      repos.clients.getAll(),
      repos.vendors.getAll(),
      repos.clientPayments.getAll(),
      repos.vendorPayments.getAll(),
      repos.expenses.getAll(),
    ]);

  const jobMap = buildLookup(jobs);
  const clientMap = buildLookup(clients);
  const vendorMap = buildLookup(vendors);

  const jobLabel = (jobId: string) => jobMap.get(jobId)?.jobNumber ?? "-";
  const jobName = (jobId: string) => jobMap.get(jobId)?.jobName ?? "-";

  const paymentRows: ClientPaymentRow[] = clientPayments.map((payment) => {
    const job = jobMap.get(payment.jobId);
    const client = job?.clientId ? clientMap.get(job.clientId) : undefined;
    return {
      ...payment,
      jobNumber: jobLabel(payment.jobId),
      clientName: client?.name ?? jobName(payment.jobId),
    };
  });

  const vendorRows: VendorPaymentRow[] = vendorPayments.map((payment) => {
    const job = jobMap.get(payment.jobId);
    const vendor = job?.vendorId ? vendorMap.get(job.vendorId) : undefined;
    return {
      ...payment,
      jobNumber: jobLabel(payment.jobId),
      vendorName: vendor?.name ?? jobName(payment.jobId),
    };
  });

  const expenseRows: ExpenseRow[] = expenses.map((expense) => ({
    ...expense,
    jobNumber: jobLabel(expense.jobId),
  }));

  return {
    clientPayments: paymentRows.sort((a, b) => a.jobNumber.localeCompare(b.jobNumber)),
    vendorPayments: vendorRows.sort((a, b) => a.jobNumber.localeCompare(b.jobNumber)),
    expenses: expenseRows.sort((a, b) => b.date.localeCompare(a.date)),
  };
}
