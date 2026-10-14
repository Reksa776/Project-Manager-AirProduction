import {
  ok,
  reconcileLegacyVenue,
  reconciliationRequired,
  type ReconciliationIssue,
  type Reconciled,
} from "@/domain/reconciliation";

/**
 * ARSIP VENUE HISTORIS (P0D-1).
 *
 * Venue bukan entity aktif pada Contract v2 (tidak ada tabel `venues`). Nama
 * venue historis hanya dipakai untuk mengisi `jobs.legacy_venue_name`.
 *
 * Format arsip (provenance): baris worksheet `venues` pada spreadsheet yang
 * sama dengan sumber lain — kolom `id` (venue_id lama) dan `name`. Arsip
 * dibangun dari snapshot sumber, TIDAK disimpan sebagai master baru dan TIDAK
 * membuat tabel venue.
 *
 * Aturan:
 * - Nama yang diketahui dipertahankan apa adanya (trim) — tidak ada nilai karangan.
 * - venue_id dengan nama berbeda pada dua baris → konflik arsip (butuh keputusan).
 * - venue_id tanpa nama → tidak dapat menjadi snapshot → RECONCILIATION_REQUIRED.
 * - venue_id yang dirujuk Job tetapi tidak ada di arsip → RECONCILIATION_REQUIRED.
 * - ID venue sumber disimpan sebagai metadata audit pada rencana migrasi job.
 */

export interface VenueArchiveRow {
  id: string;
  name: string;
  rowNumber?: number;
}

export interface VenueArchiveConflict {
  venueId: string;
  names: string[];
  rowNumbers: number[];
}

export interface VenueArchive {
  /** venue_id → nama venue historis (trim, hanya nilai yang tidak konflik). */
  nameById: ReadonlyMap<string, string>;
  /** venue_id → daftar baris sumber (untuk audit). */
  sourceRowsById: ReadonlyMap<string, number[]>;
  conflicts: VenueArchiveConflict[];
  /** venue_id yang ada tetapi namanya kosong. */
  blankNameIds: string[];
  issues: ReconciliationIssue[];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Membangun arsip venue dari baris worksheet `venues` (read-only, tanpa efek samping). */
export function buildVenueArchive(rows: readonly VenueArchiveRow[]): VenueArchive {
  const namesById = new Map<string, string[]>();
  const sourceRowsById = new Map<string, number[]>();
  const conflicts: VenueArchiveConflict[] = [];
  const blankNameIds: string[] = [];

  for (const row of rows) {
    const venueId = row.id.trim();
    if (venueId === "") continue;
    const name = row.name.trim();
    const names = namesById.get(venueId) ?? [];
    names.push(name);
    namesById.set(venueId, names);
    if (row.rowNumber !== undefined) {
      const numbers = sourceRowsById.get(venueId) ?? [];
      numbers.push(row.rowNumber);
      sourceRowsById.set(venueId, numbers);
    }
  }

  const nameById = new Map<string, string>();
  for (const [venueId, names] of namesById) {
    const nonBlank = unique(names.filter((name) => name !== ""));
    if (nonBlank.length === 0) {
      blankNameIds.push(venueId);
      continue;
    }
    if (nonBlank.length > 1) {
      conflicts.push({
        venueId,
        names: nonBlank,
        rowNumbers: sourceRowsById.get(venueId) ?? [],
      });
      continue;
    }
    nameById.set(venueId, nonBlank[0]!);
  }

  const issues: ReconciliationIssue[] = [
    ...conflicts.map((conflict) => ({
      code: "VENUE_ARCHIVE_CONFLICT",
      message: `venue_id '${conflict.venueId}' memiliki ${conflict.names.length} nama berbeda pada arsip (${conflict.names.join(" | ")}); nama tidak boleh ditebak.`,
      field: "venues.name",
    })),
    ...blankNameIds.map((venueId) => ({
      code: "VENUE_ARCHIVE_BLANK_NAME",
      message: `venue_id '${venueId}' ada pada arsip tanpa nama; snapshot legacy_venue_name tidak dapat dibentuk.`,
      field: "venues.name",
    })),
  ];

  return { nameById, sourceRowsById, conflicts, blankNameIds, issues };
}

export interface LegacyVenueResolution {
  legacyVenueName?: string;
  /** Metadata audit: ID venue sumber dipertahankan meski kolomnya tidak ada di target. */
  audit: { source_venue_id?: string; legacy_venue_name?: string };
}

/**
 * Resolusi `venue_id` job → `legacy_venue_name` memakai arsip + helper P0C-1
 * (`reconcileLegacyVenue`). Tidak pernah mengarang nama.
 */
export function resolveLegacyVenueName(input: {
  venueId?: string;
  archive: VenueArchive;
}): Reconciled<LegacyVenueResolution> {
  const hasId = input.venueId !== undefined && input.venueId.trim() !== "";
  if (!hasId) {
    return ok({ legacyVenueName: undefined, audit: {} });
  }

  const venueId = input.venueId!.trim();
  const conflict = input.archive.conflicts.find((entry) => entry.venueId === venueId);
  if (conflict) {
    return reconciliationRequired([
      {
        code: "VENUE_ARCHIVE_CONFLICT",
        message: `Job menunjuk venue '${venueId}' yang memiliki nama berbeda pada arsip (${conflict.names.join(" | ")}); perlu keputusan manual.`,
        field: "venue_id",
      },
    ]);
  }

  const base = reconcileLegacyVenue({
    venueId,
    venueName: input.archive.nameById.get(venueId),
  });
  if (base.status !== "OK" || !base.value) {
    return reconciliationRequired(base.issues);
  }
  return ok({
    legacyVenueName: base.value.legacyVenueName,
    audit: {
      source_venue_id: venueId,
      legacy_venue_name: base.value.legacyVenueName,
    },
  });
}
