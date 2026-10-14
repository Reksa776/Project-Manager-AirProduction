import { createHash } from "node:crypto";

import type { SheetTitle } from "@/repositories/google/mapping";

/**
 * IDENTITAS & IDEMPOTENSI MIGRASI (P0D-1).
 *
 * Prinsip:
 * - Identitas baris = (worksheet, kolom `id` sumber) → stabil lintas run.
 * - ID target = UUID deterministik (turunan SHA-256), BUKAN random, sehingga
 *   menjalankan ulang rencana yang sama menghasilkan ID yang sama.
 * - Sidik jari isi baris mendeteksi perubahan sumber antar-run.
 * - Kunci idempotensi cashflow deterministik: `<namespace>:<sheet>:<sourceId>`
 *   (tanpa random). Re-run yang sama tidak menghasilkan baris kas kedua.
 */

/** Namespace migrasi — bagian dari kunci idempotensi, mencegah tabrakan dengan kas manual. */
export const MIGRATION_NAMESPACE = "airprod-p0d-migration";

export type RunConflict = "UNCHANGED" | "CHANGED";

/** `sheet:sourceId` — identitas stabil sumber. */
export function sourceIdentityString(sheet: SheetTitle, sourceId: string): string {
  return `${sheet}:${sourceId}`;
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * UUID deterministik (format v5-style) dari identitas sumber.
 * Dipakai sebagai nilai kolom `id` varchar(36) pada baris hasil migrasi.
 */
export function deterministicMigrationId(sheet: SheetTitle, sourceId: string): string {
  const digest = sha256Hex(`${MIGRATION_NAMESPACE}|${sourceIdentityString(sheet, sourceId)}`);
  const hex = digest.slice(0, 32).split("");
  // version 5
  hex[12] = "5";
  // variant (8/9/a/b)
  const variant = parseInt(hex[16]!, 16);
  hex[16] = ((variant & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20, 32),
  ].join("-");
}

const UUID_V5_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isDeterministicMigrationId(value: string): boolean {
  return UUID_V5_PATTERN.test(value);
}

/**
 * Sidik jari isi baris sumber: SHA-256 dari pasangan `kolom=value` yang
 * diurutkan, sehingga urutan kolom/baris tidak mengubah hasil.
 * Sel kosong dinormalisasi menjadi string kosong (perilaku `rowToRecord`).
 */
export function sourceFingerprint(record: Record<string, string>): string {
  const canonical = Object.keys(record)
    .sort()
    .map((key) => `${key}=${record[key] ?? ""}`)
    .join("\n");
  return sha256Hex(canonical);
}

/** Sidik jari agregat seluruh rencana (bukti integritas snapshot sumber). */
export function snapshotFingerprint(
  entries: readonly { source: { sheet: string; sourceId: string }; fingerprint: string }[],
): string {
  const canonical = entries
    .map((entry) => `${entry.source.sheet}:${entry.source.sourceId}:${entry.fingerprint}`)
    .sort()
    .join("\n");
  return sha256Hex(`${MIGRATION_NAMESPACE}|snapshot|${canonical}`);
}

/**
 * Kunci idempotensi deterministik untuk baris `cashflows` hasil migrasi.
 * Panjang maksimum 190 karakter (batas kolom `idempotency_key`).
 */
export function migrationIdempotencyKey(sheet: SheetTitle, sourceId: string): string {
  const key = `migration:${sourceIdentityString(sheet, sourceId)}`;
  if (key.length > 190) {
    throw new Error(
      `Kunci idempotensi melebihi 190 karakter untuk ${sourceIdentityString(sheet, sourceId)}.`,
    );
  }
  return key;
}

/** Deteksi perubahan baris sumber antara dua run (tanpa menimpa). */
export function detectRunConflict(
  previousFingerprint: string | undefined,
  nextFingerprint: string,
): RunConflict {
  if (previousFingerprint === undefined) return "CHANGED";
  return previousFingerprint === nextFingerprint ? "UNCHANGED" : "CHANGED";
}

/**
 * Deteksi duplikat identitas sumber dalam satu snapshot.
 * Duplikat = dua baris dengan `id` yang sama pada worksheet yang sama.
 */
export function findDuplicateSourceIds(
  rows: readonly { sheet: SheetTitle; sourceId: string; rowNumber: number }[],
): Array<{ sheet: SheetTitle; sourceId: string; rowNumbers: number[] }> {
  const buckets = new Map<string, { sheet: SheetTitle; sourceId: string; rowNumbers: number[] }>();
  for (const row of rows) {
    const key = sourceIdentityString(row.sheet, row.sourceId);
    const bucket = buckets.get(key);
    if (bucket) bucket.rowNumbers.push(row.rowNumber);
    else buckets.set(key, { sheet: row.sheet, sourceId: row.sourceId, rowNumbers: [row.rowNumber] });
  }
  return [...buckets.values()].filter((bucket) => bucket.rowNumbers.length > 1);
}
