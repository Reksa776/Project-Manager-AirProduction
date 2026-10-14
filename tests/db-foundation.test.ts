import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb, getDb, type Database } from "@/db";
import {
  cashflows,
  clients,
  crew,
  crewRoles,
  deliveries,
  jobCrews,
  jobs,
} from "@/db/schema";

/**
 * Database smoke test Phase 1 — berjalan HANYA di `airprod_test`
 * (disiapkan oleh tests/setup.ts: create → drop semua tabel → apply migration).
 *
 * Cakupan: connection, insert, relasi/FK, CHECK, UNIQUE, transaction,
 * cascade/restrict, dan updated_at otomatis.
 */

let db: Database;

beforeAll(() => {
  db = getDb();
});

afterAll(async () => {
  await closeDb();
});

async function rows<T>(query: string): Promise<T[]> {
  const res = await db.execute(sql.raw(query));
  const list = (Array.isArray(res) ? res[0] : res) as unknown as T[];
  return list ?? [];
}

async function countRows(query: string): Promise<number> {
  const list = await rows<Record<string, number | string>>(query);
  const first = Object.values(list[0] ?? {})[0];
  return Number(first ?? 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Drizzle membungkus error MySQL sebagai DrizzleQueryError; pesan MariaDB asli
 * (nama constraint / errno) berada di `error.cause.message`. Matcher ini membaca
 * pesan wrapper + cause sehingga assertion pada nama constraint tetap valid.
 */
async function rejectsWith(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught, "expected query to be rejected by the database").toBeDefined();
  const err = caught as Error & { cause?: Error };
  expect(`${err.message}\n${err.cause?.message ?? ""}`).toMatch(pattern);
}

describe("koneksi", () => {
  it("aplikasi → Drizzle → MariaDB merespons", async () => {
    const list = await rows<{ ok: number }>("SELECT 1 AS ok");
    expect(list[0]?.ok).toBe(1);
  });

  it("menyasar database test airprod_test (bukan produksi)", async () => {
    const list = await rows<{ db: string }>("SELECT DATABASE() AS db");
    expect(list[0]?.db).toBe("airprod_test");
  });

  it("setiap koneksi memakai timezone UTC (+00:00)", async () => {
    const zones = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      // MariaDB tidak menerima alias pada `SHOW`; gunakan variabel sesi eksplisit.
      const list = await rows<{ tz: string }>("SELECT @@session.time_zone AS tz");
      zones.add(list[0]?.tz ?? "");
    }
    expect([...zones]).toEqual(["+00:00"]);
  });
});

