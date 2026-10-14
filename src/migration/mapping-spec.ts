import { SHEET_HEADERS, SHEET_TITLES, type SheetTitle } from "@/repositories/google/mapping";
import { MIGRATION_ENTITIES, type MigrationEntity } from "./types";

/**
 * SPESIFIKASI MAPPING SUMBER → TARGET (P0D-1) — hanya data statis.
 *
 * Sumber kebenaran kolom sumber = `SHEET_HEADERS` di
 * `src/repositories/google/mapping.ts` (kontrak worksheet yang benar-benar
 * dipakai repository Google aktif), bukan asumsi.
 *
 * Disposisi kolom:
 * - `MAPPED`   : punya kolom target; `transform` menyebut helper yang dipakai.
 * - `ARCHIVED` : tidak punya entity target (venue) → dipakai sebagai arsip/`legacy_venue_name`.
 * - `NOT_MIGRATED`: sengaja tidak dipindahkan (mis. status tersimpan yang kini derivatif).
 * - `UNAVAILABLE_IN_TARGET`: nilai sumber tidak dapat dipetakan (tidak dipakai).
 */

export type SourceColumnDisposition =
  | { kind: "MAPPED"; target: string; transform: string }
  | { kind: "ARCHIVED"; target: string; note: string }
  | { kind: "NOT_MIGRATED"; reason: string }
  | { kind: "UNAVAILABLE_IN_TARGET"; reason: string };

export interface TargetOnlyColumn {
  column: string;
  note: string;
}

export interface SheetMappingSpec {
  sheet: SheetTitle;
  /** Entity target; `undefined` = tidak ada tabel target (venue = arsip). */
  entity?: MigrationEntity;
  targetTable?: string;
  /** Entity yang harus dimigrasi lebih dulu (FK). */
  dependsOn: MigrationEntity[];
  columns: Record<string, SourceColumnDisposition>;
  /** Kolom target yang tidak memiliki sumber. */
  targetOnlyColumns: TargetOnlyColumn[];
  requiredTransformations: string[];
  duplicateRisks: string[];
  financialReconciliation: string[];
}

const m = (target: string, transform: string): SourceColumnDisposition => ({
  kind: "MAPPED",
  target,
  transform,
});

