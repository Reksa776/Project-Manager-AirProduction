import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/db";
import { admins as adminsTable, clients as clientsTable, sessions as sessionsTable } from "@/db/schema";
import type { CreateJobInput } from "@/domain/inputs";
import {
  CONTRACT_V2_METHODS,
  createCanonicalMySqlRepositories,
} from "@/repositories/mysql/canonical";
import {
  RepositoryConflictError,
  RepositoryError,
  RepositoryNotFoundError,
} from "@/repositories/mysql/errors";
import {
  CanonicalServiceError,
  createMySqlApplication,
} from "@/services/canonical";

/**
 * Integrasi backend KANONIK (Contract v2) — HANYA `airprod_test`
 * (disiapkan `tests/setup.ts`). Produksi tidak disentuh.
 *
 * Factory kanonik di-INVOKE eksplisit di sini; `getRepositories()` (runtime
 * aplikasi) tetap Google Sheets dan tidak pernah dipanggil oleh test ini.
 *
 * Cakupan: matriks Contract v2 + factory lengkap (tanpa placeholder), flow
 * master data, job, assignment, delivery, jadwal & kas lewat service finansial
 * yang disetujui, admin/session (persistence tanpa login), integritas relasi,
 * referensi tidak valid, dan batas kompatibilitas legacy/Google.
 */

const app = createMySqlApplication();
const { repositories, services, financial } = app;

afterAll(async () => {
  await closeDb();
});

function uniqueName(prefix: string): string {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}

async function makeClient(name = uniqueName("Client")) {
  return services.master.createClient({ name });
}

async function makeVendor(name = uniqueName("Vendor")) {
  return services.master.createVendor({ name });
}

async function makeRole(name = uniqueName("Role")) {
  return services.master.createCrewRole({ name, sortOrder: 1 });
}

async function makeCrew(crewRoleId: string, defaultPayment = "500000.00") {
  return services.master.createCrew({
    name: uniqueName("Crew"),
    crewRoleId,
    defaultPayment,
  });
}

function jobNumber(): string {
  return `INT-${randomUUID().slice(0, 8)}`;
}

async function makeClientJob(overrides: Partial<CreateJobInput> = {}) {
  const client = await makeClient();
  return services.jobs.createJob({
    jobNumber: jobNumber(),
    jobName: "Integration Job",
    category: "WEDDING",
    clientId: client.id,
    executionDate: "2026-11-01",
    status: "NOT_STARTED",
    ...overrides,
  });
}

async function makeVendorJob() {
  const vendor = await makeVendor();
  const job = await services.jobs.createJob({
    jobNumber: jobNumber(),
    jobName: "Vendor Job",
    category: "CORPORATE",
    vendorId: vendor.id,
    executionDate: "2026-11-05",
    status: "NOT_STARTED",
  });
  return { vendor, job };
}

/* -------------------------------------------------------------------------- */
/* 1. Matriks Contract v2 & kelengkapan factory                                */
/* -------------------------------------------------------------------------- */

