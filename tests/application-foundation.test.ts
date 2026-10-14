import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/db";
import { isolatedConnection, type ApplicationConnection } from "@/db/connection";
import { getDatabaseUrl } from "@/db/env";
import { crewRoles } from "@/db/schema";
import { RepositoryNotFoundError } from "@/repositories/mysql/errors";
import { CanonicalServiceError } from "@/services/canonical";
import { createApplicationBackend } from "@/services/application";

import { TEST_DATABASE, replaceDatabaseName } from "./helpers/db";

/**
 * FONDASI KOMPOSISI APLIKASI KANONIK (P0E-1A) — HANYA `airprod_test`
 * (disiapkan `tests/setup.ts`: create → drop semua tabel → apply migration).
 *
 * Yang diverifikasi:
 * 1. Import/konstruksi komposisi TIDAK membuka koneksi (lazy per operasi).
 * 2. Koneksi default memakai ULANG pool bersama `getDb()` (tanpa pool ganda) dan
 *    `dispose()` tidak mematikan pool runtime.
 * 3. Koneksi terisolasi punya lifecycle eksplisit (lazy, dispose idempoten).
 * 4. Permukaan komposisi lengkap (repositories + services + financial) dan
 *    instance finansial bersama.
 * 5. Database KOSONG → hasil kosong yang valid (tanpa record karangan) dan
 *    error eksplisit untuk referensi yang tidak ada.
 * 6. Jalur komposisi tidak mengimpor Google Sheets / kontrak legacy dan tidak
 *    memanggil `getRepositories()`.
 *
 * `getRepositories()` (runtime aplikasi) TIDAK dipanggil oleh test ini dan tetap
 * mengembalikan `googleRepositories`; produksi tidak disentuh.
 */

afterAll(async () => {
  await closeDb();
});

/** URL database test yang diturunkan dari DATABASE_URL aktif (pasca-swap setup). */
const testUrl = replaceDatabaseName(getDatabaseUrl(), TEST_DATABASE);

