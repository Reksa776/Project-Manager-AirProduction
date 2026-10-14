import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEV_DATABASE,
  PROD_DATABASE,
  TEST_DATABASE,
  replaceDatabaseName,
  resolveTestDatabaseUrl,
} from "./helpers/db";

/**
 * Regression test P0E-DEV-1 — konfigurasi runtime development lokal.
 *
 * Bug yang ditemukan dan diperbaiki di fase ini:
 * 1. Guard database test (`resolveTestDatabaseUrl`) hanya menerima basis
 *    `database-airprod`, sehingga `npm run test` STOP begitu aplikasi lokal
 *    diarahkan ke database development `airprod_dev`. Guard kini menerima
 *    basis development DAN produksi, selalu menurunkan `airprod_test`, dan
 *    tetap menolak basis tak dikenal maupun target produksi.
 * 2. `next.config.ts` tidak mengizinkan origin dev loopback, sehingga Next 16
 *    memblokir resource dev (font `__nextjs_font/*` → 403, WebSocket HMR gagal)
 *    saat aplikasi dibuka lewat `http://127.0.0.1:<port>`; pada sebagian
 *    browser hidrasi juga tidak selesai. `allowedDevOrigins` kini memuat
 *    `localhost` dan `127.0.0.1`.
 *
 * Test ini tidak menyentuh database apa pun.
 */

const PROJECT_ROOT = process.cwd();
const ENV_PATH = path.resolve(PROJECT_ROOT, ".env");
const NEXT_CONFIG_PATH = path.resolve(PROJECT_ROOT, "next.config.ts");

/** Baca `.env` (hanya baris aktif) tanpa pernah mencetak nilainya. */
function readEnvFile(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

/** Jalankan `fn` dengan DATABASE_URL sementara, lalu pulihkan semula. */
function withDatabaseUrl<T>(url: string, fn: () => T): T {
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url;
  try {
    return fn();
  } finally {
    process.env.DATABASE_URL = saved;
  }
}

/** Bentuk ulang URL runtime (yang sudah ada) menjadi basis `db`. */
function baseUrl(db: string): string {
  const current =
    process.env.DATABASE_URL ?? `mysql://root@127.0.0.1:3306/${TEST_DATABASE}`;
  return replaceDatabaseName(current, db);
}

describe("P0E-DEV-1 — konfigurasi runtime development lokal", () => {
  it(".env mengarahkan aplikasi ke database kanonik (dev/produksi), bukan database test", () => {
    const url = readEnvFile().DATABASE_URL;
    expect(url, ".env harus memuat DATABASE_URL").toBeTruthy();
    const dbName = new URL(url).pathname.replace(/^\//, "");
    expect([DEV_DATABASE, PROD_DATABASE]).toContain(dbName);
    expect(dbName).not.toBe(TEST_DATABASE);
  });

  it("guard test menerima basis development airprod_dev dan menurunkan airprod_test", () => {
    const testUrl = withDatabaseUrl(baseUrl(DEV_DATABASE), () => resolveTestDatabaseUrl());
    expect(new URL(testUrl).pathname).toBe(`/${TEST_DATABASE}`);
    expect(new URL(testUrl).pathname).not.toBe(`/${PROD_DATABASE}`);
  });

  it("guard test tetap menerima basis produksi tetapi tidak pernah menyasar produksi", () => {
    const testUrl = withDatabaseUrl(baseUrl(PROD_DATABASE), () => resolveTestDatabaseUrl());
    expect(new URL(testUrl).pathname).toBe(`/${TEST_DATABASE}`);
  });

  it("guard test menolak basis database yang tidak dikenal", () => {
    withDatabaseUrl(baseUrl("database_lain"), () => {
      expect(() => resolveTestDatabaseUrl()).toThrow(/STOP/);
    });
  });

  it("guard test menolak DATABASE_URL yang sudah menunjuk database test", () => {
    withDatabaseUrl(baseUrl(TEST_DATABASE), () => {
      expect(() => resolveTestDatabaseUrl()).toThrow(/STOP/);
    });
  });

  it("next.config mengizinkan origin dev loopback (localhost + 127.0.0.1)", () => {
    const config = readFileSync(NEXT_CONFIG_PATH, "utf8");
    expect(config).toMatch(/allowedDevOrigins/);
    expect(config).toMatch(/localhost/);
    expect(config).toMatch(/127\.0\.0\.1/);
  });
});
