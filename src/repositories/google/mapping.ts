import type {
  Admin,
  Client,
  ClientPayment,
  Crew,
  Delivery,
  Expense,
  Job,
  JobCrew,
  JobCategory,
  JobStatus,
  Vendor,
  VendorPayment,
  Venue,
  DeliveryStatus,
  PaymentStatus,
  ClientPaymentTerm,
  VendorPaymentType,
} from "@/lib/types";

/**
 * Mapping murni dari baris Google Sheets (record) ke domain type.
 *
 * Keputusan konsistensi dengan mock repository & service existing:
 * - Tidak ada validasi business invariant (mis. Client ATAU Vendor) di sini;
 *   validasi itu berada di service layer. Repository memetakan apa adanya.
 * - Tidak ada ID/tanggal/default bisnis yang dikarang saat read.
 * - Enum distriktkan (uppercase, spasi/strip → underscore) lalu divalidasi
 *   terhadap type existing; nilai invalid → error eksplisit.
 * - Number wajib harus angka valid; kosong/NaN → error eksplisit.
 * - String opsional kosong → undefined; tanpa menggeser kolom.
 * - Kolom sheet tanpa padanan field domain tidak dibawa (didokumentasikan
 *   di audit, bukan di diam-diam dibuang secara silent). Sejak Phase 2E,
 *   field business yang hilang (address, contact, location, delivery_type,
 *   quantity, payment_status, notes) sudah ditambahkan ke domain dan
 *   dipetakan. Yang sengaja tidak dibawa: metadata `created_at`/`updated_at`
 *   di luar `Job` (tidak ada kebutuhan service/UI) dan
 *   `admins.password_hash` (authentication belum scope).
 */

export const SHEET_TITLES = [
  "clients",
  "vendors",
  "venues",
  "crew",
  "jobs",
  "job_crews",
  "deliveries",
  "client_payments",
  "vendor_payments",
  "expenses",
  "admins",
] as const;

export type SheetTitle = (typeof SHEET_TITLES)[number];

export const SHEET_HEADERS: Record<SheetTitle, string[]> = {
  clients: ["id", "name", "address", "contact", "notes", "created_at", "updated_at"],
  vendors: ["id", "name", "contact", "notes", "created_at", "updated_at"],
  venues: ["id", "name", "address", "contact", "notes", "created_at", "updated_at"],
  crew: ["id", "name", "role", "contact", "default_payment", "notes", "created_at", "updated_at"],
  jobs: ["id", "job_number", "client_id", "vendor_id", "venue_id", "job_name", "job_type", "execution_date", "location", "status", "description", "created_at", "updated_at"],
  job_crews: ["id", "job_id", "crew_id", "role", "payment", "payment_status", "created_at", "updated_at"],
  deliveries: ["id", "job_id", "item_name", "delivery_type", "quantity", "deadline", "status", "notes", "created_at", "updated_at"],
  client_payments: ["id", "job_id", "term", "amount", "due_date", "paid_date", "status", "notes", "created_at", "updated_at"],
  vendor_payments: ["id", "job_id", "type", "amount", "due_date", "paid_date", "status", "notes", "created_at", "updated_at"],
  expenses: ["id", "job_id", "category", "description", "amount", "expense_date", "notes", "created_at", "updated_at"],
  admins: ["id", "name", "email", "password_hash", "created_at", "updated_at"],
};

export class SheetMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetMappingError";
  }
}

/** Baris dianggap kosong bila seluruh cell kosong/whitespace. */
export function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => cell === undefined || String(cell).trim() === "");
}

export function validateHeaders(sheet: SheetTitle, actual: string[]): void {
  const expected = SHEET_HEADERS[sheet];
  const same =
    actual.length === expected.length &&
    expected.every((h, i) => actual[i] === h);
  if (!same) {
    throw new SheetMappingError(
      `Header worksheet '${sheet}' tidak sesuai. Diharapkan [${expected.join(", ")}], didapat [${actual.join(", ")}].`,
    );
  }
}

/** Zip header dengan cell per indeks; cell yang tidak ada menjadi "" (tanpa geser kolom). */
export function rowToRecord(headers: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((h, i) => {
    record[h] = row[i] === undefined ? "" : String(row[i]).trim();
  });
  return record;
}

