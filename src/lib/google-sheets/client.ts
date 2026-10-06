import { google, type sheets_v4 } from "googleapis";

/**
 * Google Sheets Client — infrastruktur server-side.
 *
 * SERVER-ONLY: modul ini membaca credential Service Account dari environment
 * variable server. Jangan impor dari Client Component ("use client"), jangan
 * mengekspos variabel `NEXT_PUBLIC_*`, dan jangan pernah mencetak nilai
 * credential/private key.
 *
 * Modul ini hanya bertanggung jawab atas autentikasi dan komunikasi dengan
 * Google Sheets API. Mapping domain entity dan repository TIDAK ada di sini.
 */

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  serviceAccountEmail: string;
  privateKey: string;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Konfigurasi Google Sheets tidak lengkap: ${name} belum diisi pada environment.`,
    );
  }
  return value.trim();
}

function unwrapQuotes(value: string): string {
  return value.replace(/^"([\s\S]*)"$/, "$1").replace(/^'([\s\S]*)'$/, "$1");
}

/**
 * Mengekstrak spreadsheet ID baik dari ID mentah maupun dari URL lengkap
 * spreadsheet (https://docs.google.com/spreadsheets/d/<id>/edit).
 */
export function extractSpreadsheetId(value: string): string {
  const trimmed = unwrapQuotes(value).trim();
  const match = trimmed.match(/\/d\/([\w-]+)/);
  return match ? match[1] : trimmed;
}

/** Normalisasi private key: buang pembungkus kutip dan ubah `\n` menjadi newline aktual. */
export function normalizePrivateKey(value: string): string {
  return unwrapQuotes(value).replace(/\\n/g, "\n");
}

export function getGoogleSheetsConfig(): GoogleSheetsConfig {
  const spreadsheetId = extractSpreadsheetId(readRequiredEnv("GOOGLE_SHEETS_ID"));
  const serviceAccountEmail = unwrapQuotes(readRequiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"));
  const privateKey = normalizePrivateKey(readRequiredEnv("GOOGLE_PRIVATE_KEY"));

  if (!spreadsheetId || !/^[\w-]+$/.test(spreadsheetId)) {
    throw new Error("GOOGLE_SHEETS_ID tidak valid: tidak dapat mengekstrak spreadsheet ID.");
  }
  if (!serviceAccountEmail.includes("@")) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL tidak valid: format email salah.");
  }
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("GOOGLE_PRIVATE_KEY tidak valid: marker PEM tidak ditemukan.");
  }

  return { spreadsheetId, serviceAccountEmail, privateKey };
}

export function getGoogleAuth() {
  const config = getGoogleSheetsConfig();
  return new google.auth.JWT({
    email: config.serviceAccountEmail,
    key: config.privateKey,
    scopes: SCOPES,
  });
}

export function getSheetsClient(): sheets_v4.Sheets {
  return google.sheets({ version: "v4", auth: getGoogleAuth() });
}

export function getSpreadsheetId(): string {
  return getGoogleSheetsConfig().spreadsheetId;
}
