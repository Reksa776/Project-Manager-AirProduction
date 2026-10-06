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
