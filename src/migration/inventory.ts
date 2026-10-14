import {
  SHEET_HEADERS,
  rowToRecord,
  type SheetTitle,
} from "@/repositories/google/mapping";
import type { ReconciliationIssue } from "@/domain/reconciliation";

/**
 * INVENTARIS SUMBER (read-only) — P0D-1.
 *
 * Utilitas di sini HANYA membaca snapshot baris yang diberikan pemanggil
 * (mis. fixture test atau hasil pembacaan read-only). Tidak ada penulisan ke
 * Google Sheets maupun MySQL.
 *
 * Ketersediaan data sumber: bila kredensial Google Sheets tidak tersedia,
 * pemeriksaan yang bergantung pada data historis nyata berstatus **BLOCKED**
 * (`assertSourceDataAvailable`). Perencanaan statis tetap dapat diselesaikan.
 */

export class SourceDataUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceDataUnavailableError";
  }
}

export class MigrationScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationScopeError";
  }
}

/** Apakah kredensial sumber (spreadsheet id) tersedia di environment. */
export function isSourceDataAvailable(): boolean {
  const id = process.env.GOOGLE_SHEETS_ID;
  return typeof id === "string" && id.trim() !== "";
}

/**
 * Menegaskan ketersediaan data sumber.
 *
 * P0D-1 tidak membaca data live: bahkan bila kredensial tersedia, pembacaan
 * snapshot nyata baru diimplementasikan pada P0D-2 (dengan persetujuan).
 */
export function assertSourceDataAvailable(): void {
  if (!isSourceDataAvailable()) {
    throw new SourceDataUnavailableError(
      "BLOCKED: GOOGLE_SHEETS_ID tidak tersedia, sehingga inventaris data historis nyata (jumlah baris, nilai role/kategori, duplikat) tidak dapat diverifikasi pada P0D-1.",
    );
  }
  throw new MigrationScopeError(
    "Pembacaan snapshot Google Sheets live belum diaktifkan pada P0D-1; implementasinya (read-only) ada di P0D-2 setelah persetujuan.",
  );
}

export interface SourceRowInput {
  rowNumber: number;
  values: string[];
}

export type SourceRows = Partial<Record<SheetTitle, SourceRowInput[]>>;

export interface SheetInventory {
  sheet: SheetTitle;
  rowCount: number;
  /** Kolom wajib (id + kolom kunci) yang kosong pada baris data. */
  missingRequiredCells: Array<{ rowNumber: number; column: string }>;
  duplicateIds: Array<{ sourceId: string; rowNumbers: number[] }>;
  /** Nilai unik untuk kolom yang diminta (mis. `role`, `category`, `job_type`). */
  distinctValues: Record<string, string[]>;
  notes: string[];
}

/** Kolom wajib per worksheet untuk memetakan baris (selaras mapper Google). */
const REQUIRED_COLUMNS: Partial<Record<SheetTitle, string[]>> = {
  clients: ["id", "name"],
  vendors: ["id", "name"],
  venues: ["id", "name"],
  crew: ["id", "name", "role"],
  jobs: ["id", "job_number", "job_name", "job_type", "execution_date", "status"],
  job_crews: ["id", "job_id", "crew_id"],
  deliveries: ["id", "job_id", "item_name"],
  client_payments: ["id", "job_id", "term", "amount"],
  vendor_payments: ["id", "job_id", "type", "amount"],
  expenses: ["id", "category", "amount"],
  admins: ["id", "name", "email"],
};

const DISTINCT_COLUMNS: Partial<Record<SheetTitle, string[]>> = {
  crew: ["role"],
  jobs: ["job_type", "status"],
  job_crews: ["role", "payment_status"],
  client_payments: ["term", "status"],
  vendor_payments: ["type", "status"],
  expenses: ["category"],
};

