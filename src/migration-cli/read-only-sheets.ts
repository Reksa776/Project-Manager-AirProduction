import { google } from "googleapis";

import { SourceDataUnavailableError } from "@/migration";
import { getGoogleSheetsConfig } from "@/lib/google-sheets/client";
import { SHEET_TITLES, type SheetTitle } from "@/repositories/google/mapping";
import type { RawWorksheetMatrix } from "@/migration";

import type { ReadOnlySheetsGateway } from "./gateway";

/**
 * ADAPTER BACA-SAJAR Google Sheets (P0D-2A).
 *
 * Jaminan read-only:
 * - Scope OAuth yang diminta HANYA `spreadsheets.readonly` (tanpa hak tulis,
 *   meski kredensial lain lebih luas) — dibuat ulang di sini, bukan memakai
 *   scope klien runtime.
 * - Satu-satunya panggilan API adalah `spreadsheets.values.batchGet` (baca).
 *   Tidak ada `values.update`, `values.append`, `values.clear`, `values.batchUpdate`,
 *   atau `spreadsheets.batchUpdate` di modul ini.
 * - Fail closed: bila kredensial tidak lengkap → `SourceDataUnavailableError`
 *   sebelum panggilan jaringan apa pun.
 * - Pesan error disanitasi: spreadsheet ID tidak pernah dicetak.
 *
 * Modul ini adalah satu-satunya tempat di jalur migrasi yang menyentuh jaringan.
 * Perencana migrasi (`src/migration/**`) tetap murni.
 */

export const SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

/** Apakah kredensial baca-sajar lengkap (hanya memeriksa keberadaan, bukan nilai). */
export function isReadOnlySourceConfigured(): boolean {
  const values = [
    process.env.GOOGLE_SHEETS_ID,
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    process.env.GOOGLE_PRIVATE_KEY,
  ];
  return values.every((value) => typeof value === "string" && value.trim() !== "");
}

/** Menegaskan kredensial baca-sajar tersedia; melempar bila tidak (fail closed). */
export function assertReadOnlySourceAccess(): void {
  if (!isReadOnlySourceConfigured()) {
    throw new SourceDataUnavailableError(
      "BLOCKED: kredensial Google Sheets read-only tidak lengkap (GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY). Tidak ada pembacaan sumber yang dijalankan.",
    );
  }
}

/** Menyamarkan spreadsheet ID dari pesan error agar tidak pernah tercetak. */
export function sanitizeSourceError(message: string, spreadsheetId: string): string {
  if (spreadsheetId === "") return message;
  return message.split(spreadsheetId).join("<spreadsheet-id-redacted>");
}

function toCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

/** Membuat gerbang baca-sajar (live). Hanya `values.batchGet` yang dipanggil. */
export function createReadOnlySheetsGateway(): ReadOnlySheetsGateway {
  return {
    async listWorksheetMatrices(): Promise<RawWorksheetMatrix[]> {
      assertReadOnlySourceAccess();
      const config = getGoogleSheetsConfig();
      const auth = new google.auth.JWT({
        email: config.serviceAccountEmail,
        key: config.privateKey,
        scopes: [SHEETS_READONLY_SCOPE],
      });
      const client = google.sheets({ version: "v4", auth });

      try {
        const response = await client.spreadsheets.values.batchGet({
          spreadsheetId: config.spreadsheetId,
          ranges: [...SHEET_TITLES],
          majorDimension: "ROWS",
        });

        const valueRanges = response.data.valueRanges ?? [];
        return SHEET_TITLES.map((sheet, index) => {
          const valueRange = valueRanges[index];
          const rows = (valueRange?.values ?? []).map((row) => (row ?? []).map(toCell));
          return { sheet, values: rows } satisfies RawWorksheetMatrix;
        });
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Gagal membaca worksheet (read-only): ${sanitizeSourceError(raw, config.spreadsheetId)}`,
        );
      }
    },
  };
}

/** Nama worksheet yang dibaca adapter ini (audit). */
export const READ_ONLY_SHEET_TITLES: readonly SheetTitle[] = SHEET_TITLES;