describe("insert & relasi", () => {
  it("insert master → job → assignment → cashflow dengan FK bekerja", async () => {
    const roleId = randomUUID();
    const clientId = randomUUID();
    const jobId = randomUUID();
    const crewId = randomUUID();
    const assignmentId = randomUUID();
    const cashflowId = randomUUID();

    await db.insert(crewRoles).values({ id: roleId, name: `Editor ${roleId.slice(0, 6)}` });
    await db.insert(clients).values({
      id: clientId,
      name: `Client ${clientId.slice(0, 6)}`,
      phone: "0812000000",
    });
    await db.insert(jobs).values({
      id: jobId,
      jobNumber: `TST-${randomUUID().slice(0, 8)}`,
      jobName: "Smoke Test Job",
      category: "WEDDING",
      clientId,
      executionDate: "2026-10-10",
      status: "NOT_STARTED",
    });
    await db.insert(crew).values({
      id: crewId,
      name: `Crew ${crewId.slice(0, 6)}`,
      crewRoleId: roleId,
      defaultPayment: "500000.00",
    });
    await db.insert(jobCrews).values({
      id: assignmentId,
      jobId,
      crewId,
      crewRoleId: null, // NULL → mengikuti role dari crew (Phase 14)
      agreedAmount: "750000.00",
    });
    await db.insert(cashflows).values({
      id: cashflowId,
      jobId,
      occurredOn: "2026-10-10",
      direction: "INCOME",
      category: "CLIENT_PAYMENT",
      amount: "5000000.00",
      description: "Termin 1",
    });

    const jobRows = await rows<{ client_id: string; vendor_id: string | null }>(
      `SELECT client_id, vendor_id FROM jobs WHERE id = '${jobId}'`,
    );
    expect(jobRows[0]?.client_id).toBe(clientId);
    expect(jobRows[0]?.vendor_id).toBeNull();

    const cfRows = await rows<{ amount: string; source: string }>(
      `SELECT amount, source FROM cashflows WHERE id = '${cashflowId}'`,
    );
    expect(Number(cfRows[0]?.amount)).toBe(5000000);
    expect(cfRows[0]?.source).toBe("MANUAL"); // default value

    const assignmentRows = await rows<{ crew_role_id: string | null }>(
      `SELECT crew_role_id FROM job_crews WHERE id = '${assignmentId}'`,
    );
    expect(assignmentRows[0]?.crew_role_id).toBeNull();
  });

  it("FK menolak child yang menunjuk parent tidak ada", async () => {
    await rejectsWith(
      db.insert(jobCrews).values({
        id: randomUUID(),
        jobId: randomUUID(),
        crewId: randomUUID(),
        agreedAmount: "0.00",
      }),
      /foreign key constraint fails/i,
    );
  });
});