/** Inventaris satu worksheet dari snapshot baris yang diberikan. */
export function inventorySheet(sheet: SheetTitle, rows: readonly SourceRowInput[]): SheetInventory {
  const headers = SHEET_HEADERS[sheet];
  const required = REQUIRED_COLUMNS[sheet] ?? ["id"];
  const distinctColumns = DISTINCT_COLUMNS[sheet] ?? [];
  const missingRequiredCells: Array<{ rowNumber: number; column: string }> = [];
  const idBuckets = new Map<string, number[]>();
  const distinct = new Map<string, Set<string>>();
  for (const column of distinctColumns) distinct.set(column, new Set());
  const headersMismatch: string[] = [];

  for (const row of rows) {
    if (row.values.length !== headers.length) {
      headersMismatch.push(`baris ${row.rowNumber} memiliki ${row.values.length} sel (diharapkan ${headers.length})`);
    }
    const record = rowToRecord(headers, row.values);

    for (const column of required) {
      if (!(column in record) || record[column] === "") {
        missingRequiredCells.push({ rowNumber: row.rowNumber, column });
      }
    }
    for (const column of distinctColumns) {
      const value = record[column];
      if (value !== undefined && value !== "") distinct.get(column)!.add(value);
    }

    const id = record.id;
    if (id !== undefined && id !== "") {
      const bucket = idBuckets.get(id) ?? [];
      bucket.push(row.rowNumber);
      idBuckets.set(id, bucket);
    }
  }

  return {
    sheet,
    rowCount: rows.length,
    missingRequiredCells,
    duplicateIds: [...idBuckets.entries()]
      .filter(([, rowNumbers]) => rowNumbers.length > 1)
      .map(([sourceId, rowNumbers]) => ({ sourceId, rowNumbers })),
    distinctValues: Object.fromEntries(
      [...distinct.entries()].map(([column, values]) => [column, [...values].sort()]),
    ),
    notes: headersMismatch,
  };
}

export function buildSourceInventory(snapshot: SourceRows): Partial<Record<SheetTitle, SheetInventory>> {
  const inventory: Partial<Record<SheetTitle, SheetInventory>> = {};
  for (const [sheet, rows] of Object.entries(snapshot) as Array<[SheetTitle, SourceRowInput[]]>) {
    inventory[sheet] = inventorySheet(sheet, rows);
  }
  return inventory;
}

function idsOf(snapshot: SourceRows, sheet: SheetTitle, column = "id"): Set<string> {
  const headers = SHEET_HEADERS[sheet];
  const result = new Set<string>();
  for (const row of snapshot[sheet] ?? []) {
    const value = rowToRecord(headers, row.values)[column];
    if (value !== undefined && value !== "") result.add(value);
  }
  return result;
}

export interface SourceReferenceIssue extends ReconciliationIssue {
  sheet: SheetTitle;
  rowNumber: number;
  column: string;
}

/**
 * Memeriksa integritas referensi antar-worksheet pada snapshot sumber.
 * Referensi yang hilang → `RECONCILIATION_REQUIRED` (tidak boleh diisi default).
 */
export function validateSourceReferences(snapshot: SourceRows): SourceReferenceIssue[] {
  const issues: SourceReferenceIssue[] = [];
  const clientIds = idsOf(snapshot, "clients");
  const vendorIds = idsOf(snapshot, "vendors");
  const venueIds = idsOf(snapshot, "venues");
  const crewIds = idsOf(snapshot, "crew");
  const jobIds = idsOf(snapshot, "jobs");

  const check = (
    sheet: SheetTitle,
    column: string,
    known: ReadonlySet<string>,
    code: string,
    label: string,
  ): void => {
    const headers = SHEET_HEADERS[sheet];
    for (const row of snapshot[sheet] ?? []) {
      const record = rowToRecord(headers, row.values);
      const value = record[column];
      if (value === undefined || value === "") continue;
      if (!known.has(value)) {
        issues.push({
          code,
          message: `${sheet} baris ${row.rowNumber} merujuk ${label} '${value}' yang tidak ada pada sumber.`,
          sheet,
          rowNumber: row.rowNumber,
          column,
          field: column,
        });
      }
    }
  };

  check("jobs", "client_id", clientIds, "MISSING_CLIENT_REFERENCE", "client");
  check("jobs", "vendor_id", vendorIds, "MISSING_VENDOR_REFERENCE", "vendor");
  check("jobs", "venue_id", venueIds, "MISSING_VENUE_REFERENCE", "venue (arsip)");
  check("job_crews", "job_id", jobIds, "MISSING_JOB_REFERENCE", "job");
  check("job_crews", "crew_id", crewIds, "MISSING_CREW_REFERENCE", "crew");
  check("deliveries", "job_id", jobIds, "MISSING_JOB_REFERENCE", "job");
  check("client_payments", "job_id", jobIds, "MISSING_JOB_REFERENCE", "job");
  check("vendor_payments", "job_id", jobIds, "MISSING_JOB_REFERENCE", "job");
  check("expenses", "job_id", jobIds, "MISSING_JOB_REFERENCE", "job");

  return issues;
}