describe("factory kanonik & matriks Contract v2", () => {
  it("membangun SELURUH anggota Contract v2 dengan method yang benar", () => {
    const expectedMembers = Object.keys(CONTRACT_V2_METHODS).sort();
    expect(Object.keys(repositories).sort()).toEqual(expectedMembers);

    for (const [name, methods] of Object.entries(CONTRACT_V2_METHODS)) {
      const repository = repositories[
        name as keyof typeof repositories
      ] as unknown as Record<string, unknown>;
      for (const method of methods) {
        expect(typeof repository[method], `${name}.${method} harus function`).toBe("function");
      }
    }
  });

  it("tidak ada placeholder yang melempar: semua repository dapat membaca", async () => {
    const reads = await Promise.all([
      repositories.jobs.getAll(),
      repositories.clients.getAll(),
      repositories.vendors.getAll(),
      repositories.crew.getAll(),
      repositories.crewRoles.getAll(),
      repositories.deliveries.getAll(),
      repositories.jobCrewAssignments.getAll(),
      repositories.clientPaymentSchedules.getAll(),
      repositories.vendorPaymentSchedules.getAll(),
      repositories.cashflows.getAll(),
      repositories.admins.getAll(),
      repositories.sessions.getAll(),
    ]);
    expect(reads.every((rows) => Array.isArray(rows))).toBe(true);
  });

  it("koneksi disuntikkan: factory tidak resolve koneksi saat dibuat, resolve saat dipakai", async () => {
    let resolutions = 0;
    const injected = createCanonicalMySqlRepositories({
      database: () => {
        resolutions += 1;
        return getDb();
      },
    });

    expect(resolutions).toBe(0); // tidak ada koneksi saat konstruksi
    const created = await injected.crewRoles.create({ name: uniqueName("Injected") });
    expect(resolutions).toBeGreaterThan(0);
    expect(await injected.crewRoles.getById(created.id)).not.toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* 2–5. Master data                                                            */
/* -------------------------------------------------------------------------- */

describe("flow master data (Contract v2)", () => {
  it("1. Client: create & read lengkap (companyName/clientType)", async () => {
    const client = await services.master.createClient({
      name: uniqueName("PT Klien"),
      companyName: "PT Klien Sejahtera",
      contactPerson: "Andi",
      phone: "081200000000",
      email: "andi@example.com",
      address: "Jl. Mawar 1",
      clientType: "PERUSAHAAN",
      notes: "klien lama",
    });

    const read = await services.master.getClient(client.id);
    expect(read?.name).toBe(client.name);
    expect(read?.companyName).toBe("PT Klien Sejahtera");
    expect(read?.clientType).toBe("PERUSAHAAN");
    expect(read?.createdAt).toBeTruthy();

    const listed = await services.master.listClients();
    expect(listed.some((item) => item.id === client.id)).toBe(true);
  });

  it("2. Vendor: create & read", async () => {
    const vendor = await services.master.createVendor({
      name: uniqueName("Vendor"),
      contactPerson: "Budi",
      phone: "081211112222",
    });
    const read = await services.master.getVendor(vendor.id);
    expect(read?.contactPerson).toBe("Budi");
  });

  it("3. Crew Role: create & read", async () => {
    const role = await services.master.createCrewRole({
      name: uniqueName("Videographer"),
      sortOrder: 3,
      isActive: true,
    });
    const read = await services.master.getCrewRole(role.id);
    expect(read?.sortOrder).toBe(3);
    expect(read?.isActive).toBe(true);
  });

  it("4. Crew dengan role yang sudah ada; defaultPayment tetap string desimal", async () => {
    const role = await makeRole();
    const member = await services.master.createCrew({
      name: uniqueName("Crew"),
      crewRoleId: role.id,
      defaultPayment: "1500000.55",
    });

    expect(member.crewRoleId).toBe(role.id);
    expect(member.defaultPayment).toBe("1500000.55");

    const directory = await services.master.listCrewDirectory();
    const entry = directory.find((item) => item.crew.id === member.id);
    expect(entry?.role?.name).toBe(role.name);
  });

  it("crew dengan role yang tidak ada → referensi ditolak eksplisit", async () => {
    await expect(
      services.master.createCrew({
        name: uniqueName("Crew Tanpa Role"),
        crewRoleId: randomUUID(),
        defaultPayment: "0.00",
      }),
    ).rejects.toBeInstanceOf(RepositoryNotFoundError);
  });

  it("jumlah crew kosong → error validasi eksplisit", async () => {
    const role = await makeRole();
    await expect(
      services.master.createCrew({ name: "  ", crewRoleId: role.id, defaultPayment: "0.00" }),
    ).rejects.toBeInstanceOf(RepositoryError);
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Job                                                                      */
/* -------------------------------------------------------------------------- */

describe("flow job", () => {
  it("5. Job: create & read (client XOR + legacyVenueName)", async () => {
    const job = await makeClientJob({ legacyVenueName: "Gedung Lama" });

    const read = await services.jobs.getJobById(job.id);
    expect(read?.jobNumber).toBe(job.jobNumber);
    expect(read?.legacyVenueName).toBe("Gedung Lama");
    expect(read?.createdAt).toBeTruthy();

    expect((await services.jobs.getJobByNumber(job.jobNumber))?.id).toBe(job.id);
    expect(await services.jobs.getJobByNumber(`MISSING-${randomUUID()}`)).toBeNull();
  });

  it("job vendor (tanpa client) juga valid", async () => {
    const { job, vendor } = await makeVendorJob();
    const read = await services.jobs.getJobById(job.id);
    expect(read?.vendorId).toBe(vendor.id);
    expect(read?.clientId).toBeUndefined();
  });

  it("XOR dilanggar (client DAN vendor) → error eksplisit", async () => {
    const client = await makeClient();
    const { vendor } = await makeVendorJob();
    await expect(
      services.jobs.createJob({
        jobNumber: jobNumber(),
        jobName: "XOR",
        category: "EVENT",
        clientId: client.id,
        vendorId: vendor.id,
        executionDate: "2026-11-09",
        status: "NOT_STARTED",
      }),
    ).rejects.toThrow(/clientId ATAU vendorId/i);
  });

  it("client yang tidak ada → RepositoryNotFoundError", async () => {
    await expect(
      services.jobs.createJob({
        jobNumber: jobNumber(),
        jobName: "Client Hantu",
        category: "WEDDING",
        clientId: randomUUID(),
        executionDate: "2026-11-09",
        status: "NOT_STARTED",
      }),
    ).rejects.toBeInstanceOf(RepositoryNotFoundError);
  });

  it("update & delete job", async () => {
    const job = await makeClientJob();
    const updated = await services.jobs.updateJob(job.id, {
      jobNumber: job.jobNumber,
      jobName: "Nama Baru",
      category: job.category,
      clientId: job.clientId,
      executionDate: job.executionDate,
      status: "IN_PROGRESS",
    });
    expect(updated.jobName).toBe("Nama Baru");
    expect(updated.status).toBe("IN_PROGRESS");

    await services.jobs.deleteJob(job.id);
    expect(await services.jobs.getJobById(job.id)).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* 7–8. Assignment, Delivery, jadwal                                           */
/* -------------------------------------------------------------------------- */

describe("flow assignment, delivery, dan jadwal", () => {
  it("6. Job-Crew Assignment: create & read (obligasi, bukan kas)", async () => {
    const job = await makeClientJob();
    const role = await makeRole();
    const member = await makeCrew(role.id);

    const assignment = await repositories.jobCrewAssignments.create({
      jobId: job.id,
      crewId: member.id,
      crewRoleId: null,
      agreedAmount: "750000.00",
    });
    expect(assignment.agreedAmount).toBe("750000.00");
    expect(assignment.crewRoleId).toBeNull();

    const list = await repositories.jobCrewAssignments.getByJobId(job.id);
    expect(list.map((row) => row.id)).toContain(assignment.id);

    // membuat assignment TIDAK membuat kas
    expect(await repositories.cashflows.getByJobId(job.id)).toHaveLength(0);
  });

  it("7. Delivery: create & read per job", async () => {
    const job = await makeClientJob();
    const delivery = await services.deliveries.createDelivery({
      jobId: job.id,
      name: "Video Highlight",
      deliveryType: "VIDEO",
      quantity: 2,
      deadline: "2026-12-01",
      status: "NOT_STARTED",
    });

    const list = await services.deliveries.listByJob(job.id);
    expect(list.map((row) => row.id)).toContain(delivery.id);
    expect((await services.deliveries.getDelivery(delivery.id))?.quantity).toBe(2);
  });

  it("delivery untuk job yang tidak ada → referensi ditolak eksplisit", async () => {
    await expect(
      services.deliveries.createDelivery({
        jobId: randomUUID(),
        name: "Delivery Hantu",
        deadline: "2026-12-01",
        status: "NOT_STARTED",
      }),
    ).rejects.toBeInstanceOf(RepositoryNotFoundError);
  });

  it("8. Jadwal client & vendor: obligasi tanpa kas", async () => {
    const job = await makeClientJob();
    const clientSchedule = await services.financial.createClientPaymentSchedule({
      jobId: job.id,
      term: "TERMIN_1",
      amount: "1000.00",
      dueDate: "2026-12-01",
    });
    const vendorSchedule = await services.financial.createVendorPaymentSchedule({
      jobId: job.id,
      type: "DP",
      amount: "400.00",
    });

    expect(clientSchedule.amount).toBe("1000.00");
    expect(vendorSchedule.type).toBe("DP");

    expect(await repositories.cashflows.getByJobId(job.id)).toHaveLength(0);
    expect(await services.financial.deriveClientPaymentStatus(clientSchedule.id)).toBe("UNPAID");
  });
});

/* -------------------------------------------------------------------------- */
/* 9–10. Kas melalui service finansial yang disetujui                          */
/* -------------------------------------------------------------------------- */

describe("flow finansial (service disetujui)", () => {
  it("9–10. Kas client PARTIAL → PAID, status & total diturunkan dari ledger", async () => {
    const job = await makeClientJob();
    const schedule = await services.financial.createClientPaymentSchedule({
      jobId: job.id,
      term: "TERMIN_1",
      amount: "1000.00",
    });

    const partial = await financial.recordClientPayment({
      scheduleId: schedule.id,
      amount: "400.25",
      occurredOn: "2026-12-01",
      idempotencyKey: randomUUID(),
    });
    expect(partial.status).toBe("PARTIAL");
    expect(partial.remainingAmount).toBe("599.75");

    const full = await financial.recordClientPayment({
      scheduleId: schedule.id,
      amount: "599.75",
      occurredOn: "2026-12-02",
      idempotencyKey: randomUUID(),
    });
    expect(full.status).toBe("PAID");
    expect(await services.financial.deriveClientPaymentStatus(schedule.id)).toBe("PAID");

    const totals = await repositories.cashflows.totals({ jobId: job.id });
    expect(totals.income).toBe("1000.00");
    expect(totals.expense).toBe("0.00");

    const summary = await services.financial.getJobFinancialSummary(job.id);
    expect(summary.clientObligation).toBe("1000.00");
    expect(summary.clientPaid).toBe("1000.00");
  });

  it("kas crew memakai kesepakatan vs kas aktual yang terpisah", async () => {
    const job = await makeClientJob();
    const role = await makeRole();
    const member = await makeCrew(role.id);
    const assignment = await repositories.jobCrewAssignments.create({
      jobId: job.id,
      crewId: member.id,
      crewRoleId: null,
      agreedAmount: "500.00",
    });

    await financial.recordCrewPayment({
      assignmentId: assignment.id,
      amount: "500.00",
      occurredOn: "2026-12-03",
      idempotencyKey: randomUUID(),
    });

    const settlement = await services.financial.deriveCrewSettlement(assignment.id);
    expect(settlement.agreedAmount).toBe("500.00");
    expect(settlement.paidAmount).toBe("500.00");
    expect(settlement.status).toBe("PAID");

    const history = await services.financial.readFinancialHistory({ jobId: job.id });
    expect(history).toHaveLength(1);
    expect(history[0]?.referenceType).toBe("job_crew");
  });

  it("biaya operasional tanpa job tetap dapat dicatat", async () => {
    const cashflow = await financial.recordGeneralExpense({
      category: "TRANSPORT",
      amount: "75.00",
      occurredOn: "2026-12-04",
      description: "Bensin operasional",
      idempotencyKey: randomUUID(),
    });
    expect(cashflow.jobId).toBeUndefined();
    expect(cashflow.direction).toBe("EXPENSE");
  });

  it("idempotensi database tetap berlaku lewat bootstrap kanonik", async () => {
    const job = await makeClientJob();
    const schedule = await services.financial.createClientPaymentSchedule({
      jobId: job.id,
      term: "TERMIN_1",
      amount: "500.00",
    });
    const key = randomUUID();
    const payload = {
      scheduleId: schedule.id,
      amount: "200.00",
      occurredOn: "2026-12-05",
      description: "Idempotent",
      idempotencyKey: key,
    };

    const first = await financial.recordClientPayment(payload);
    const replay = await financial.recordClientPayment(payload);
    expect(replay.cashflowId).toBe(first.cashflowId);
    expect(await repositories.cashflows.getByJobId(job.id)).toHaveLength(1);

    await expect(
      financial.recordClientPayment({ ...payload, amount: "999.00" }),
    ).rejects.toBeInstanceOf(RepositoryConflictError);
  });
});

/* -------------------------------------------------------------------------- */
/* 11. Admin & Session persistence (tanpa login)                               */
/* -------------------------------------------------------------------------- */

describe("admin & session persistence (tanpa autentikasi)", () => {
  it("11. membaca admin & sesi yang tersimpan lewat service kanonik", async () => {
    const adminId = randomUUID();
    await getDb()
      .insert(adminsTable)
      .values({
        id: adminId,
        name: "Owner Uji",
        email: `owner-${adminId.slice(0, 8)}@example.com`,
        passwordHash: "scrypt$16384$8$1$salt$hash",
      });

    const sessionId = randomUUID();
    const tokenHash = createHash("sha256").update(sessionId).digest("hex");
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString().slice(0, 23).replace("T", " ");
    await getDb()
      .insert(sessionsTable)
      .values({ id: sessionId, adminId, tokenHash, expiresAt });

    const admin = await services.adminSessions.getAdmin(adminId);
    expect(admin?.role).toBe("ADMIN");
    expect(admin?.isActive).toBe(true);
    expect((await services.adminSessions.listAdmins()).some((a) => a.id === adminId)).toBe(true);

    const session = await services.adminSessions.findSessionByTokenHash(tokenHash);
    expect(session?.adminId).toBe(adminId);
    expect(session?.tokenHash).toBe(tokenHash);
    expect(await services.adminSessions.getSession(sessionId)).not.toBeNull();
    expect(await services.adminSessions.findSessionByTokenHash("0".repeat(64))).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* 12–13. Integritas relasi & referensi tidak valid                            */
/* -------------------------------------------------------------------------- */

describe("integritas relasi & referensi tidak valid", () => {
  it("12. client yang masih dirujuk job tidak dapat dihapus (RESTRICT)", async () => {
    const job = await makeClientJob();
    let caught: unknown;
    try {
      await services.master.deleteClient(job.clientId!);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const err = caught as Error & { cause?: Error };
    expect(`${err.message}\n${err.cause?.message ?? ""}`).toMatch(/foreign key constraint fails/i);

    // data tetap utuh
    expect(await services.master.getClient(job.clientId!)).not.toBeNull();
  });

  it("assign crew dengan crew yang tidak ada → FK diteruskan apa adanya", async () => {
    const job = await makeClientJob();
    let caught: unknown;
    try {
      await repositories.jobCrewAssignments.create({
        jobId: job.id,
        crewId: randomUUID(),
        crewRoleId: null,
        agreedAmount: "100.00",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const err = caught as Error & { cause?: Error };
    expect(`${err.message}\n${err.cause?.message ?? ""}`).toMatch(/foreign key constraint fails/i);
  });

  it("13. jadwal untuk job yang tidak ada → FK diteruskan apa adanya", async () => {
    let caught: unknown;
    try {
      await services.financial.createClientPaymentSchedule({
        jobId: randomUUID(),
        term: "TERMIN_1",
        amount: "100.00",
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const err = caught as Error & { cause?: Error };
    expect(`${err.message}\n${err.cause?.message ?? ""}`).toMatch(/foreign key constraint fails/i);
  });

  it("detail job yang tidak ada → error service eksplisit", async () => {
    await expect(services.jobs.getJobDetail(randomUUID())).rejects.toBeInstanceOf(
      CanonicalServiceError,
    );
  });

  it("job detail menggabungkan obligasi, kas, assignment, dan delivery", async () => {
    const job = await makeClientJob();
    const schedule = await services.financial.createClientPaymentSchedule({
      jobId: job.id,
      term: "TERMIN_1",
      amount: "300.00",
    });
    await financial.recordClientPayment({
      scheduleId: schedule.id,
      amount: "300.00",
      occurredOn: "2026-12-06",
      idempotencyKey: randomUUID(),
    });

    const detail = await services.jobs.getJobDetail(job.id);
    expect(detail.counterparty.type).toBe("CLIENT");
    expect(detail.clientPaymentSchedules).toHaveLength(1);
    expect(detail.cashflows).toHaveLength(1);
    expect(detail.crewAssignments).toHaveLength(0);
    expect(detail.deliveries).toHaveLength(0);
  });

  it("delete client yang tidak dirujuk apa pun berhasil", async () => {
    const client = await makeClient();
    await services.master.deleteClient(client.id);
    expect(await services.master.getClient(client.id)).toBeNull();
    expect(await getDb().select().from(clientsTable).where(eq(clientsTable.id, client.id))).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* 14. Batas kompatibilitas: tanpa ketergantungan legacy/Google Sheets         */
/* -------------------------------------------------------------------------- */

describe("batas kompatibilitas", () => {
  const canonicalDirs = ["src/repositories/mysql/canonical", "src/services/canonical"];
  const forbidden = [
    "@/repositories/google",
    "@/lib/google-sheets",
    "@/lib/types",
    "@/repositories/types",
    "@/repositories/index",
    'from "@/repositories"',
  ];

  function sourceFiles(dir: string): string[] {
    return readdirSync(path.resolve(process.cwd(), dir))
      .filter((entry) => entry.endsWith(".ts"))
      .map((entry) => path.join(dir, entry));
  }

  it("14. layer kanonik tidak mengimpor kontrak legacy, domain lama, atau Google Sheets", () => {
    const files = canonicalDirs.flatMap(sourceFiles);
    expect(files.length).toBeGreaterThan(6);

    for (const file of files) {
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
      for (const token of forbidden) {
        expect(source.includes(token), `${file} tidak boleh memakai '${token}'`).toBe(false);
      }
    }
  });

  it("factory kanonik tidak bergantung pada provider repository aplikasi", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/repositories/mysql/canonical/factory.ts"),
      "utf8",
    );
    expect(source.includes("@/repositories/index")).toBe(false);
    // Komentar boleh menyebut getRepositories(); yang dilarang adalah impor/kode.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(/\bgetRepositories\b/.test(code)).toBe(false);
  });
});