describe("CHECK constraints", () => {
  const baseJob = () => ({
    id: randomUUID(),
    jobNumber: `CHK-${randomUUID().slice(0, 8)}`,
    jobName: "Check Job",
    category: "EVENT" as const,
    executionDate: "2026-11-01",
    status: "NOT_STARTED" as const,
  });

  it("menolak jobs tanpa client DAN tanpa vendor (XOR kedua arah salah)", async () => {
    await rejectsWith(
      db.insert(jobs).values({ ...baseJob(), clientId: null, vendorId: null }),
      /chk_jobs_client_vendor_xor/i,
    );
  });

  it("menolak jobs dengan client DAN vendor sekaligus", async () => {
    const clientId = randomUUID();
    const vendorId = randomUUID();
    await db.insert(clients).values({ id: clientId, name: `C ${clientId.slice(0, 6)}` });
    const { vendors } = await import("@/db/schema");
    await db.insert(vendors).values({ id: vendorId, name: `V ${vendorId.slice(0, 6)}` });
    await rejectsWith(
      db.insert(jobs).values({ ...baseJob(), clientId, vendorId }),
      /chk_jobs_client_vendor_xor/i,
    );
  });

  it("menolak jobs dengan kategori di luar allow-list", async () => {
    const clientId = randomUUID();
    await db.insert(clients).values({ id: clientId, name: `C ${clientId.slice(0, 6)}` });
    await rejectsWith(
      db.insert(jobs).values({
        ...baseJob(),
        category: "MUSIK" as unknown as "EVENT",
        clientId,
      }),
      /chk_jobs_category/i,
    );
  });

  it("menolak cashflow amount <= 0", async () => {
    const clientId = randomUUID();
    const jobId = randomUUID();
    await db.insert(clients).values({ id: clientId, name: `C ${clientId.slice(0, 6)}` });
    await db.insert(jobs).values({ ...baseJob(), id: jobId, clientId });

    await rejectsWith(
      db.insert(cashflows).values({
        id: randomUUID(),
        jobId,
        occurredOn: "2026-11-01",
        direction: "EXPENSE",
        category: "OTHER",
        amount: "0.00",
        description: "nol",
      }),
      /chk_cashflows_amount_positive/i,
    );

    await rejectsWith(
      db.insert(cashflows).values({
        id: randomUUID(),
        jobId,
        occurredOn: "2026-11-01",
        direction: "EXPENSE",
        category: "OTHER",
        amount: "-1000.00",
        description: "negatif",
      }),
      /chk_cashflows_amount_positive/i,
    );
  });

  it("menolak pasangan direction/category yang melanggar invariant", async () => {
    const clientId = randomUUID();
    const jobId = randomUUID();
    await db.insert(clients).values({ id: clientId, name: `C ${clientId.slice(0, 6)}` });
    await db.insert(jobs).values({ ...baseJob(), id: jobId, clientId });

    // INCOME wajib CLIENT_PAYMENT
    await rejectsWith(
      db.insert(cashflows).values({
        id: randomUUID(),
        jobId,
        occurredOn: "2026-11-01",
        direction: "INCOME",
        category: "CREW_PAYMENT",
        amount: "1000.00",
        description: "ganda arah",
      }),
      /chk_cashflows_direction_category/i,
    );

    // EXPENSE wajib salah satu kategori biaya
    await rejectsWith(
      db.insert(cashflows).values({
        id: randomUUID(),
        jobId,
        occurredOn: "2026-11-01",
        direction: "EXPENSE",
        category: "CLIENT_PAYMENT",
        amount: "1000.00",
        description: "ganda arah 2",
      }),
      /chk_cashflows_direction_category/i,
    );
  });

  it("menolak reference_type terisi tanpa reference_id (dan sebaliknya)", async () => {
    const clientId = randomUUID();
    const jobId = randomUUID();
    await db.insert(clients).values({ id: clientId, name: `C ${clientId.slice(0, 6)}` });
    await db.insert(jobs).values({ ...baseJob(), id: jobId, clientId });

    await rejectsWith(
      db.insert(cashflows).values({
        id: randomUUID(),
        jobId,
        occurredOn: "2026-11-01",
        direction: "EXPENSE",
        category: "CREW_PAYMENT",
        amount: "1000.00",
        description: "referensi setengah",
        referenceType: "job_crew",
        referenceId: null,
      }),
      /chk_cashflows_reference/i,
    );
  });

  it("menolak source di luar MANUAL/MIGRATION", async () => {
    const clientId = randomUUID();
    const jobId = randomUUID();
    await db.insert(clients).values({ id: clientId, name: `C ${clientId.slice(0, 6)}` });
    await db.insert(jobs).values({ ...baseJob(), id: jobId, clientId });

    await rejectsWith(
      db.insert(cashflows).values({
        id: randomUUID(),
        jobId,
        occurredOn: "2026-11-01",
        direction: "EXPENSE",
        category: "OTHER",
        amount: "1000.00",
        description: "sumber asing",
        source: "LEGACY" as unknown as "MANUAL",
      }),
      /chk_cashflows_source/i,
    );
  });

  it("menolak delivery dengan quantity negatif", async () => {
    const clientId = randomUUID();
    const jobId = randomUUID();
    await db.insert(clients).values({ id: clientId, name: `C ${clientId.slice(0, 6)}` });
    await db.insert(jobs).values({ ...baseJob(), id: jobId, clientId });

    await rejectsWith(
      db.insert(deliveries).values({
        id: randomUUID(),
        jobId,
        name: "Video Final",
        deadline: "2026-11-05",
        status: "NOT_STARTED",
        quantity: -2,
      }),
      /chk_deliveries_quantity/i,
    );
  });
});

describe("UNIQUE job_number", () => {
  it("menolak duplikat job_number", async () => {
    const clientId = randomUUID();
    await db.insert(clients).values({ id: clientId, name: `C ${clientId.slice(0, 6)}` });
    const jobNumber = `UNQ-${randomUUID().slice(0, 8)}`;

    await db.insert(jobs).values({
      id: randomUUID(),
      jobNumber,
      jobName: "Pertama",
      category: "CORPORATE",
      clientId,
      executionDate: "2026-12-01",
      status: "NOT_STARTED",
    });

    await rejectsWith(
      db.insert(jobs).values({
        id: randomUUID(),
        jobNumber,
        jobName: "Kedua",
        category: "CORPORATE",
        clientId,
        executionDate: "2026-12-02",
        status: "NOT_STARTED",
      }),
      /duplicate entry/i,
    );
  });
});

