import { getSheetsClient, getSpreadsheetId } from "@/lib/google-sheets/client";
import type {
  DataRepositories,
  ReadRepository,
} from "@/repositories/types";
import type {
  Admin,
  Client,
  ClientPayment,
  Crew,
  Delivery,
  Expense,
  JobCrew,
  Vendor,
  VendorPayment,
  Venue,
} from "@/lib/types";
import {
  isEmptyRow,
  mapAdmin,
  mapClient,
  mapClientPayment,
  mapCrew,
  mapDelivery,
  mapExpense,
  mapJob,
  mapJobCrew,
  mapVendor,
  mapVendorPayment,
  mapVenue,
  rowToRecord,
  validateHeaders,
  type SheetTitle,
} from "./mapping";

/**
 * Repository read-only berbasis Google Sheets.
 *
 * Phase 2D: implementasi ini HANYA membaca. Tidak ada create/update/delete,
 * tidak ada append, tidak ada batchUpdate. Sejak Phase 2E, repository ini
 * aktif via `getRepositories()`; mock repository tetap tersedia sebagai
 * implementasi fallback/testing.
 */

interface SheetData {
  headers: string[];
  rows: string[][];
}

async function readSheet(sheet: SheetTitle): Promise<SheetData> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  let values: string[][] | undefined | null;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheet,
    });
    values = res.data.values as string[][] | undefined | null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Repository Google: gagal membaca worksheet '${sheet}' (operation read). ${message}`,
    );
  }

  if (!values || values.length === 0) {
    throw new Error(
      `Repository Google: worksheet '${sheet}' tidak memiliki header (operation read).`,
    );
  }

  const headers = values[0].map((h) => String(h).trim());
  validateHeaders(sheet, headers);

  const rows = values.slice(1).filter((row) => !isEmptyRow(row));
  return { headers, rows };
}

type Mapper<T> = (rec: Record<string, string>, sheet: SheetTitle, rowNumber: number) => T;

async function readAll<T>(sheet: SheetTitle, mapper: Mapper<T>): Promise<T[]> {
  const { headers, rows } = await readSheet(sheet);
  return rows.map((row, i) => mapper(rowToRecord(headers, row), sheet, i + 2));
}

function createJobRepository(): DataRepositories["jobs"] {
  return {
    async getAll() {
      return readAll("jobs", mapJob);
    },
    async getById(id) {
      const all = await readAll("jobs", mapJob);
      return all.find((job) => job.id === id) ?? null;
    },
    async getByJobNumber(jobNumber) {
      const all = await readAll("jobs", mapJob);
      return all.find((job) => job.jobNumber === jobNumber) ?? null;
    },
  };
}

function createReadRepository<T extends { id: string }>(sheet: SheetTitle, mapper: Mapper<T>): ReadRepository<T> {
  return {
    async getAll() {
      return readAll(sheet, mapper);
    },
    async getById(id) {
      const all = await readAll(sheet, mapper);
      return all.find((item) => item.id === id) ?? null;
    },
  };
}

function createByJobIdRepository<T extends { id: string; jobId: string }>(sheet: SheetTitle, mapper: Mapper<T>) {
  return {
    ...createReadRepository<T>(sheet, mapper),
    async getByJobId(jobId: string) {
      const all = await readAll(sheet, mapper);
      return all.filter((item) => item.jobId === jobId);
    },
  };
}

/**
 * Implementasi repository Google Sheets (read-only).
 *
 * Konsisten dengan kontrak `DataRepositories` existing. Row mapper memetakan
 * apa adanya; tidak ada ID baru, tidak ada silent default bisnis, tidak ada
 * perbaikan business invariant (validasi ada di service layer).
 */
export const googleRepositories: DataRepositories = {
  jobs: createJobRepository(),
  clients: createReadRepository<Client>("clients", mapClient),
  vendors: createReadRepository<Vendor>("vendors", mapVendor),
  venues: createReadRepository<Venue>("venues", mapVenue),
  crew: createReadRepository<Crew>("crew", mapCrew),
  deliveries: createByJobIdRepository<Delivery>("deliveries", mapDelivery),
  jobCrews: createByJobIdRepository<JobCrew>("job_crews", mapJobCrew),
  clientPayments: createByJobIdRepository<ClientPayment>("client_payments", mapClientPayment),
  vendorPayments: createByJobIdRepository<VendorPayment>("vendor_payments", mapVendorPayment),
  expenses: createByJobIdRepository<Expense>("expenses", mapExpense),
  admins: createReadRepository<Admin>("admins", mapAdmin),
};
