import type { ReconciliationIssue } from "@/domain/reconciliation";
import type { SheetTitle } from "@/repositories/google/mapping";

/**
 * Tipe migrasi historis (P0D-1).
 *
 * Semua tipe di folder ini adalah bagian dari PERENCANAAN: tidak ada tipe yang
 * menulis ke sumber (Google Sheets) maupun target (MySQL). Rencana migrasi
 * dihasilkan sebagai data (plan entries) untuk direview, bukan dieksekusi.
 */

/** Entity target yang terlibat dalam migrasi (urutan FK-safe ada di mapping-spec). */
export const MIGRATION_ENTITIES = [
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

export type MigrationEntity = (typeof MIGRATION_ENTITIES)[number];

/** Status per baris rencana migrasi. */
export const MIGRATION_ROW_STATUSES = [
  "READY",
  "RECONCILIATION_REQUIRED",
  "SKIP_DUPLICATE",
  "DEFERRED",
] as const;

export type MigrationRowStatus = (typeof MIGRATION_ROW_STATUSES)[number];

/** Identitas stabil sebuah baris sumber. */
export interface SourceIdentity {
  sheet: SheetTitle;
  /** Nilai kolom `id` pada worksheet sumber (identitas stabil lintas run). */
  sourceId: string;
  /** Nomor baris pada worksheet (dipakai hanya untuk pesan/diagnostik). */
  rowNumber: number;
}

/** Satu entri rencana migrasi (satu baris sumber → satu baris target). */
export interface MigrationPlanEntry {
  entity: MigrationEntity;
  targetTable: string;
  /** UUID deterministik yang dibentuk dari identitas sumber (bukan random). */
  targetId: string;
  source: SourceIdentity;
  /** Sidik jari isi baris sumber (deteksi perubahan antar-run). */
  fingerprint: string;
  status: MigrationRowStatus;
  issues: ReconciliationIssue[];
  /**
   * Nilai kanonik yang AKAN ditulis bila entri ini disetujui. Uang selalu
   * berupa `Amount` (string desimal), tidak pernah `number`.
   */
  values: Record<string, string | number | boolean | null>;
  /** Kunci idempotensi deterministik (hanya untuk `cashflows`). */
  idempotencyKey?: string;
  /** Catatan audit: nilai sumber asli yang sengaja tidak dinormalisasi. */
  audit?: Record<string, string>;
}

/** Alasan sebuah baris tidak dapat dipetakan otomatis. */
export interface MigrationIssue extends ReconciliationIssue {
  /** Kode kategori untuk agregasi laporan. */
  origin: "venue" | "crew_role" | "payment" | "expense" | "reference" | "identity" | "domain";
}

export interface MigrationSourceSnapshot {
  /** Baris per worksheet, sudah dalam bentuk sel (belum dipetakan). */
  rows?: Partial<Record<SheetTitle, Array<{ rowNumber: number; values: string[] }>>>;
  /** Arsip venue (id → nama) untuk `legacyVenueName`. */
  venueArchive?: Array<{ id: string; name: string }>;
  /** Kamus crew role yang DISETUJUI (id + nama kanonik). */
  crewRoleDictionary?: Array<{ id: string; name: string }>;
}