describe("FK RESTRICT & CASCADE", () => {
  const seedJob = async (prefix: string) => {
    const clientId = randomUUID();
    const jobId = randomUUID();
    await db.insert(clients).values({ id: clientId, name: `${prefix} ${clientId.slice(0, 6)}` });
    await db.insert(jobs).values({
      id: jobId,
      jobNumber: `${prefix}-${randomUUID().slice(0, 8)}`,
      jobName: "Delete Test",
      category: "OTHER",
      clientId,
      executionDate: "2026-12-05",
      status: "NOT_STARTED",
    });
    return { clientId, jobId };
  };

  it("RESTRICT: client yang dipakai job tidak bisa dihapus", async () => {
    const { clientId } = await seedJob("RST-C");
    await rejectsWith(
      db.delete(clients).where(sql`id = ${clientId}`),
      /foreign key constraint fails/i,
    );
  });

  it("RESTRICT: job dengan cashflow tidak bisa dihapus", async () => {
    const { jobId } = await seedJob("RST-J");
    await db.insert(cashflows).values({
      id: randomUUID(),
      jobId,
      occurredOn: "2026-12-05",
      direction: "INCOME",
      category: "CLIENT_PAYMENT",
      amount: "100000.00",
      description: "DP",
    });

    await rejectsWith(
      db.delete(jobs).where(sql`id = ${jobId}`),
      /foreign key constraint fails/i,
    );
  });

  it("RESTRICT: crew yang dipakai assignment tidak bisa dihapus", async () => {
    const { jobId } = await seedJob("RST-R");
    const roleId = randomUUID();
    const crewId = randomUUID();
    await db.insert(crewRoles).values({ id: roleId, name: `Role ${roleId.slice(0, 6)}` });
    await db.insert(crew).values({
      id: crewId,
      name: `Crew ${crewId.slice(0, 6)}`,
      crewRoleId: roleId,
      defaultPayment: "0.00",
    });
    await db.insert(jobCrews).values({
      id: randomUUID(),
      jobId,
      crewId,
      agreedAmount: "50000.00",
    });

    await rejectsWith(
      db.delete(crew).where(sql`id = ${crewId}`),
      /foreign key constraint fails/i,
    );
  });

  it("CASCADE: menghapus job ikut menghapus child non-finansial", async () => {
    const { jobId } = await seedJob("CSC-J");

    const roleId = randomUUID();
    const crewId = randomUUID();
    await db.insert(crewRoles).values({ id: roleId, name: `Role ${roleId.slice(0, 6)}` });
    await db.insert(crew).values({
      id: crewId,
      name: `Crew ${crewId.slice(0, 6)}`,
      crewRoleId: roleId,
      defaultPayment: "0.00",
    });

    await db.insert(jobCrews).values({
      id: randomUUID(),
      jobId,
      crewId,
      agreedAmount: "100000.00",
    });
    await db.insert(deliveries).values({
      id: randomUUID(),
      jobId,
      name: "Album",
      deadline: "2026-12-10",
      status: "NOT_STARTED",
    });

    const before = await countRows(
      `SELECT COUNT(*) AS c FROM job_crews WHERE job_id = '${jobId}'`,
    );
    expect(before).toBe(1);

    await db.delete(jobs).where(sql`id = ${jobId}`);

    const afterJob = await countRows(`SELECT COUNT(*) AS c FROM jobs WHERE id = '${jobId}'`);
    const afterCrew = await countRows(
      `SELECT COUNT(*) AS c FROM job_crews WHERE job_id = '${jobId}'`,
    );
    const afterDelivery = await countRows(
      `SELECT COUNT(*) AS c FROM deliveries WHERE job_id = '${jobId}'`,
    );
    expect(afterJob).toBe(0);
    expect(afterCrew).toBe(0);
    expect(afterDelivery).toBe(0);
  });
});