export const SHEET_MAPPING_SPECS: Record<SheetTitle, SheetMappingSpec> = {
  clients: {
    sheet: "clients",
    entity: "clients",
    targetTable: "clients",
    dependsOn: [],
    columns: {
      id: m("id", "preserve source id (varchar(36)); collision → RepositoryConflictError"),
      name: m("name", "trim; required (varchar(120))"),
      address: m("address", "optional text"),
      contact: m("phone", "rename kolom: contact → phone"),
      notes: m("notes", "optional text"),
      created_at: m("created_at", "preserve ISO string"),
      updated_at: m("updated_at", "preserve ISO string"),
    },
    targetOnlyColumns: [
      { column: "company_name", note: "tidak ada di sumber → NULL" },
      { column: "contact_person", note: "tidak ada di sumber (hanya `contact`) → NULL" },
      { column: "email", note: "tidak ada di sumber → NULL" },
      { column: "client_type", note: "tidak ada di sumber → NULL (enum tidak ditebak)" },
    ],
    requiredTransformations: ["string trim", "validasi panjang kolom"],
    duplicateRisks: ["nama client duplikat (tidak ada UNIQUE di target)"],
    financialReconciliation: [],
  },

  vendors: {
    sheet: "vendors",
    entity: "vendors",
    targetTable: "vendors",
    dependsOn: [],
    columns: {
      id: m("id", "preserve source id"),
      name: m("name", "trim; required"),
      contact: m("phone", "contact → phone"),
      notes: m("notes", "optional text"),
      created_at: m("created_at", "preserve ISO string"),
      updated_at: m("updated_at", "preserve ISO string"),
    },
    targetOnlyColumns: [
      { column: "contact_person", note: "tidak ada di sumber → NULL" },
      { column: "email", note: "tidak ada di sumber → NULL" },
    ],
    requiredTransformations: ["string trim"],
    duplicateRisks: ["nama vendor duplikat (tidak ada UNIQUE di target)"],
    financialReconciliation: [],
  },

  venues: {
    sheet: "venues",
    // Tidak ada entity/tabel target: venue dihapus dari domain kanonik.
    dependsOn: [],
    columns: {
      id: { kind: "ARCHIVED", target: "jobs.legacy_venue_name (lookup)", note: "kunci arsip venue_id → name" },
      name: { kind: "ARCHIVED", target: "jobs.legacy_venue_name", note: "nilai yang disnapshot ke job" },
      address: { kind: "UNAVAILABLE_IN_TARGET", reason: "venue bukan entity aktif; alamat venue tidak disimpan" },
      contact: { kind: "UNAVAILABLE_IN_TARGET", reason: "venue bukan entity aktif; kontak venue tidak disimpan" },
      notes: { kind: "UNAVAILABLE_IN_TARGET", reason: "venue bukan entity aktif; catatan venue tidak disimpan" },
      created_at: { kind: "UNAVAILABLE_IN_TARGET", reason: "tidak ada tabel venue" },
      updated_at: { kind: "UNAVAILABLE_IN_TARGET", reason: "tidak ada tabel venue" },
    },
    targetOnlyColumns: [],
    requiredTransformations: ["buildVenueArchive (id → name, deteksi duplikat/kosong)"],
    duplicateRisks: ["venue_id duplikat dengan nama berbeda → konflik arsip"],
    financialReconciliation: [],
  },

  crew: {
    sheet: "crew",
    entity: "crew",
    targetTable: "crew",
    dependsOn: ["crewRoles"],
    columns: {
      id: m("id", "preserve source id"),
      name: m("name", "trim; required"),
      role: m("crew_role_id", "proposedCrewRoleDictionary → crew_roles.id; tidak ada pembuatan role implisit"),
      contact: m("phone", "contact → phone"),
      default_payment: m("default_payment", "parseAmount (string desimal, minor units BigInt)"),
      notes: m("notes", "optional text"),
      created_at: m("created_at", "preserve ISO string"),
      updated_at: m("updated_at", "preserve ISO string"),
    },
    targetOnlyColumns: [],
    requiredTransformations: ["normalisasi role", "parseAmount"],
    duplicateRisks: ["crew dengan nama sama", "variasi penulisan role (case/spasi)"],
    financialReconciliation: ["default_payment adalah DEFAULT, bukan kas aktual → tidak menghasilkan cashflow"],
  },

  jobs: {
    sheet: "jobs",
    entity: "jobs",
    targetTable: "jobs",
    dependsOn: ["clients", "vendors"],
    columns: {
      id: m("id", "preserve source id"),
      job_number: m("job_number", "preserve apa adanya (generator = P2A); UNIQUE"),
      client_id: m("client_id", "FK clients.id (nullable)"),
      vendor_id: m("vendor_id", "FK vendors.id (nullable)"),
      venue_id: m("legacy_venue_name", "resolveLegacyVenue(venue_id, venueArchive) → snapshot nama"),
      job_name: m("job_name", "trim; required"),
      job_type: m("category", "enum JOB_CATEGORY; nilai tak dikenal → RECONCILIATION_REQUIRED"),
      execution_date: m("execution_date", "validasi YYYY-MM-DD"),
      location: m("location", "optional text"),
      status: m("status", "enum JOB_STATUS"),
      description: m("notes", "rename kolom: description → notes"),
      created_at: m("created_at", "preserve ISO string"),
      updated_at: m("updated_at", "preserve ISO string"),
    },
    targetOnlyColumns: [],
    requiredTransformations: ["venue archive lookup", "validasi XOR client/vendor", "enum validation"],
    duplicateRisks: ["job_number duplikat → UNIQUE violation", "client_id DAN vendor_id sama-sama terisi → CHECK XOR"],
    financialReconciliation: [],
  },

  job_crews: {
    sheet: "job_crews",
    entity: "jobCrewAssignments",
    targetTable: "job_crews",
    dependsOn: ["jobs", "crew", "crewRoles"],
    columns: {
      id: m("id", "preserve source id"),
      job_id: m("job_id", "FK jobs.id"),
      crew_id: m("crew_id", "FK crew.id"),
      role: m("crew_role_id", "override: NULL bila sama dengan role master crew, selain itu resolve role"),
      payment: m("agreed_amount", "parseAmount; OBLIGASI (bukan kas aktual)"),
      payment_status: {
        kind: "NOT_MIGRATED",
        reason:
          "status tersimpan kini derivatif (dihitung dari cashflows); status lama dibandingkan lewat reconcileStoredPaymentStatus dan TIDAK disalin",
      },
      created_at: m("created_at", "preserve ISO string"),
      updated_at: m("updated_at", "preserve ISO string"),
    },
    targetOnlyColumns: [],
    requiredTransformations: ["crew role override resolution", "payment status reconciliation", "parseAmount"],
    duplicateRisks: ["assignment crew ganda untuk job+crew yang sama"],
    financialReconciliation: [
      "payment = kesepakatan (obligasi); kas aktual hanya dari bukti pembayaran",
      "payment_status=PAID tanpa bukti kas → RECONCILIATION_REQUIRED",
    ],
  },

  deliveries: {
    sheet: "deliveries",
    entity: "deliveries",
    targetTable: "deliveries",
    dependsOn: ["jobs"],
    columns: {
      id: m("id", "preserve source id"),
      job_id: m("job_id", "FK jobs.id"),
      item_name: m("name", "rename kolom: item_name → name"),
      delivery_type: m("delivery_type", "optional text"),
      quantity: m("quantity", "integer ≥ 0 (CHECK)"),
      deadline: m("deadline", "validasi YYYY-MM-DD"),
      status: m("status", "enum DELIVERY_STATUS"),
      notes: m("notes", "optional text"),
      created_at: m("created_at", "preserve ISO string"),
      updated_at: m("updated_at", "preserve ISO string"),
    },
    targetOnlyColumns: [{ column: "delivered_at", note: "tidak ada di sumber → NULL" }],
    requiredTransformations: ["validasi quantity", "enum validation"],
    duplicateRisks: ["delivery ganda dengan nama sama pada satu job (tidak ada UNIQUE)"],
    financialReconciliation: [],
  },

  client_payments: {
    sheet: "client_payments",
    entity: "clientPaymentSchedules",
    targetTable: "client_payments",
    dependsOn: ["jobs"],
    columns: {
      id: m("id", "preserve source id"),
      job_id: m("job_id", "FK jobs.id"),
      term: m("term", "enum ClientPaymentTerm"),
      amount: m("amount", "parseAmount; OBLIGASI (CHECK amount > 0)"),
      due_date: m("due_date", "validasi YYYY-MM-DD"),
      paid_date: m("paid_date", "validasi YYYY-MM-DD (bukti kas bila lunas)"),
      status: {
        kind: "NOT_MIGRATED",
        reason: "status tersimpan kini derivatif; dibandingkan lewat reconcileStoredPaymentStatus",
      },
      notes: m("notes", "optional text"),
      created_at: m("created_at", "preserve ISO string"),
      updated_at: m("updated_at", "preserve ISO string"),
    },
    targetOnlyColumns: [],
    requiredTransformations: ["parseAmount", "payment evidence reconciliation"],
    duplicateRisks: ["(job_id, term) ganda (tidak ada UNIQUE di target) → laporan duplikat"],
    financialReconciliation: [
      "status PAID/PARTIAL hanya menghasilkan kas bila ada bukti (paid_date); status saja tidak cukup",
      "status PARTIAL tanpa nominal parsial → RECONCILIATION_REQUIRED (nominal tidak boleh dikarang)",
    ],
  },

  vendor_payments: {
    sheet: "vendor_payments",
    entity: "vendorPaymentSchedules",
    targetTable: "vendor_payments",
    dependsOn: ["jobs"],
    columns: {
      id: m("id", "preserve source id"),
      job_id: m("job_id", "FK jobs.id"),
      type: m("type", "enum VendorPaymentType"),
      amount: m("amount", "parseAmount; OBLIGASI (CHECK amount > 0)"),
      due_date: m("due_date", "validasi YYYY-MM-DD"),
      paid_date: m("paid_date", "validasi YYYY-MM-DD (bukti kas bila lunas)"),
      status: {
        kind: "NOT_MIGRATED",
        reason: "status tersimpan kini derivatif; dibandingkan lewat reconcileStoredPaymentStatus",
      },
      notes: m("notes", "optional text"),
      created_at: m("created_at", "preserve ISO string"),
      updated_at: m("updated_at", "preserve ISO string"),
    },
    targetOnlyColumns: [],
    requiredTransformations: ["parseAmount", "payment evidence reconciliation"],
    duplicateRisks: ["(job_id, type) ganda (tidak ada UNIQUE di target) → laporan duplikat"],
    financialReconciliation: [
      "status PAID/PARTIAL hanya menghasilkan kas bila ada bukti (paid_date)",
      "expense kategori VENDOR dapat duplikat dengan jadwal ini → dedup berbukti",
    ],
  },

  expenses: {
    sheet: "expenses",
    entity: "cashflows",
    targetTable: "cashflows",
    dependsOn: ["jobs", "jobCrewAssignments", "clientPaymentSchedules", "vendorPaymentSchedules"],
    columns: {
      id: m("idempotency_key/fingerprint", "identitas sumber → kunci idempotensi deterministik"),
      job_id: m("job_id", "FK jobs.id (nullable hanya bila disetujui)"),
      category: m(
        "category",
        "classifyLegacyExpense → READY / PROVEN_DUPLICATE / POTENTIAL_DUPLICATE / RECONCILIATION_REQUIRED (nominal sama = kandidat, bukan bukti)",
      ),
      description: m("description", "required (varchar(190))"),
      amount: m("amount", "parseAmount (CHECK amount > 0)"),
      expense_date: m("occurred_on", "rename kolom: expense_date → occurred_on"),
      notes: {
        kind: "UNAVAILABLE_IN_TARGET",
        reason: "cashflows tidak memiliki kolom notes; nilai dicatat di audit metadata",
      },
      created_at: m("created_at", "preserve ISO string"),
      updated_at: m("updated_at", "preserve ISO string"),
    },
    targetOnlyColumns: [
      { column: "direction", note: "selalu EXPENSE (dari definisi expense)" },
      { column: "reference_type/reference_id", note: "hanya bila dedup terhadap jadwal/assignment terbukti" },
      { column: "source", note: "selalu MIGRATION" },
    ],
    requiredTransformations: [
      "expense classification",
      "parseAmount",
      "deterministic idempotency key",
      "duplicate detection terhadap jadwal/assignment",
    ],
    duplicateRisks: [
      "expense CREW/VENDOR menduplikasi job_crews/vendor_payments",
      "satu pembayaran diwakili jadwal LUNAS dan expense sekaligus",
    ],
    financialReconciliation: [
      "kategori CREW/VENDOR TIDAK pernah otomatis menjadi kas (ambigu)",
      "TRANSPORT/EQUIPMENT/OTHER deterministik → kas EXPENSE",
    ],
  },

  admins: {
    sheet: "admins",
    entity: "admins",
    targetTable: "admins",
    dependsOn: [],
    columns: {
      id: m("id", "preserve source id"),
      name: m("name", "trim; required"),
      email: m("email", "UNIQUE di target (deteksi duplikat)"),
      password_hash: m("password_hash", "hash lama dipertahankan bila format didukung; verifikasi = P1A"),
      created_at: m("created_at", "preserve ISO string"),
      updated_at: m("updated_at", "preserve ISO string"),
    },
    targetOnlyColumns: [
      { column: "role", note: "tidak ada di sumber → DEFAULT 'ADMIN' (kolom, bukan keputusan bisnis)" },
      { column: "is_active", note: "tidak ada di sumber → DEFAULT true" },
      { column: "last_login_at", note: "tidak ada di sumber → NULL" },
    ],
    requiredTransformations: ["UNIQUE email check"],
    duplicateRisks: ["email admin duplikat → UNIQUE violation"],
    financialReconciliation: [],
  },
};