function ctx(sheet: SheetTitle, rowNumber: number, column: string): string {
  return `worksheet '${sheet}', baris ${rowNumber}, kolom '${column}'`;
}

function requiredString(rec: Record<string, string>, key: string, sheet: SheetTitle, rowNumber: number): string {
  const v = rec[key];
  if (v === undefined || v === "") {
    throw new SheetMappingError(`Nilai wajib kosong pada ${ctx(sheet, rowNumber, key)}.`);
  }
  return v;
}

function optionalString(rec: Record<string, string>, key: string): string | undefined {
  const v = rec[key];
  return v === undefined || v === "" ? undefined : v;
}

function requiredNumber(rec: Record<string, string>, key: string, sheet: SheetTitle, rowNumber: number): number {
  const raw = rec[key];
  if (raw === undefined || raw === "") {
    throw new SheetMappingError(`Angka wajib kosong pada ${ctx(sheet, rowNumber, key)}.`);
  }
  const n = Number(raw.replace(/[.,](?=\d{3}\b)/g, "").replace(/,/g, "."));
  if (!Number.isFinite(n)) {
    throw new SheetMappingError(`Angka tidak valid '${raw}' pada ${ctx(sheet, rowNumber, key)}.`);
  }
  return n;
}

function optionalNumber(rec: Record<string, string>, key: string, sheet: SheetTitle, rowNumber: number): number | undefined {
  const raw = rec[key];
  if (raw === undefined || raw === "") {
    return undefined;
  }
  const n = Number(raw.replace(/[.,](?=\d{3}\b)/g, "").replace(/,/g, "."));
  if (!Number.isFinite(n)) {
    throw new SheetMappingError(`Angka tidak valid '${raw}' pada ${ctx(sheet, rowNumber, key)}.`);
  }
  return n;
}

function optionalEnum<T extends string>(
  rec: Record<string, string>,
  key: string,
  allowed: readonly T[],
  sheet: SheetTitle,
  rowNumber: number,
): T | undefined {
  const raw = rec[key];
  if (raw === undefined || raw === "") {
    return undefined;
  }
  const normalized = normalizeEnum(raw) as T;
  if (!allowed.includes(normalized)) {
    throw new SheetMappingError(
      `Nilai '${raw}' tidak valid pada ${ctx(sheet, rowNumber, key)}. Nilai yang diizinkan: ${allowed.join(", ")}.`,
    );
  }
  return normalized;
}

