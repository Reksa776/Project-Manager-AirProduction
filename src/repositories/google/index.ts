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
  Job,
  JobCrew,
  Vendor,
  VendorPayment,
  Venue,
} from "@/lib/types";
import {
  clientPaymentToRecord,
  clientToRecord,
  crewToRecord,
  deliveryToRecord,
  expenseToRecord,
  isEmptyRow,
  jobCrewToRecord,
  jobToRecord,
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
  recordToRow,
  rowToRecord,
  validateHeaders,
  vendorPaymentToRecord,
  vendorToRecord,
  venueToRecord,
  type SheetRecord,
  type SheetTitle,
} from "./mapping";

/**
 * Repository Google Sheets.
 *
 * Phase 2D–2F: read-only. Phase 2G: kemampuan tulis (create/update/delete)
 * ditambahkan dengan tetap memakai kontrak yang sama dipakai service/UI.
 * Tidak ada authentication tambahan; semua lewat
 * `src/lib/google-sheets/client.ts`.
 */

interface SheetData {
  headers: string[];
  /** Setiap row pasangan (nilai baris asli, nomor baris sheet 1-based). */
  rows: Array<{ values: string[]; rowNumber: number }>;
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

  const rows = values
    .slice(1)
    .map((row, i) => ({ values: row, rowNumber: i + 2 }))
    .filter((entry) => !isEmptyRow(entry.values));
  return { headers, rows };
}

type Mapper<T> = (rec: Record<string, string>, sheet: SheetTitle, rowNumber: number) => T;

async function readAll<T>(sheet: SheetTitle, mapper: Mapper<T>): Promise<T[]> {
  const { headers, rows } = await readSheet(sheet);
  return rows.map((entry) => mapper(rowToRecord(headers, entry.values), sheet, entry.rowNumber));
}

/** Cari baris data berdasarkan nilai kolom `id`. Mengembalikan undefined bila tidak ada. */
async function findRowById(sheet: SheetTitle, id: string): Promise<{ headers: string[]; values: string[]; rowNumber: number } | undefined> {
  const { headers, rows } = await readSheet(sheet);
  const idIndex = headers.indexOf("id");
  const entry = rows.find((entry) => String(entry.values[idIndex] ?? "").trim() === id);
  return entry ? { headers, values: entry.values, rowNumber: entry.rowNumber } : undefined;
}

function nowIso(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  const part = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `${prefix}-${part}`;
}

async function appendRow(sheet: SheetTitle, row: string[]): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheet}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Repository Google: gagal append ke worksheet '${sheet}' (operation create). ${message}`);
  }
}

async function updateRow(sheet: SheetTitle, rowNumber: number, row: string[]): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const lastCol = String.fromCharCode(64 + row.length);
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheet}!A${rowNumber}:${lastCol}${rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Repository Google: gagal update baris ${rowNumber} pada worksheet '${sheet}' (operation update). ${message}`);
  }
}

async function deleteRow(sheet: SheetTitle, rowNumber: number): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  // sheetId numerik dibutuhkan oleh deleteDimension.
  let sheetId: number | undefined;
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    sheetId = meta.data.sheets?.find((s) => s.properties?.title === sheet)?.properties?.sheetId ?? undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Repository Google: gagal membaca metadata worksheet '${sheet}' (operation delete). ${message}`);
  }
  if (sheetId === undefined) {
    throw new Error(`Repository Google: worksheet '${sheet}' tidak ditemukan (operation delete).`);
  }
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
            },
          },
        ],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Repository Google: gagal menghapus baris ${rowNumber} pada worksheet '${sheet}' (operation delete). ${message}`);
  }
}

/** Metadata (created_at/updated_at) mentah dari baris sheet, sebelum dipetakan ke domain. */
function rowMetadata(headers: string[], values: string[]): { createdAt: string; updatedAt: string } {
  const rec = rowToRecord(headers, values);
  return { createdAt: rec.created_at ?? "", updatedAt: rec.updated_at ?? "" };
}

interface EntityConfig<T, TCreate> {
  sheet: SheetTitle;
  prefix: string;
  mapper: Mapper<T>;
  /** Data domain baru (tanpa id/timestamps sheet) + metadata → record sheet. */
  toRecord: (data: T, createdAt: string, updatedAt: string) => SheetRecord;
  /** Memastikan input create/update masih mungkin valid secara tipe sheet. */
  withId: (data: TCreate, id: string) => T;
}