describe("transaksi", () => {
  it("ROLLBACK menghapus seluruh insert ketika terjadi error", async () => {
    const clientId = randomUUID();
    await db.insert(clients).values({ id: clientId, name: `TXN ${clientId.slice(0, 6)}` });

    const jobA = `TXN-A-${randomUUID().slice(0, 8)}`;
    const jobB = `TXN-B-${randomUUID().slice(0, 8)}`;

    const base = (jobNumber: string, jobName: string) => ({
      id: randomUUID(),
      jobNumber,
      jobName,
      category: "EVENT" as const,
      clientId,
      executionDate: "2027-01-01",
      status: "NOT_STARTED" as const,
    });

    await rejectsWith(
      db.transaction(async (tx) => {
        await tx.insert(jobs).values(base(jobA, "Job A"));
        await tx.insert(jobs).values(base(jobB, "Job B"));
        // Error dipaksa: langgar CHECK XOR
        await tx.insert(jobs).values({
          ...base(`TXN-C-${randomUUID().slice(0, 8)}`, "Job C"),
          clientId: null,
          vendorId: null,
        });
      }),
      /chk_jobs_client_vendor_xor/i,
    );

    const countA = await countRows(`SELECT COUNT(*) AS c FROM jobs WHERE job_number = '${jobA}'`);
    const countB = await countRows(`SELECT COUNT(*) AS c FROM jobs WHERE job_number = '${jobB}'`);
    expect(countA).toBe(0);
    expect(countB).toBe(0);
  });

  it("COMMIT menyimpan seluruh insert ketika tidak ada error", async () => {
    const clientId = randomUUID();
    await db.insert(clients).values({ id: clientId, name: `OK ${clientId.slice(0, 6)}` });
    const jobNumber = `TXN-OK-${randomUUID().slice(0, 8)}`;

    await db.transaction(async (tx) => {
      await tx.insert(jobs).values({
        id: randomUUID(),
        jobNumber,
        jobName: "Committed",
        category: "EVENT",
        clientId,
        executionDate: "2027-02-01",
        status: "NOT_STARTED",
      });
    });

    const count = await countRows(
      `SELECT COUNT(*) AS c FROM jobs WHERE job_number = '${jobNumber}'`,
    );
    expect(count).toBe(1);
  });
});

describe("updated_at otomatis", () => {
  it("berubah ketika record di-update", async () => {
    const id = randomUUID();
    await db.insert(crewRoles).values({ id, name: `Role ${id.slice(0, 6)}` });

    const [before] = await rows<{ created_at: string; updated_at: string }>(
      `SELECT created_at, updated_at FROM crew_roles WHERE id = '${id}'`,
    );
    expect(before?.created_at).toBeTruthy();
    expect(before?.updated_at).toBe(before?.created_at);

    await sleep(1100); // aman walau presisi ON UPDATE turun ke detik

    await db
      .update(crewRoles)
      .set({ name: `Role Diubah ${id.slice(0, 6)}` })
      .where(sql`id = ${id}`);

    const [after] = await rows<{ updated_at: string }>(
      `SELECT updated_at FROM crew_roles WHERE id = '${id}'`,
    );
    expect(after?.updated_at > before!.updated_at).toBe(true);
  });
});

describe("job_sequences", () => {
  it("menerima insert per tahun dan menolak tahun ganda", async () => {
    const { jobSequences } = await import("@/db/schema");
    await db.insert(jobSequences).values({ year: 2027, nextSeq: 1 });
    await rejectsWith(
      db.insert(jobSequences).values({ year: 2027, nextSeq: 2 }),
      /duplicate entry/i,
    );
  });
});