function readSourceCode(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

describe("fondasi komposisi backend kanonik", () => {
  it("1. konstruksi tidak membuka koneksi; resolve terjadi saat operasi dipanggil", async () => {
    let resolutions = 0;
    const probe: ApplicationConnection = {
      kind: "isolated",
      resolve: () => {
        resolutions += 1;
        return getDb();
      },
      dispose: async () => {},
    };

    const backend = createApplicationBackend({ connection: probe });
    expect(resolutions).toBe(0); // tidak ada koneksi saat konstruksi
    expect(backend.connection).toBe(probe);

    const roles = await backend.repositories.crewRoles.getAll();
    expect(Array.isArray(roles)).toBe(true);
    expect(resolutions).toBeGreaterThan(0); // resolve per operasi
  });

  it("2. koneksi default memakai pool bersama dan dispose tidak mematikannya", async () => {
    const backend = createApplicationBackend();
    expect(backend.connection.kind).toBe("shared");
    expect(backend.resolveDatabase()).toBe(getDb()); // instance pool yang sama

    await backend.dispose();
    await backend.dispose(); // idempoten (no-op untuk shared)

    const stillAlive = await getDb().select({ id: crewRoles.id }).from(crewRoles);
    expect(Array.isArray(stillAlive)).toBe(true);
  });

  it("3. koneksi terisolasi: lazy, dipakai, lalu ditutup secara idempoten", async () => {
    // Guard: pastikan kita benar-benar menunjuk database test, bukan produksi.
    expect(new URL(testUrl).pathname.replace(/^\//, "")).toBe(TEST_DATABASE);

    const connection = isolatedConnection(testUrl);
    const db = connection.resolve();
    const rows = await db.select({ id: crewRoles.id }).from(crewRoles);
    expect(Array.isArray(rows)).toBe(true);

    await connection.dispose();
    await connection.dispose(); // idempoten
    expect(() => connection.resolve()).toThrow(/sudah ditutup/i);
  });

  it("4. permukaan komposisi lengkap: repositories + services kanonik + financial bersama", () => {
    const backend = createApplicationBackend();

    for (const method of ["listClients", "createClient", "listCrewDirectory"] as const) {
      expect(typeof backend.services.master[method]).toBe("function");
    }
    expect(typeof backend.services.jobs.getJobDetail).toBe("function");
    expect(typeof backend.services.deliveries.listByJob).toBe("function");
    expect(typeof backend.services.adminSessions.listAdmins).toBe("function");
    expect(typeof backend.financial.recordClientPayment).toBe("function");
    expect(typeof backend.financial.deriveClientPaymentStatus).toBe("function");

    // Satu instance finansial dipakai services dan `financial` (bukan duplikat).
    expect(backend.services.financial).toBe(backend.financial);

    for (const member of [
      "jobs",
      "clients",
      "vendors",
      "crew",
      "crewRoles",
      "deliveries",
      "jobCrewAssignments",
      "clientPaymentSchedules",
      "vendorPaymentSchedules",
      "cashflows",
      "admins",
      "sessions",
    ] as const) {
      expect(backend.repositories[member]).toBeTruthy();
    }
  });
});

describe("kompatibilitas database kosong (Fresh Start) & propagasi error", () => {
  it("5. database kosong → seluruh pembacaan kanonik mengembalikan hasil kosong yang valid", async () => {
    const backend = createApplicationBackend();
    const {
      clients,
      vendors,
      crew,
      crewRoles: roles,
      jobs,
      deliveries,
      jobCrewAssignments,
      clientPaymentSchedules,
      vendorPaymentSchedules,
      cashflows,
      admins,
      sessions,
    } = backend.repositories;

    const groups = await Promise.all([
      clients.getAll(),
      vendors.getAll(),
      crew.getAll(),
      roles.getAll(),
      jobs.getAll(),
      deliveries.getAll(),
      jobCrewAssignments.getAll(),
      clientPaymentSchedules.getAll(),
      vendorPaymentSchedules.getAll(),
      cashflows.getAll(),
      admins.getAll(),
      sessions.getAll(),
    ]);
    for (const rows of groups) expect(rows).toHaveLength(0);

    // List service kanonik juga kosong (bukan data karangan).
    expect(await backend.services.master.listClients()).toHaveLength(0);
    expect(await backend.services.jobs.listJobs()).toHaveLength(0);
    expect(await backend.services.deliveries.listDeliveries()).toHaveLength(0);
    expect(await backend.services.master.listCrewDirectory()).toHaveLength(0);

    // Agregat finansial kosong = nol kanonik, bukan undefined/NaN.
    const totals = await backend.repositories.cashflows.totals({});
    expect(totals).toEqual({ income: "0.00", expense: "0.00", net: "0.00" });

    const summary = await backend.financial.getJobFinancialSummary(randomUUID());
    expect(summary.income).toBe("0.00");
    expect(summary.expense).toBe("0.00");
    expect(summary.net).toBe("0.00");
    expect(summary.clientObligation).toBe("0.00");
    expect(summary.vendorObligation).toBe("0.00");
    expect(summary.crewAgreed).toBe("0.00");
  });

  it("5b. referensi yang tidak ada → hasil null / error eksplisit (tanpa fallback diam)", async () => {
    const backend = createApplicationBackend();

    expect(await backend.repositories.jobs.getByJobNumber(`MISSING-${randomUUID()}`)).toBeNull();
    expect(await backend.repositories.clients.getById(randomUUID())).toBeNull();

    await expect(
      backend.financial.deriveClientPaymentStatus(randomUUID()),
    ).rejects.toBeInstanceOf(RepositoryNotFoundError);

    await expect(
      backend.services.jobs.getJobDetail(randomUUID()),
    ).rejects.toBeInstanceOf(CanonicalServiceError);
  });
});

describe("batas komposisi (tanpa Google Sheets / kontrak legacy)", () => {
  const compositionFiles = ["src/services/application.ts", "src/db/connection.ts"];
  const forbidden = [
    "@/repositories/google",
    "@/lib/google-sheets",
    "@/lib/types",
    "@/repositories/types",
    "@/repositories/index",
  ];

  it("6. modul komposisi tidak mengimpor Google Sheets, kontrak legacy, atau memanggil getRepositories()", () => {
    for (const file of compositionFiles) {
      const code = readSourceCode(file);
      for (const token of forbidden) {
        expect(code.includes(token), `${file} tidak boleh memakai '${token}'`).toBe(false);
      }
      expect(/\bgetRepositories\b/.test(code), `${file} tidak boleh memanggil getRepositories`).toBe(
        false,
      );
    }
  });
});
