import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/db";
import { TEST_DATABASE } from "./helpers/db";
import { RepositoryConflictError } from "@/repositories/mysql/errors";
import {
  createClient,
  createCrew,
  createCrewRole,
  deleteClient,
  deleteCrew,
  deleteCrewRole,
  getClients,
  getCrewDirectory,
  getCrewRoles,
  getCurrentAdmin,
  updateClient,
} from "@/services/master-service";
import {
  createClientSchedule,
  createDelivery,
  createJob,
  createJobCrew,
  createVendorSchedule,
  deleteJob,
  getFinanceOverview,
  getJobDetail,
  getJobListItems,
  recordClientPayment,
  recordCrewPayment,
  recordExpense,
  recordVendorPayment,
  updateJob,
} from "@/services/job-service";
import { getDashboardData } from "@/services/dashboard-service";

/**
 * P0E-1B — KONVERSI KONSUMEN APLIKASI KE CONTRACT v2.
 *
 * Berjalan HANYA di `airprod_test` (disiapkan `tests/setup.ts`). Test ini
 * memanggil SERVICE APLIKASI (batas komposisi runtime), bukan repository
 * langsung, sehingga membuktikan jalur yang benar-benar dipakai halaman/action.
 *
 * Tidak ada test yang menyentuh `database-airprod`; test pertama membuktikan
 * database yang terhubung memang database test.
 */

afterAll(async () => {
  await closeDb();
});

function unique(prefix: string): string {
  return `${prefix} ${randomUUID().slice(0, 8)}`;
}

function jobNumber(): string {
  return `CNV-${randomUUID().slice(0, 8)}`;
}

async function makeClient() {
  return createClient({ name: unique("Client") });
}

async function makeRole() {
  return createCrewRole({ name: unique("Role"), sortOrder: 1 });
}

/* -------------------------------------------------------------------------- */
/* 1. Isolation + empty database                                              */
/* -------------------------------------------------------------------------- */

