import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/db";
import {
  cashflows,
  clientPayments,
  crewRoles,
  jobCrews as jobCrewsTable,
  jobs as jobsTable,
} from "@/db/schema";
import { mysqlRepositories } from "@/repositories/mysql";
import { RepositoryBlockedError } from "@/repositories/mysql/errors";

/**
 * Integration test repository MySQL — berjalan HANYA di `airprod_test`
 * (disiapkan oleh tests/setup.ts). Database produksi tidak disentuh.
 *
 * Cakupan: CRUD, relasi, missing-record, constraint duplikat, input invalid,
 * transaksi commit/rollback, decimal, kompatibilitas kontrak, propagasi error.
 */

let videographerRoleId = "";
let editorRoleId = "";

beforeAll(async () => {
  const db = getDb();
  videographerRoleId = randomUUID();
  editorRoleId = randomUUID();
  await db.insert(crewRoles).values({ id: videographerRoleId, name: "Videographer" });
  await db.insert(crewRoles).values({ id: editorRoleId, name: "Editor" });
});

afterAll(async () => {
  await closeDb();
});

/**
 * Drizzle membungkus error driver (nama constraint/errno) sebagai
 * DrizzleQueryError; pesan asli ada di `error.cause.message`.
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

async function makeClient() {
  return mysqlRepositories.clients.create({ name: `Client ${randomUUID().slice(0, 6)}` });
}

async function makeJob(overrides: { clientId?: string; vendorId?: string } = {}) {
  const client = overrides.vendorId ? null : await makeClient();
  return mysqlRepositories.jobs.create({
    jobNumber: `T-${randomUUID().slice(0, 8)}`,
    jobName: "Repo Test Job",
    category: "WEDDING",
    clientId: overrides.vendorId ? undefined : (overrides.clientId ?? client!.id),
    vendorId: overrides.vendorId,
    executionDate: "2026-11-01",
    status: "NOT_STARTED",
  });
}

describe("kontrak repository", () => {
  it("mysqlRepositories mengimplementasikan seluruh 11 entity kontrak", () => {
    expect(Object.keys(mysqlRepositories).sort()).toEqual(
      [
        "admins",
        "clientPayments",
        "clients",
        "crew",
        "deliveries",
        "expenses",
        "jobCrews",
        "jobs",
        "vendorPayments",
        "vendors",
        "venues",
      ].sort(),
    );
  });

  it("venues & expenses adalah BLOCKED dan melempar RepositoryBlockedError", async () => {
    await expect(mysqlRepositories.venues.getAll()).rejects.toBeInstanceOf(RepositoryBlockedError);
    await expect(mysqlRepositories.expenses.getAll()).rejects.toBeInstanceOf(RepositoryBlockedError);
    await expect(mysqlRepositories.expenses.getByJobId("x")).rejects.toThrow(/diblokir/);
  });

  it("write client_payments/vendor_payments BLOCKED (status derived)", async () => {
    await expect(
      mysqlRepositories.clientPayments.create({
        jobId: "x",
        term: "TERMIN_1",
        amount: 1,
        status: "UNPAID",
      }),
    ).rejects.toBeInstanceOf(RepositoryBlockedError);
    await expect(
      mysqlRepositories.vendorPayments.create({
        jobId: "x",
        type: "DP",
        amount: 1,
        status: "UNPAID",
      }),
    ).rejects.toBeInstanceOf(RepositoryBlockedError);
  });
});

describe("clients CRUD", () => {
  it("create → getById → getAll → update → delete", async () => {
    const created = await mysqlRepositories.clients.create({
      name: "PT Uji",
      contactPerson: "Andi",
      phone: "0812",
      email: "a@b.co",
      address: "Jl. Test",
      notes: "n",
    });
    expect(created.id).toBeTruthy();

    const found = await mysqlRepositories.clients.getById(created.id);
    expect(found?.name).toBe("PT Uji");
    expect(found?.contactPerson).toBe("Andi");
    expect(found?.email).toBe("a@b.co");

    const all = await mysqlRepositories.clients.getAll();
    expect(all.some((c) => c.id === created.id)).toBe(true);

    const updated = await mysqlRepositories.clients.update(created.id, {
      name: "PT Uji 2",
    });
    expect(updated.name).toBe("PT Uji 2");
    expect(updated.phone).toBeUndefined();

    await mysqlRepositories.clients.delete(created.id);
    expect(await mysqlRepositories.clients.getById(created.id)).toBeNull();
  });

  it("getById id tak dikenal → null; update/delete id tak dikenal → error eksplisit", async () => {
    const missing = randomUUID();
    expect(await mysqlRepositories.clients.getById(missing)).toBeNull();
    await expect(
      mysqlRepositories.clients.update(missing, { name: "x" }),
    ).rejects.toThrow(/tidak ditemukan/);
    await expect(mysqlRepositories.clients.delete(missing)).rejects.toThrow(/tidak ditemukan/);
  });
});

describe("vendors CRUD", () => {
  it("create → update → delete", async () => {
    const v = await mysqlRepositories.vendors.create({ name: "Vendor A" });
    const u = await mysqlRepositories.vendors.update(v.id, { name: "Vendor B", email: "v@b.co" });
    expect(u.name).toBe("Vendor B");
    expect(u.email).toBe("v@b.co");
    await mysqlRepositories.vendors.delete(v.id);
    expect(await mysqlRepositories.vendors.getById(v.id)).toBeNull();
  });
});

describe("crew + crew_roles", () => {
  it("create memakai role yang sudah terdaftar & mengembalikan nama role", async () => {
    const created = await mysqlRepositories.crew.create({
      name: "Budi",
      role: "Videographer",
      defaultPayment: 1500000.55,
    });
    expect(created.role).toBe("Videographer");
    expect(created.defaultPayment).toBe(1500000.55);

    const found = await mysqlRepositories.crew.getById(created.id);
    expect(found?.role).toBe("Videographer");
  });

  it("role tidak terdaftar → error eksplisit (tidak membuat role implisit)", async () => {
    await expect(
      mysqlRepositories.crew.create({ name: "X", role: "Tidak Ada", defaultPayment: 0 }),
    ).rejects.toThrow(/tidak ditemukan di tabel crew_roles/);
  });

  it("role kosong → error; defaultPayment bukan angka → error", async () => {
    await expect(
      mysqlRepositories.crew.create({ name: "X", role: "  ", defaultPayment: 0 }),
    ).rejects.toThrow(/Role crew wajib diisi/);
    await expect(
      mysqlRepositories.crew.create({ name: "X", role: "Editor", defaultPayment: Number.NaN }),
    ).rejects.toThrow(/angka valid/);
  });
});

describe("jobs", () => {
  it("create + getByJobNumber + venueId ditolak", async () => {
    const job = await makeJob();
    const looked = await mysqlRepositories.jobs.getByJobNumber(job.jobNumber);
    expect(looked?.id).toBe(job.id);
    expect(job.createdAt).toBeTruthy();
    expect(job.updatedAt).toBeTruthy();
    expect(job.venueId).toBeUndefined();

    await expect(
      mysqlRepositories.jobs.create({
        jobNumber: `V-${randomUUID().slice(0, 6)}`,
        jobName: "V",
        category: "EVENT",
        clientId: job.clientId,
        venueId: "venue-1",
        executionDate: "2026-11-02",
        status: "NOT_STARTED",
      }),
    ).rejects.toThrow(/venueId tidak dapat dipetakan/);
  });

  it("jobNumber duplikat → error driver diteruskan (UNIQUE)", async () => {
    const job = await makeJob();
    await rejectsWith(
      mysqlRepositories.jobs.create({
        jobNumber: job.jobNumber,
        jobName: "Dup",
        category: "EVENT",
        clientId: job.clientId,
        executionDate: "2026-11-02",
        status: "NOT_STARTED",
      }),
      /duplicate entry/i,
    );
  });

  it("melanggar XOR (client DAN vendor) → error driver diteruskan (CHECK)", async () => {
    const client = await makeClient();
    const vendor = await mysqlRepositories.vendors.create({ name: "V" });
    await rejectsWith(
      mysqlRepositories.jobs.create({
        jobNumber: `X-${randomUUID().slice(0, 6)}`,
        jobName: "X",
        category: "EVENT",
        clientId: client.id,
        vendorId: vendor.id,
        executionDate: "2026-11-02",
        status: "NOT_STARTED",
      }),
      /chk_jobs_client_vendor_xor/i,
    );
  });

  it("update + delete + delete id tak dikenal", async () => {
    const job = await makeJob();
    const updated = await mysqlRepositories.jobs.update(job.id, {
      jobNumber: job.jobNumber,
      jobName: "Nama Baru",
      category: job.category,
      clientId: job.clientId,
      executionDate: job.executionDate,
      status: "IN_PROGRESS",
    });
    expect(updated.jobName).toBe("Nama Baru");
    expect(updated.status).toBe("IN_PROGRESS");

    await mysqlRepositories.jobs.delete(job.id);
    expect(await mysqlRepositories.jobs.getById(job.id)).toBeNull();
    await expect(mysqlRepositories.jobs.delete(job.id)).rejects.toThrow(/tidak ditemukan/);
  });
});

describe("deliveries", () => {
  it("create + getByJobId + validasi status", async () => {
    const job = await makeJob();
    const d = await mysqlRepositories.deliveries.create({
      jobId: job.id,
      name: "Video Final",
      deliveryType: "VIDEO",
      quantity: 1,
      deadline: "2026-12-01",
      status: "NOT_STARTED",
    });
    const list = await mysqlRepositories.deliveries.getByJobId(job.id);
    expect(list.map((x) => x.id)).toContain(d.id);
    expect(await mysqlRepositories.deliveries.getById(d.id)).not.toBeNull();
  });
});

describe("job_crews", () => {
  it("role sama dengan master crew → override NULL; getByJobId mengembalikan role master", async () => {
    const job = await makeJob();
    const member = await mysqlRepositories.crew.create({
      name: `C ${randomUUID().slice(0, 6)}`,
      role: "Videographer",
      defaultPayment: 100,
    });
    const assignment = await mysqlRepositories.jobCrews.create({
      jobId: job.id,
      crewId: member.id,
      role: "Videographer",
      actualPayment: 750000,
    });
    expect(assignment.role).toBe("Videographer");
    expect(assignment.actualPayment).toBe(750000);

    const rows = await mysqlRepositories.jobCrews.getByJobId(job.id);
    expect(rows.some((r) => r.id === assignment.id)).toBe(true);

    // override disimpan NULL (mengikuti role crew)
    const raw = await getDb()
      .select({ crewRoleId: jobCrewsTable.crewRoleId })
      .from(jobCrewsTable)
      .where(eq(jobCrewsTable.id, assignment.id))
      .limit(1);
    expect(raw[0]?.crewRoleId).toBeNull();
  });

  it("role berbeda → override disimpan", async () => {
    const job = await makeJob();
    const member = await mysqlRepositories.crew.create({
      name: `C ${randomUUID().slice(0, 6)}`,
      role: "Videographer",
      defaultPayment: 100,
    });
    const assignment = await mysqlRepositories.jobCrews.create({
      jobId: job.id,
      crewId: member.id,
      role: "Editor",
      actualPayment: 200,
    });
    expect(assignment.role).toBe("Editor");
  });

  it("paymentStatus disediakan → ditolak (tidak disimpan di skema)", async () => {
    const job = await makeJob();
    const member = await mysqlRepositories.crew.create({
      name: `C ${randomUUID().slice(0, 6)}`,
      role: "Editor",
      defaultPayment: 0,
    });
    await expect(
      mysqlRepositories.jobCrews.create({
        jobId: job.id,
        crewId: member.id,
        role: "Editor",
        actualPayment: 0,
        paymentStatus: "PAID",
      }),
    ).rejects.toThrow(/paymentStatus tidak disimpan/);
  });

  it("FK job tidak ada → error driver diteruskan", async () => {
    const member = await mysqlRepositories.crew.create({
      name: `C ${randomUUID().slice(0, 6)}`,
      role: "Editor",
      defaultPayment: 0,
    });
    await rejectsWith(
      mysqlRepositories.jobCrews.create({
        jobId: randomUUID(),
        crewId: member.id,
        role: "Editor",
        actualPayment: 0,
      }),
      /foreign key constraint fails/i,
    );
  });
});

describe("payments read (status derived) + decimal", () => {
  it("client payment tanpa cashflow → UNPAID; sebagian → PARTIAL; penuh → PAID", async () => {
    const job = await makeJob();
    const paymentId = randomUUID();
    await getDb().insert(clientPayments).values({
      id: paymentId,
      jobId: job.id,
      term: "TERMIN_1",
      amount: "1000.50",
      dueDate: "2026-12-01",
    });

    const readStatus = async () => {
      const list = await mysqlRepositories.clientPayments.getByJobId(job.id);
      return list.find((p) => p.id === paymentId)?.status;
    };

    expect(await readStatus()).toBe("UNPAID");
    expect(
      (await mysqlRepositories.clientPayments.getById(paymentId))?.amount,
    ).toBe(1000.5);

    await getDb().insert(cashflows).values({
      id: randomUUID(),
      jobId: job.id,
      occurredOn: "2026-12-01",
      direction: "INCOME",
      category: "CLIENT_PAYMENT",
      amount: "400.25",
      description: "DP",
      referenceType: "client_payment",
      referenceId: paymentId,
    });
    expect(await readStatus()).toBe("PARTIAL");

    await getDb().insert(cashflows).values({
      id: randomUUID(),
      jobId: job.id,
      occurredOn: "2026-12-02",
      direction: "INCOME",
      category: "CLIENT_PAYMENT",
      amount: "600.25",
      description: "Pelunasan",
      referenceType: "client_payment",
      referenceId: paymentId,
    });
    expect(await readStatus()).toBe("PAID");
  });

  it("vendor payments getAll mengembalikan array (kosong bila belum ada)", async () => {
    expect(Array.isArray(await mysqlRepositories.vendorPayments.getAll())).toBe(true);
  });
});

describe("transaksi", () => {
  it("ROLLBACK: dua insert dalam satu transaksi tidak menyisakan baris saat error", async () => {
    const db = getDb();
    const client = await makeClient();
    const dup = `RB-${randomUUID().slice(0, 8)}`;
    const base = () => ({
      id: randomUUID(),
      jobNumber: dup,
      jobName: "RB",
      category: "EVENT" as const,
      clientId: client.id,
      executionDate: "2027-01-01",
      status: "NOT_STARTED" as const,
    });

    await rejectsWith(
      db.transaction(async (tx) => {
        await tx.insert(jobsTable).values(base());
        await tx.insert(jobsTable).values(base());
      }),
      /duplicate entry/i,
    );

    const rows = await db.select().from(jobsTable).where(eq(jobsTable.jobNumber, dup));
    expect(rows.length).toBe(0);
  });

  it("COMMIT: create job menyimpan tepat satu baris", async () => {
    const job = await makeJob();
    const rows = await getDb()
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, job.id));
    expect(rows.length).toBe(1);
  });
});