function createWritableRepository<T extends { id: string }, TCreate>(config: EntityConfig<T, TCreate>) {
  async function create(data: TCreate): Promise<T> {
    const all = await readAll(config.sheet, config.mapper);
    let id = generateId(config.prefix);
    while (all.some((item) => item.id === id)) {
      id = generateId(config.prefix);
    }
    const now = nowIso();
    const entity = config.withId(data, id);
    // Untuk entity yang menyimpan timestamp di domain (Job), sinkronkan.
    const withTimestamp = entity as { createdAt?: string; updatedAt?: string };
    if (typeof withTimestamp.createdAt === "string" || "createdAt" in withTimestamp) {
      withTimestamp.createdAt = now;
      withTimestamp.updatedAt = now;
    }
    const rec = config.toRecord(entity, now, now);
    await appendRow(config.sheet, recordToRow(config.sheet, rec));
    return entity;
  }

  async function update(id: string, data: TCreate): Promise<T> {
    const found = await findRowById(config.sheet, id);
    if (!found) {
      throw new Error(`Repository Google: record dengan id '${id}' tidak ditemukan pada worksheet '${config.sheet}' (operation update).`);
    }
    const meta = rowMetadata(found.headers, found.values);
    const createdAt = meta.createdAt || nowIso();
    const updatedAt = nowIso();
    const entity = config.withId(data, id);
    const withTimestamp = entity as { createdAt?: string; updatedAt?: string };
    if ("createdAt" in withTimestamp) {
      withTimestamp.createdAt = createdAt;
      withTimestamp.updatedAt = updatedAt;
    }
    const rec = config.toRecord(entity, createdAt, updatedAt);
    await updateRow(config.sheet, found.rowNumber, recordToRow(config.sheet, rec));
    return entity;
  }

  async function deleteEntity(id: string): Promise<void> {
    const found = await findRowById(config.sheet, id);
    if (!found) {
      throw new Error(`Repository Google: record dengan id '${id}' tidak ditemukan pada worksheet '${config.sheet}' (operation delete).`);
    }
    await deleteRow(config.sheet, found.rowNumber);
  }

  return {
    async getAll(): Promise<T[]> {
      return readAll(config.sheet, config.mapper);
    },
    async getById(id: string): Promise<T | null> {
      const all = await readAll(config.sheet, config.mapper);
      return all.find((item) => item.id === id) ?? null;
    },
    create,
    update,
    delete: deleteEntity,
  };
}