describe("isolasi database & perilaku database kosong", () => {
  it("koneksi runtime menunjuk database TEST (bukan produksi)", async () => {
    const result = await getDb().execute(sql`select database() as db`);
    const rows = (Array.isArray(result) ? result[0] : result) as unknown as Array<{ db: string }>;
    expect(rows[0]?.db).toBe(TEST_DATABASE);
  });

  it("migrasi 0001 terverifikasi di database TEST (job_id nullable + kolom & UNIQUE idempotensi)", async () => {
    const columnsResult = await getDb().execute(sql`
      select COLUMN_NAME as name, IS_NULLABLE as nullable
      from information_schema.COLUMNS
      where TABLE_SCHEMA = database()
        and TABLE_NAME = 'cashflows'
        and COLUMN_NAME in ('job_id', 'idempotency_key', 'idempotency_fingerprint')
    `);
    const columns = (Array.isArray(columnsResult) ? columnsResult[0] : columnsResult) as unknown as
      Array<{ name: string; nullable: string }>;
    const nullableByName = new Map(columns.map((row) => [row.name, row.nullable]));
    expect(nullableByName.get("job_id")).toBe("YES");
    expect(nullableByName.get("idempotency_key")).toBe("YES");
    expect(nullableByName.get("idempotency_fingerprint")).toBe("YES");

    const indexResult = await getDb().execute(sql`
      select INDEX_NAME as name
      from information_schema.STATISTICS
      where TABLE_SCHEMA = database()
        and TABLE_NAME = 'cashflows'
        and INDEX_NAME = 'uq_cashflows_idempotency_key'
    `);
    const indexes = (Array.isArray(indexResult) ? indexResult[0] : indexResult) as unknown as
      Array<{ name: string }>;
    expect(indexes.length).toBeGreaterThan(0);
  });

  it("database kosong → seluruh service mengembalikan hasil kosong yang valid", async () => {
    const [clients, jobs, dashboard, finance, admin] = await Promise.all([
      getClients(),
      getJobListItems(),
      getDashboardData(),
      getFinanceOverview(),
      getCurrentAdmin(),
    ]);

    expect(clients).toEqual([]);
    expect(jobs).toEqual([]);
    expect(dashboard.summary).toEqual({
      totalJobs: 0,
      notStarted: 0,
      inProgress: 0,
      completed: 0,
    });
    expect(dashboard.incomingWeddings).toEqual([]);
    expect(dashboard.incomingEditing).toEqual([]);
    expect(finance.clientSchedules).toEqual([]);
    expect(finance.vendorSchedules).toEqual([]);
    expect(finance.cashflows).toEqual([]);
    expect(finance.totals).toEqual({ income: "0.00", expense: "0.00", net: "0.00" });
    expect(admin).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Master data                                                             */
/* -------------------------------------------------------------------------- */

describe("master data kanonik", () => {
  it("client: field kanonik lengkap (companyName/kontak/email/jenis) + update + delete", async () => {
    const client = await createClient({
      name: unique("PT Klien"),
      companyName: "PT Klien Sejahtera",
      contactPerson: "Andi",
      email: "andi@example.com",
      phone: "081200000000",
      address: "Jl. Mawar 1",
      clientType: "PERUSAHAAN",
    });
    expect(client.companyName).toBe("PT Klien Sejahtera");
    expect(client.clientType).toBe("PERUSAHAAN");

    const updated = await updateClient(client.id, {
      name: client.name,
      companyName: "PT Klien Abadi",
      clientType: "AGENCY",
    });
    expect(updated.companyName).toBe("PT Klien Abadi");
    expect(updated.clientType).toBe("AGENCY");

    expect((await getClients()).some((c) => c.id === client.id)).toBe(true);
    await deleteClient(client.id);
    expect((await getClients()).some((c) => c.id === client.id)).toBe(false);
  });

  it("crew: role WAJIB merujuk crew_roles (tidak ada role teks bebas / implisit)", async () => {
    const role = await makeRole();
    const member = await createCrew({
      name: unique("Crew"),
      crewRoleId: role.id,
      defaultPayment: "1500000.55",
    });
    expect(member.crewRoleId).toBe(role.id);
    expect(member.defaultPayment).toBe("1500000.55");

    const directory = await getCrewDirectory();
    const entry = directory.find((item) => item.crew.id === member.id);
    expect(entry?.role?.name).toBe(role.name);
    expect((await getCrewRoles()).some((r) => r.id === role.id)).toBe(true);

    // Role hantu → ditolak eksplisit (tidak dibuat implisit).
    await expect(
      createCrew({ name: unique("Crew"), crewRoleId: randomUUID(), defaultPayment: "0.00" }),
    ).rejects.toThrow();

    await deleteCrew(member.id);
    await deleteCrewRole(role.id);
    expect((await getCrewRoles()).some((r) => r.id === role.id)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Jobs                                                                    */
/* -------------------------------------------------------------------------- */

describe("job kanonik", () => {
  it("client XOR vendor, job number manual unik, dan komposisi counterparty", async () => {
    const client = await makeClient();
    const number = jobNumber();
    const job = await createJob({
      jobNumber: number,
      jobName: "Job Konversi",
      category: "WEDDING",
      clientId: client.id,
      executionDate: "2026-12-01",
      status: "NOT_STARTED",
      legacyVenueName: "Gedung Lama",
    });
    expect(job.legacyVenueName).toBe("Gedung Lama");

    const item = (await getJobListItems()).find((j) => j.id === job.id);
    expect(item?.counterparty).toEqual({ type: "CLIENT", id: client.id, name: client.name });

    // Job number duplikat → pesan eksplisit (bukan error mentah).
    await expect(
      createJob({
        jobNumber: number,
        jobName: "Duplikat",
        category: "WEDDING",
        clientId: client.id,
        executionDate: "2026-12-02",
        status: "NOT_STARTED",
      }),
    ).rejects.toThrow(/sudah dipakai/i);

    // XOR dilanggar → ditolak.
    await expect(
      createJob({
        jobNumber: jobNumber(),
        jobName: "XOR",
        category: "EVENT",
        clientId: client.id,
        vendorId: randomUUID(),
        executionDate: "2026-12-03",
        status: "NOT_STARTED",
      }),
    ).rejects.toThrow();

    const updated = await updateJob(job.id, {
      jobNumber: number,
      jobName: "Job Konversi (baru)",
      category: "WEDDING",
      clientId: client.id,
      executionDate: "2026-12-01",
      status: "IN_PROGRESS",
    });
    expect(updated.jobName).toBe("Job Konversi (baru)");
    expect(updated.status).toBe("IN_PROGRESS");

    await deleteJob(job.id);
    expect(await getJobDetail(number)).toBeNull();
    await deleteClient(client.id);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Crew assignment: obligation vs cash (derived status)                    */
/* -------------------------------------------------------------------------- */

describe("assignment crew: obligasi vs kas", () => {
  it("membuat assignment tidak membuat kas; status diturunkan dari kas aktual", async () => {
    const client = await makeClient();
    const role = await makeRole();
    const member = await createCrew({
      name: unique("Crew"),
      crewRoleId: role.id,
      defaultPayment: "500.00",
    });
    const job = await createJob({
      jobNumber: jobNumber(),
      jobName: "Job Crew",
      category: "CORPORATE",
      clientId: client.id,
      executionDate: "2026-12-05",
      status: "NOT_STARTED",
    });

    const assignment = await createJobCrew({
      jobId: job.id,
      crewId: member.id,
      crewRoleId: null,
      agreedAmount: "500.00",
    });

    let detail = await getJobDetail(job.jobNumber);
    let view = detail?.crewAssignments.find((a) => a.assignment.id === assignment.id);
    expect(view?.status).toBe("UNPAID");
    expect(view?.roleName).toBe(role.name);
    expect(detail?.cashflows).toHaveLength(0);
    expect(detail?.totals.crewAgreed).toBe("500.00");

    await recordCrewPayment({
      assignmentId: assignment.id,
      amount: "200.00",
      occurredOn: "2026-12-06",
      idempotencyKey: randomUUID(),
    });
    detail = await getJobDetail(job.jobNumber);
    view = detail?.crewAssignments.find((a) => a.assignment.id === assignment.id);
    expect(view?.status).toBe("PARTIAL");
    expect(view?.paidAmount).toBe("200.00");
    expect(view?.remainingAmount).toBe("300.00");

    await recordCrewPayment({
      assignmentId: assignment.id,
      amount: "300.00",
      occurredOn: "2026-12-07",
      idempotencyKey: randomUUID(),
    });
    detail = await getJobDetail(job.jobNumber);
    view = detail?.crewAssignments.find((a) => a.assignment.id === assignment.id);
    expect(view?.status).toBe("PAID");
    // Catatan: tidak ada pembersihan di sini — FK kanonik RESTRICT mencegah
    // penghapusan data yang masih dirujuk, dan database test di-reset per file.
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Delivery                                                                */
/* -------------------------------------------------------------------------- */

describe("delivery kanonik", () => {
  it("delivery dibuat per job dan tampil di detail", async () => {
    const client = await makeClient();
    const job = await createJob({
      jobNumber: jobNumber(),
      jobName: "Job Delivery",
      category: "EVENT",
      clientId: client.id,
      executionDate: "2026-12-08",
      status: "NOT_STARTED",
    });

    const delivery = await createDelivery({
      jobId: job.id,
      name: "Video Highlight",
      deliveryType: "VIDEO",
      quantity: 2,
      deadline: "2026-12-20",
      status: "NOT_STARTED",
    });

    const detail = await getJobDetail(job.jobNumber);
    expect(detail?.deliveries.map((d) => d.id)).toContain(delivery.id);
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Finance: schedules, cash, idempotency, expenses, totals                 */
/* -------------------------------------------------------------------------- */

describe("finance kanonik: obligasi, kas, idempotensi, biaya umum", () => {
  it("status diturunkan dari kas; idempotensi DB; biaya tanpa job; total arus kas", async () => {
    const client = await makeClient();
    const job = await createJob({
      jobNumber: jobNumber(),
      jobName: "Job Finance",
      category: "WEDDING",
      clientId: client.id,
      executionDate: "2026-12-10",
      status: "NOT_STARTED",
    });

    const schedule = await createClientSchedule({
      jobId: job.id,
      term: "TERMIN_1",
      amount: "1000.00",
      dueDate: "2026-12-15",
    });
    await createVendorSchedule({ jobId: job.id, type: "DP", amount: "400.00" });

    const key = randomUUID();
    const payload = {
      scheduleId: schedule.id,
      amount: "400.25",
      occurredOn: "2026-12-11",
      idempotencyKey: key,
    };
    const first = await recordClientPayment(payload);
    expect(first.status).toBe("PARTIAL");
    expect(first.remainingAmount).toBe("599.75");

    // Replay identik → baris kas yang sama (idempoten).
    const replay = await recordClientPayment(payload);
    expect(replay.cashflowId).toBe(first.cashflowId);

    // Kunci sama, payload berbeda → konflik eksplisit.
    await expect(
      recordClientPayment({ ...payload, amount: "999.00" }),
    ).rejects.toBeInstanceOf(RepositoryConflictError);

    await recordClientPayment({
      scheduleId: schedule.id,
      amount: "599.75",
      occurredOn: "2026-12-12",
      idempotencyKey: randomUUID(),
    });

    // Biaya operasional TANPA job (cashflows.job_id nullable, requirement 0001).
    await recordExpense({
      category: "TRANSPORT",
      amount: "75.00",
      occurredOn: "2026-12-13",
      description: "Bensin operasional",
      idempotencyKey: randomUUID(),
    });

    const detail = await getJobDetail(job.jobNumber);
    const scheduleView = detail?.clientSchedules.find((s) => s.id === schedule.id);
    expect(scheduleView?.status).toBe("PAID");
    expect(scheduleView?.paidAmount).toBe("1000.00");
    expect(detail?.totals.clientPaid).toBe("1000.00");

    const overview = await getFinanceOverview();
    expect(overview.clientSchedules.some((s) => s.id === schedule.id)).toBe(true);
    expect(overview.vendorSchedules.some((s) => s.jobId === job.id)).toBe(true);

    // Biaya operasional TANPA job tampil di ledger dengan label "-".
    const expenseRow = overview.cashflows.find(
      (flow) => flow.category === "TRANSPORT" && flow.description === "Bensin operasional",
    );
    expect(expenseRow?.amount).toBe("75.00");
    expect(expenseRow?.jobLabel).toBe("-");
    expect(expenseRow?.direction).toBe("EXPENSE");

    // Total konsisten dengan isi ledger (tidak bergantung pada data test lain).
    const expenseSum = overview.cashflows
      .filter((flow) => flow.direction === "EXPENSE")
      .reduce((sum, flow) => sum + Number(flow.amount), 0);
    const incomeSum = overview.cashflows
      .filter((flow) => flow.direction === "INCOME")
      .reduce((sum, flow) => sum + Number(flow.amount), 0);
    expect(overview.totals.expense).toBe(expenseSum.toFixed(2));
    expect(overview.totals.income).toBe(incomeSum.toFixed(2));
    expect(overview.totals.net).toBe((incomeSum - expenseSum).toFixed(2));
    expect(incomeSum).toBeGreaterThanOrEqual(1000);
  });

  it("pembayaran vendor menurunkan status jadwal vendor", async () => {
    const client = await makeClient();
    const job = await createJob({
      jobNumber: jobNumber(),
      jobName: "Job Vendor Pay",
      category: "EVENT",
      clientId: client.id,
      executionDate: "2026-12-14",
      status: "NOT_STARTED",
    });
    const schedule = await createVendorSchedule({
      jobId: job.id,
      type: "PELUNASAN",
      amount: "250.00",
    });

    await recordVendorPayment({
      scheduleId: schedule.id,
      amount: "250.00",
      occurredOn: "2026-12-15",
      idempotencyKey: randomUUID(),
    });

    const detail = await getJobDetail(job.jobNumber);
    expect(detail?.vendorSchedules.find((s) => s.id === schedule.id)?.status).toBe("PAID");
  });
});

/* -------------------------------------------------------------------------- */
/* 7. Static dependency & build-safety checks                                 */
/* -------------------------------------------------------------------------- */

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.resolve(process.cwd(), dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

describe("batas dependensi & keamanan build", () => {
  const activeFiles = [...walk("src/app"), ...walk("src/services")];
  const forbidden = [
    "@/lib/google-sheets",
    "@/repositories/google",
    "@/repositories/types",
    'from "@/repositories"',
    "@/repositories/index",
    "@/lib/types",
  ];

  it("tidak ada konsumen aktif yang bergantung pada Google Sheets / kontrak legacy", () => {
    expect(activeFiles.length).toBeGreaterThan(10);
    for (const file of activeFiles) {
      const code = stripComments(readFileSync(path.resolve(process.cwd(), file), "utf8"));
      for (const token of forbidden) {
        expect(code.includes(token), `${file} tidak boleh memakai '${token}'`).toBe(false);
      }
      expect(/\bgetRepositories\b/.test(code), `${file} tidak boleh memanggil getRepositories`).toBe(
        false,
      );
    }
  });

  it("root layout bebas I/O: tidak membaca admin/database saat build", () => {
    const source = stripComments(
      readFileSync(path.resolve(process.cwd(), "src/app/layout.tsx"), "utf8"),
    );
    expect(source.includes("getCurrentAdmin")).toBe(false);
    expect(source.includes("getApplication")).toBe(false);
    expect(source.includes("@/services")).toBe(false);
    expect(source.includes("@/db")).toBe(false);
    expect(/export default async function RootLayout/.test(source)).toBe(false);
  });

  it("setiap halaman data MySQL dideklarasikan dinamis (tidak diprerender statis)", () => {
    const dataPages = [
      "src/app/dashboard/page.tsx",
      "src/app/jobs/page.tsx",
      "src/app/jobs/[jobNumber]/page.tsx",
      "src/app/clients/page.tsx",
      "src/app/vendors/page.tsx",
      "src/app/crew/page.tsx",
      "src/app/finance/page.tsx",
    ];
    for (const page of dataPages) {
      const source = readFileSync(path.resolve(process.cwd(), page), "utf8");
      expect(source.includes('export const dynamic = "force-dynamic"'), page).toBe(true);
    }
  });

  it("Venue dihapus dari aplikasi aktif (tanpa route, nav, atau field entity)", () => {
    expect(existsSync(path.resolve(process.cwd(), "src/app/venues"))).toBe(false);

    const nav = stripComments(
      readFileSync(path.resolve(process.cwd(), "src/lib/navigation.ts"), "utf8"),
    );
    expect(nav.includes('"/venues"')).toBe(false);
    expect(nav.includes("Venues")).toBe(false);

    const activeCode = activeFiles
      .map((file) => stripComments(readFileSync(path.resolve(process.cwd(), file), "utf8")))
      .join("\n");
    expect(/\bvenueId\b/.test(activeCode)).toBe(false);
    expect(/createVenue|updateVenue|deleteVenue|getVenues/.test(activeCode)).toBe(false);
  });
});