function normalizeEnum(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function requiredEnum<T extends string>(
  rec: Record<string, string>,
  key: string,
  allowed: readonly T[],
  sheet: SheetTitle,
  rowNumber: number,
): T {
  const raw = rec[key];
  if (raw === undefined || raw === "") {
    throw new SheetMappingError(`Nilai wajib kosong pada ${ctx(sheet, rowNumber, key)}.`);
  }
  const normalized = normalizeEnum(raw) as T;
  if (!allowed.includes(normalized)) {
    throw new SheetMappingError(
      `Nilai '${raw}' tidak valid pada ${ctx(sheet, rowNumber, key)}. Nilai yang diizinkan: ${allowed.join(", ")}.`,
    );
  }
  return normalized;
}

const JOB_STATUSES: readonly JobStatus[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"];
const DELIVERY_STATUSES: readonly DeliveryStatus[] = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"];
const PAYMENT_STATUSES: readonly PaymentStatus[] = ["UNPAID", "PARTIAL", "PAID"];
const JOB_CATEGORIES: readonly JobCategory[] = ["WEDDING", "PREWEDDING", "CORPORATE", "EVENT", "OTHER"];
const CLIENT_PAYMENT_TERMS: readonly ClientPaymentTerm[] = ["TERMIN_1", "TERMIN_2", "TERMIN_3"];
const VENDOR_PAYMENT_TYPES: readonly VendorPaymentType[] = ["DP", "PELUNASAN"];

export function mapClient(rec: Record<string, string>, sheet: SheetTitle, rowNumber: number): Client {
  return {
    id: requiredString(rec, "id", sheet, rowNumber),
    name: requiredString(rec, "name", sheet, rowNumber),
    phone: optionalString(rec, "contact"),
    address: optionalString(rec, "address"),
    notes: optionalString(rec, "notes"),
  };
}

export function mapVendor(rec: Record<string, string>, sheet: SheetTitle, rowNumber: number): Vendor {
  return {
    id: requiredString(rec, "id", sheet, rowNumber),
    name: requiredString(rec, "name", sheet, rowNumber),
    phone: optionalString(rec, "contact"),
    notes: optionalString(rec, "notes"),
  };
}

export function mapVenue(rec: Record<string, string>, sheet: SheetTitle, rowNumber: number): Venue {
  return {
    id: requiredString(rec, "id", sheet, rowNumber),
    name: requiredString(rec, "name", sheet, rowNumber),
    address: optionalString(rec, "address"),
    contact: optionalString(rec, "contact"),
    notes: optionalString(rec, "notes"),
  };
}

export function mapCrew(rec: Record<string, string>, sheet: SheetTitle, rowNumber: number): Crew {
  return {
    id: requiredString(rec, "id", sheet, rowNumber),
    name: requiredString(rec, "name", sheet, rowNumber),
    role: requiredString(rec, "role", sheet, rowNumber),
    phone: optionalString(rec, "contact"),
    defaultPayment: requiredNumber(rec, "default_payment", sheet, rowNumber),
    notes: optionalString(rec, "notes"),
  };
}

export function mapJob(rec: Record<string, string>, sheet: SheetTitle, rowNumber: number): Job {
  return {
    id: requiredString(rec, "id", sheet, rowNumber),
    jobNumber: requiredString(rec, "job_number", sheet, rowNumber),
    jobName: requiredString(rec, "job_name", sheet, rowNumber),
    category: requiredEnum(rec, "job_type", JOB_CATEGORIES, sheet, rowNumber),
    clientId: optionalString(rec, "client_id"),
    vendorId: optionalString(rec, "vendor_id"),
    venueId: optionalString(rec, "venue_id"),
    executionDate: requiredString(rec, "execution_date", sheet, rowNumber),
    status: requiredEnum(rec, "status", JOB_STATUSES, sheet, rowNumber),
    location: optionalString(rec, "location"),
    notes: optionalString(rec, "description"),
    createdAt: requiredString(rec, "created_at", sheet, rowNumber),
    updatedAt: requiredString(rec, "updated_at", sheet, rowNumber),
  };
}

export function mapJobCrew(rec: Record<string, string>, sheet: SheetTitle, rowNumber: number): JobCrew {
  return {
    id: requiredString(rec, "id", sheet, rowNumber),
    jobId: requiredString(rec, "job_id", sheet, rowNumber),
    crewId: requiredString(rec, "crew_id", sheet, rowNumber),
    role: requiredString(rec, "role", sheet, rowNumber),
    actualPayment: requiredNumber(rec, "payment", sheet, rowNumber),
    paymentStatus: optionalEnum(rec, "payment_status", PAYMENT_STATUSES, sheet, rowNumber),
  };
}

export function mapDelivery(rec: Record<string, string>, sheet: SheetTitle, rowNumber: number): Delivery {
  return {
    id: requiredString(rec, "id", sheet, rowNumber),
    jobId: requiredString(rec, "job_id", sheet, rowNumber),
    name: requiredString(rec, "item_name", sheet, rowNumber),
    deliveryType: optionalString(rec, "delivery_type"),
    quantity: optionalNumber(rec, "quantity", sheet, rowNumber),
    deadline: requiredString(rec, "deadline", sheet, rowNumber),
    status: requiredEnum(rec, "status", DELIVERY_STATUSES, sheet, rowNumber),
    notes: optionalString(rec, "notes"),
  };
}

export function mapClientPayment(rec: Record<string, string>, sheet: SheetTitle, rowNumber: number): ClientPayment {
  return {
    id: requiredString(rec, "id", sheet, rowNumber),
    jobId: requiredString(rec, "job_id", sheet, rowNumber),
    term: requiredEnum(rec, "term", CLIENT_PAYMENT_TERMS, sheet, rowNumber),
    amount: requiredNumber(rec, "amount", sheet, rowNumber),
    dueDate: optionalString(rec, "due_date"),
    paidDate: optionalString(rec, "paid_date"),
    status: requiredEnum(rec, "status", PAYMENT_STATUSES, sheet, rowNumber),
    notes: optionalString(rec, "notes"),
  };
}

export function mapVendorPayment(rec: Record<string, string>, sheet: SheetTitle, rowNumber: number): VendorPayment {
  return {
    id: requiredString(rec, "id", sheet, rowNumber),
    jobId: requiredString(rec, "job_id", sheet, rowNumber),
    type: requiredEnum(rec, "type", VENDOR_PAYMENT_TYPES, sheet, rowNumber),
    amount: requiredNumber(rec, "amount", sheet, rowNumber),
    dueDate: optionalString(rec, "due_date"),
    paidDate: optionalString(rec, "paid_date"),
    status: requiredEnum(rec, "status", PAYMENT_STATUSES, sheet, rowNumber),
    notes: optionalString(rec, "notes"),
  };
}

export function mapExpense(rec: Record<string, string>, sheet: SheetTitle, rowNumber: number): Expense {
  return {
    id: requiredString(rec, "id", sheet, rowNumber),
    jobId: requiredString(rec, "job_id", sheet, rowNumber),
    description: requiredString(rec, "description", sheet, rowNumber),
    category: requiredString(rec, "category", sheet, rowNumber),
    amount: requiredNumber(rec, "amount", sheet, rowNumber),
    date: requiredString(rec, "expense_date", sheet, rowNumber),
    notes: optionalString(rec, "notes"),
  };
}

export function mapAdmin(rec: Record<string, string>, sheet: SheetTitle, rowNumber: number): Admin {
  return {
    id: requiredString(rec, "id", sheet, rowNumber),
    name: requiredString(rec, "name", sheet, rowNumber),
    email: requiredString(rec, "email", sheet, rowNumber),
  };
}

/* -------------------------------------------------------------------------- */
/* Domain → Sheet (untuk operasi write)                                       */
/* -------------------------------------------------------------------------- */

function opt(v: string | undefined): string {
  return v ?? "";
}

function num(v: number | undefined): string {
  return v === undefined ? "" : String(v);
}

function assertEnumWrite<T extends string>(value: string, allowed: readonly T[], sheet: SheetTitle, column: string): void {
  if (!allowed.includes(value as T)) {
    throw new SheetMappingError(
      `Nilai '${value}' tidak valid untuk kolom '${column}' pada worksheet '${sheet}'. Nilai yang diizinkan: ${allowed.join(", ")}.`,
    );
  }
}

function assertFiniteWrite(value: number, sheet: SheetTitle, column: string): void {
  if (!Number.isFinite(value)) {
    throw new SheetMappingError(`Nilai angka tidak valid untuk kolom '${column}' pada worksheet '${sheet}'.`);
  }
}

/** Record ber-key nama header sheet, siap di-zip ke baris sesuai SHEET_HEADERS. */
export type SheetRecord = Record<string, string>;

/** Ubah SheetRecord menjadi array sel sesuai urutan header sheet. */
export function recordToRow(sheet: SheetTitle, rec: SheetRecord): string[] {
  return SHEET_HEADERS[sheet].map((h) => rec[h] ?? "");
}

export function clientToRecord(c: Client, createdAt: string, updatedAt: string): SheetRecord {
  // `contactPerson` dan `email` tidak punya kolom di schema sheet — tidak dipersist.
  return {
    id: c.id, name: c.name, address: opt(c.address), contact: opt(c.phone),
    notes: opt(c.notes), created_at: createdAt, updated_at: updatedAt,
  };
}

export function vendorToRecord(v: Vendor, createdAt: string, updatedAt: string): SheetRecord {
  return {
    id: v.id, name: v.name, contact: opt(v.phone), notes: opt(v.notes),
    created_at: createdAt, updated_at: updatedAt,
  };
}

export function venueToRecord(v: Venue, createdAt: string, updatedAt: string): SheetRecord {
  // `city` dan `capacity` tidak punya kolom di schema sheet — tidak dipersist.
  return {
    id: v.id, name: v.name, address: opt(v.address), contact: opt(v.contact),
    notes: opt(v.notes), created_at: createdAt, updated_at: updatedAt,
  };
}

export function crewToRecord(c: Crew, createdAt: string, updatedAt: string): SheetRecord {
  assertFiniteWrite(c.defaultPayment, "crew", "default_payment");
  return {
    id: c.id, name: c.name, role: c.role, contact: opt(c.phone),
    default_payment: String(c.defaultPayment), notes: opt(c.notes),
    created_at: createdAt, updated_at: updatedAt,
  };
}

export function jobToRecord(j: Job): SheetRecord {
  assertEnumWrite(j.category, JOB_CATEGORIES, "jobs", "job_type");
  assertEnumWrite(j.status, JOB_STATUSES, "jobs", "status");
  return {
    id: j.id, job_number: j.jobNumber, client_id: opt(j.clientId), vendor_id: opt(j.vendorId),
    venue_id: opt(j.venueId), job_name: j.jobName, job_type: j.category,
    execution_date: j.executionDate, location: opt(j.location), status: j.status,
    description: opt(j.notes), created_at: j.createdAt, updated_at: j.updatedAt,
  };
}

export function jobCrewToRecord(jc: JobCrew, createdAt: string, updatedAt: string): SheetRecord {
  assertFiniteWrite(jc.actualPayment, "job_crews", "payment");
  if (jc.paymentStatus !== undefined) {
    assertEnumWrite(jc.paymentStatus, PAYMENT_STATUSES, "job_crews", "payment_status");
  }
  return {
    id: jc.id, job_id: jc.jobId, crew_id: jc.crewId, role: jc.role,
    payment: String(jc.actualPayment), payment_status: opt(jc.paymentStatus),
    created_at: createdAt, updated_at: updatedAt,
  };
}

export function deliveryToRecord(d: Delivery, createdAt: string, updatedAt: string): SheetRecord {
  assertEnumWrite(d.status, DELIVERY_STATUSES, "deliveries", "status");
  if (d.quantity !== undefined) assertFiniteWrite(d.quantity, "deliveries", "quantity");
  return {
    id: d.id, job_id: d.jobId, item_name: d.name, delivery_type: opt(d.deliveryType),
    quantity: num(d.quantity), deadline: d.deadline, status: d.status,
    notes: opt(d.notes), created_at: createdAt, updated_at: updatedAt,
  };
}

export function clientPaymentToRecord(p: ClientPayment, createdAt: string, updatedAt: string): SheetRecord {
  assertEnumWrite(p.term, CLIENT_PAYMENT_TERMS, "client_payments", "term");
  assertEnumWrite(p.status, PAYMENT_STATUSES, "client_payments", "status");
  assertFiniteWrite(p.amount, "client_payments", "amount");
  return {
    id: p.id, job_id: p.jobId, term: p.term, amount: String(p.amount),
    due_date: opt(p.dueDate), paid_date: opt(p.paidDate), status: p.status,
    notes: opt(p.notes), created_at: createdAt, updated_at: updatedAt,
  };
}

export function vendorPaymentToRecord(p: VendorPayment, createdAt: string, updatedAt: string): SheetRecord {
  assertEnumWrite(p.type, VENDOR_PAYMENT_TYPES, "vendor_payments", "type");
  assertEnumWrite(p.status, PAYMENT_STATUSES, "vendor_payments", "status");
  assertFiniteWrite(p.amount, "vendor_payments", "amount");
  return {
    id: p.id, job_id: p.jobId, type: p.type, amount: String(p.amount),
    due_date: opt(p.dueDate), paid_date: opt(p.paidDate), status: p.status,
    notes: opt(p.notes), created_at: createdAt, updated_at: updatedAt,
  };
}

export function expenseToRecord(e: Expense, createdAt: string, updatedAt: string): SheetRecord {
  assertFiniteWrite(e.amount, "expenses", "amount");
  return {
    id: e.id, job_id: e.jobId, category: e.category, description: e.description,
    amount: String(e.amount), expense_date: e.date, notes: opt(e.notes),
    created_at: createdAt, updated_at: updatedAt,
  };
}