function createJobRepository(): DataRepositories["jobs"] {
  const writable = createWritableRepository<Job, Omit<Job, "id" | "createdAt" | "updatedAt">>({
    sheet: "jobs",
    prefix: "JOB",
    mapper: mapJob,
    toRecord: (entity) => jobToRecord(entity),
    withId: (data, id) => ({
      ...data,
      id,
      createdAt: "",
      updatedAt: "",
    }),
  });

  function assertValidJobShape(data: Omit<Job, "id" | "createdAt" | "updatedAt">): void {
    const hasClient = !!data.clientId;
    const hasVendor = !!data.vendorId;
    if (hasClient === hasVendor) {
      throw new Error(
        "Repository Google: job wajib memiliki clientId ATAU vendorId (tidak keduanya, tidak kosong).",
      );
    }
  }

  async function assertUniqueJobNumber(jobNumber: string, ignoreId?: string): Promise<void> {
    const all = await readAll("jobs", mapJob);
    const dup = all.find((job) => job.jobNumber === jobNumber && job.id !== ignoreId);
    if (dup) {
      throw new Error(`Repository Google: job_number '${jobNumber}' sudah dipakai job lain (operation write).`);
    }
  }

  return {
    ...writable,
    async getByJobNumber(jobNumber) {
      const all = await readAll("jobs", mapJob);
      return all.find((job) => job.jobNumber === jobNumber) ?? null;
    },
    async create(data) {
      assertValidJobShape(data);
      await assertUniqueJobNumber(data.jobNumber);
      return writable.create(data);
    },
    async update(id, data) {
      assertValidJobShape(data);
      const existing = await writable.getById(id);
      if (!existing) {
        throw new Error(`Repository Google: record dengan id '${id}' tidak ditemukan pada worksheet 'jobs' (operation update).`);
      }
      await assertUniqueJobNumber(data.jobNumber, id);
      return writable.update(id, data);
    },
    delete: writable.delete,
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

function createByJobIdRepository<T extends { id: string; jobId: string }, TCreate>(config: EntityConfig<T, TCreate>) {
  const writable = createWritableRepository<T, TCreate>(config);
  return {
    ...writable,
    async getByJobId(jobId: string) {
      const all = await writable.getAll();
      return all.filter((item) => item.jobId === jobId);
    },
  };
}

/**
 * Implementasi repository Google Sheets.
 *
 * Konsisten dengan kontrak `DataRepositories` existing. Tidak ada ID
 * collision handling selain generate unik + deteksi duplikat job_number;
 * tidak ada silent business-rule invention (validasi akhir ada di service).
 */
export const googleRepositories: DataRepositories = {
  jobs: createJobRepository(),
  clients: createWritableRepository<Client, Omit<Client, "id">>({
    sheet: "clients", prefix: "CLI", mapper: mapClient,
    toRecord: (entity, createdAt, updatedAt) => clientToRecord(entity as Client, createdAt, updatedAt),
    withId: (data, id) => ({ ...(data as Omit<Client, "id">), id }),
  }),
  vendors: createWritableRepository<Vendor, Omit<Vendor, "id">>({
    sheet: "vendors", prefix: "VND", mapper: mapVendor,
    toRecord: (entity, createdAt, updatedAt) => vendorToRecord(entity as Vendor, createdAt, updatedAt),
    withId: (data, id) => ({ ...(data as Omit<Vendor, "id">), id }),
  }),
  venues: createWritableRepository<Venue, Omit<Venue, "id">>({
    sheet: "venues", prefix: "VNU", mapper: mapVenue,
    toRecord: (entity, createdAt, updatedAt) => venueToRecord(entity as Venue, createdAt, updatedAt),
    withId: (data, id) => ({ ...(data as Omit<Venue, "id">), id }),
  }),
  crew: createWritableRepository<Crew, Omit<Crew, "id">>({
    sheet: "crew", prefix: "CRW", mapper: mapCrew,
    toRecord: (entity, createdAt, updatedAt) => crewToRecord(entity as Crew, createdAt, updatedAt),
    withId: (data, id) => ({ ...(data as Omit<Crew, "id">), id }),
  }),
  deliveries: createByJobIdRepository<Delivery, Omit<Delivery, "id">>({
    sheet: "deliveries", prefix: "DLV", mapper: mapDelivery,
    toRecord: (entity, createdAt, updatedAt) => deliveryToRecord(entity as Delivery, createdAt, updatedAt),
    withId: (data, id) => ({ ...(data as Omit<Delivery, "id">), id }),
  }),
  jobCrews: createByJobIdRepository<JobCrew, Omit<JobCrew, "id">>({
    sheet: "job_crews", prefix: "JC", mapper: mapJobCrew,
    toRecord: (entity, createdAt, updatedAt) => jobCrewToRecord(entity as JobCrew, createdAt, updatedAt),
    withId: (data, id) => ({ ...(data as Omit<JobCrew, "id">), id }),
  }),
  clientPayments: createByJobIdRepository<ClientPayment, Omit<ClientPayment, "id">>({
    sheet: "client_payments", prefix: "CP", mapper: mapClientPayment,
    toRecord: (entity, createdAt, updatedAt) => clientPaymentToRecord(entity as ClientPayment, createdAt, updatedAt),
    withId: (data, id) => ({ ...(data as Omit<ClientPayment, "id">), id }),
  }),
  vendorPayments: createByJobIdRepository<VendorPayment, Omit<VendorPayment, "id">>({
    sheet: "vendor_payments", prefix: "VP", mapper: mapVendorPayment,
    toRecord: (entity, createdAt, updatedAt) => vendorPaymentToRecord(entity as VendorPayment, createdAt, updatedAt),
    withId: (data, id) => ({ ...(data as Omit<VendorPayment, "id">), id }),
  }),
  expenses: createByJobIdRepository<Expense, Omit<Expense, "id">>({
    sheet: "expenses", prefix: "EXP", mapper: mapExpense,
    toRecord: (entity, createdAt, updatedAt) => expenseToRecord(entity as Expense, createdAt, updatedAt),
    withId: (data, id) => ({ ...(data as Omit<Expense, "id">), id }),
  }),
  admins: createReadRepository<Admin>("admins", mapAdmin),
};