/** Urutan migrasi FK-safe (hasil inspeksi constraint skema MySQL target). */
export const MIGRATION_ORDER: readonly MigrationEntity[] = [
  "admins",
  "crewRoles",
  "clients",
  "vendors",
  "crew",
  "jobs",
  "jobCrewAssignments",
  "deliveries",
  "clientPaymentSchedules",
  "vendorPaymentSchedules",
  "cashflows",
] as const;

export interface ValidationOutcome {
  ok: boolean;
  errors: string[];
}

/** Rencana migrasi harus memuat seluruh entity target tepat satu kali. */
export function validateMigrationOrder(
  order: readonly MigrationEntity[] = MIGRATION_ORDER,
): ValidationOutcome {
  const errors: string[] = [];
  const seen = new Set<MigrationEntity>();

  for (const entity of order) {
    if (seen.has(entity)) errors.push(`Entity '${entity}' muncul lebih dari sekali pada urutan migrasi.`);
    seen.add(entity);
  }
  for (const entity of MIGRATION_ENTITIES) {
    if (!seen.has(entity)) errors.push(`Entity '${entity}' tidak ada pada urutan migrasi.`);
  }

  const position = new Map(order.map((entity, index) => [entity, index]));
  for (const spec of Object.values(SHEET_MAPPING_SPECS)) {
    if (!spec.entity) continue;
    const own = position.get(spec.entity);
    if (own === undefined) continue;
    for (const dependency of spec.dependsOn) {
      const dep = position.get(dependency);
      if (dep === undefined) {
        errors.push(`Entity '${spec.entity}' bergantung pada '${dependency}' yang tidak ada di urutan.`);
        continue;
      }
      if (dep >= own) {
        errors.push(
          `Urutan salah: '${spec.entity}' (posisi ${own}) harus setelah '${dependency}' (posisi ${dep}).`,
        );
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Setiap kolom worksheet sumber HARUS punya disposisi eksplisit, dan tidak boleh
 * ada disposisi untuk kolom yang tidak ada di worksheet. Ini menjaga inventaris
 * tetap sinkron dengan kontrak worksheet yang dipakai repository Google aktif.
 */
export function validateSpecCoverage(
  specs: Record<SheetTitle, SheetMappingSpec> = SHEET_MAPPING_SPECS,
): ValidationOutcome {
  const errors: string[] = [];

  for (const sheet of SHEET_TITLES) {
    const spec = specs[sheet];
    if (!spec) {
      errors.push(`Worksheet '${sheet}' tidak memiliki spesifikasi mapping.`);
      continue;
    }
    const headers = SHEET_HEADERS[sheet];
    for (const header of headers) {
      if (!(header in spec.columns)) {
        errors.push(`Kolom '${sheet}.${header}' belum memiliki disposisi mapping.`);
      }
    }
    for (const column of Object.keys(spec.columns)) {
      if (!headers.includes(column)) {
        errors.push(`Spesifikasi '${sheet}.${column}' bukan kolom worksheet yang sebenarnya.`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Daftar kolom sumber yang tidak dipetakan ke kolom target (inventaris cepat). */
export function unmappedSourceColumns(sheet: SheetTitle): string[] {
  const spec = SHEET_MAPPING_SPECS[sheet];
  return Object.entries(spec.columns)
    .filter(([, disposition]) => disposition.kind !== "MAPPED")
    .map(([column, disposition]) => `${column} (${disposition.kind})`);
}
