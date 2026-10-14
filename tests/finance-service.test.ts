import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { closeDb, getDb } from "@/db";
import {
  cashflows as cashflowsTable,
  clientPayments as clientPaymentsTable,
  clients,
  crew,
  crewRoles,
  jobCrews as jobCrewsTable,
  jobs as jobsTable,
} from "@/db/schema";
import { legacyExpenseToCreateCashflowInput } from "@/domain/legacy-compat";
import { reconcileStoredPaymentStatus } from "@/domain/reconciliation";
import {
  mysqlCashflows,
  mysqlClientPaymentSchedules,
  sumPaidForReference,
} from "@/repositories/mysql/finance";
import { insertCashflow } from "@/repositories/mysql/finance/cashflows";
import {
  RepositoryConflictError,
  RepositoryInUseError,
  RepositoryNotFoundError,
} from "@/repositories/mysql/errors";
import {
  financeService,
  financialOperations,
} from "@/services/finance-service";

/**
 * Integration test finansial — HANYA `airprod_test` (disiapkan tests/setup.ts).
 * Produksi tidak disentuh. Menutupi: kas, jadwal, crew, biaya operasional tanpa
 * Job, presisi desimal, idempotensi (replay + konflik + konkuren), rollback.
 */

beforeAll(async () => {
  // pastikan tabel ada (migration sudah dijalankan oleh test setup)
  await getDb().select().from(jobsTable).limit(1);
});

afterAll(async () => {
  await closeDb();
});

async function makeJob(): Promise<{ jobId: string; clientId: string }> {
  const db = getDb();
  const clientId = randomUUID();
  await db.insert(clients).values({ id: clientId, name: `Client ${clientId.slice(0, 6)}` });
  const jobId = randomUUID();
  await db.insert(jobsTable).values({
    id: jobId,
    jobNumber: `FIN-${randomUUID().slice(0, 8)}`,
    jobName: "Finance Test Job",
    category: "WEDDING",
    clientId,
    executionDate: "2026-11-01",
    status: "NOT_STARTED",
  });
  return { jobId, clientId };
}

async function makeCrewAssignment(agreed: string): Promise<{ jobId: string; assignmentId: string }> {
  const db = getDb();
  const { jobId } = await makeJob();
  const roleId = randomUUID();
  await db.insert(crewRoles).values({ id: roleId, name: `Role ${roleId.slice(0, 8)}` });
  const crewId = randomUUID();
  await db.insert(crew).values({
    id: crewId,
    name: `Crew ${crewId.slice(0, 6)}`,
    crewRoleId: roleId,
    defaultPayment: "0.00",
  });
  const assignmentId = randomUUID();
  await db.insert(jobCrewsTable).values({
    id: assignmentId,
    jobId,
    crewId,
    crewRoleId: null,
    agreedAmount: agreed,
  });
  return { jobId, assignmentId };
}

/* -------------------------------------------------------------------------- */

describe("cashflow repository", () => {
  it("membuat kas, membaca per job, dan menghitung total desimal dengan aman", async () => {
    const { jobId } = await makeJob();

    await mysqlCashflows.create({
      jobId,
      occurredOn: "2026-11-02",
      direction: "INCOME",
      category: "CLIENT_PAYMENT",
      amount: "100.50",
      description: "DP",
    });
    await mysqlCashflows.create({
      jobId,
      occurredOn: "2026-11-03",
      direction: "EXPENSE",
      category: "TRANSPORT",
      amount: "25.25",
      description: "Bensin",
    });

    const list = await mysqlCashflows.getByJobId(jobId);
    expect(list).toHaveLength(2);

    const totals = await mysqlCashflows.totals({ jobId });
    expect(totals.income).toBe("100.50");
    expect(totals.expense).toBe("25.25");
    expect(totals.net).toBe("75.25");
  });

  it("presisi desimal penuh (nilai besar) tanpa kehilangan digit", async () => {
    const { jobId } = await makeJob();
    const created = await mysqlCashflows.create({
      jobId,
      occurredOn: "2026-11-04",
      direction: "INCOME",
      category: "CLIENT_PAYMENT",
      amount: "9999999999999.99",
      description: "Nilai besar",
    });
    expect(created.amount).toBe("9999999999999.99");
    const reread = await mysqlCashflows.getById(created.id);
    expect(reread?.amount).toBe("9999999999999.99");
  });

  it("menolak arah/kategori/amount tidak valid lewat invariant domain", async () => {
    const { jobId } = await makeJob();
    await expect(
      mysqlCashflows.create({
        jobId,
        occurredOn: "2026-11-05",
        direction: "INCOME",
        category: "OTHER",
        amount: "10.00",
        description: "salah kategori",
      }),
    ).rejects.toThrow(/tidak valid/i);
  });
});

describe("payment schedules (obligations)", () => {
  it("membuat jadwal client TANPA membuat kas; status derivatif UNPAID", async () => {
    const { jobId } = await makeJob();
    const schedule = await financeService.createClientPaymentSchedule({
      jobId,
      term: "TERMIN_1",
      amount: "1000.00",
      dueDate: "2026-12-01",
    });

    expect(schedule.amount).toBe("1000.00");
    const rows = await getDb()
      .select({ id: cashflowsTable.id })
      .from(cashflowsTable)
      .where(eq(cashflowsTable.jobId, jobId));
    expect(rows).toHaveLength(0);
    expect(await financeService.deriveClientPaymentStatus(schedule.id)).toBe("UNPAID");
  });

  it("membuat jadwal vendor (DP) sebagai obligasi", async () => {
    const { jobId } = await makeJob();
    const schedule = await financeService.createVendorPaymentSchedule({
      jobId,
      type: "DP",
      amount: "500.00",
      dueDate: "2026-12-05",
    });
    expect(schedule.type).toBe("DP");
    expect(schedule.amount).toBe("500.00");
  });

  it("menolak nominal jadwal <= 0 / tidak valid", async () => {
    const { jobId } = await makeJob();
    await expect(
      financeService.createClientPaymentSchedule({ jobId, term: "TERMIN_1", amount: "0.00" }),
    ).rejects.toThrow(/lebih besar dari 0/);
    await expect(
      financeService.createClientPaymentSchedule({ jobId, term: "TERMIN_1", amount: "abc" }),
    ).rejects.toThrow(/bukan angka uang/);
  });

  it("tidak dapat menghapus jadwal yang sudah punya kas (mencegah orphan)", async () => {
    const { jobId } = await makeJob();
    const schedule = await financeService.createClientPaymentSchedule({
      jobId,
      term: "TERMIN_1",
      amount: "100.00",
    });
    await financialOperations.recordClientPayment({
      scheduleId: schedule.id,
      amount: "40.00",
      occurredOn: "2026-12-10",
      idempotencyKey: randomUUID(),
    });
    await expect(
      mysqlClientPaymentSchedules.delete(schedule.id),
    ).rejects.toBeInstanceOf(RepositoryInUseError);
  });
});

describe("recording payments", () => {
  it("client: PARTIAL lalu PAID; paid_date diisi saat lunas", async () => {
    const { jobId } = await makeJob();
    const schedule = await financeService.createClientPaymentSchedule({
      jobId,
      term: "TERMIN_1",
      amount: "1000.00",
    });

    const partial = await financialOperations.recordClientPayment({
      scheduleId: schedule.id,
      amount: "400.25",
      occurredOn: "2026-12-01",
      idempotencyKey: randomUUID(),
    });
    expect(partial.status).toBe("PARTIAL");
    expect(partial.paidAmount).toBe("400.25");
    expect(partial.remainingAmount).toBe("599.75");

    const full = await financialOperations.recordClientPayment({
      scheduleId: schedule.id,
      amount: "599.75",
      occurredOn: "2026-12-02",
      idempotencyKey: randomUUID(),
    });
    expect(full.status).toBe("PAID");
    expect(full.remainingAmount).toBe("0.00");

    const row = await getDb()
      .select({ paidDate: clientPaymentsTable.paidDate })
      .from(clientPaymentsTable)
      .where(eq(clientPaymentsTable.id, schedule.id))
      .limit(1);
    expect(row[0]?.paidDate).toBe("2026-12-02");
  });

  it("vendor: pembayaran EXPENSE memakai kas EXPENSE/VENDOR_PAYMENT", async () => {
    const { jobId } = await makeJob();
    const schedule = await financeService.createVendorPaymentSchedule({
      jobId,
      type: "PELUNASAN",
      amount: "300.00",
    });
    const result = await financialOperations.recordVendorPayment({
      scheduleId: schedule.id,
      amount: "300.00",
      occurredOn: "2026-12-06",
      idempotencyKey: randomUUID(),
    });
    expect(result.status).toBe("PAID");
    const cf = await mysqlCashflows.getById(result.cashflowId);
    expect(cf?.direction).toBe("EXPENSE");
    expect(cf?.category).toBe("VENDOR_PAYMENT");
  });

  it("crew: agreed vs paid terpisah; PARTIAL lalu PAID", async () => {
    const { assignmentId } = await makeCrewAssignment("750000.00");

    const first = await financialOperations.recordCrewPayment({
      assignmentId,
      amount: "250000.00",
      occurredOn: "2026-12-08",
      idempotencyKey: randomUUID(),
    });
    expect(first.status).toBe("PARTIAL");

    let settlement = await financeService.deriveCrewSettlement(assignmentId);
    expect(settlement.agreedAmount).toBe("750000.00");
    expect(settlement.paidAmount).toBe("250000.00");
    expect(settlement.remainingAmount).toBe("500000.00");

    await financialOperations.recordCrewPayment({
      assignmentId,
      amount: "500000.00",
      occurredOn: "2026-12-09",
      idempotencyKey: randomUUID(),
    });
    settlement = await financeService.deriveCrewSettlement(assignmentId);
    expect(settlement.status).toBe("PAID");
    expect(settlement.remainingAmount).toBe("0.00");
  });

  it("overpayment: status PAID, remaining 0, kelebihan terdeteksi", async () => {
    const { assignmentId } = await makeCrewAssignment("100.00");
    await financialOperations.recordCrewPayment({
      assignmentId,
      amount: "150.00",
      occurredOn: "2026-12-10",
      idempotencyKey: randomUUID(),
    });
    const settlement = await financeService.deriveCrewSettlement(assignmentId);
    expect(settlement.status).toBe("PAID");
    expect(settlement.remainingAmount).toBe("0.00");
    expect(settlement.overpaid).toBe(true);
    expect(settlement.overpaidAmount).toBe("50.00");
  });

  it("referensi tidak ada → error eksplisit", async () => {
    await expect(
      financialOperations.recordClientPayment({
        scheduleId: randomUUID(),
        amount: "10.00",
        occurredOn: "2026-12-01",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toBeInstanceOf(RepositoryNotFoundError);
  });

  it("menolak nominal/ tanggal tidak valid", async () => {
    const { jobId } = await makeJob();
    const schedule = await financeService.createClientPaymentSchedule({
      jobId,
      term: "TERMIN_1",
      amount: "100.00",
    });
    await expect(
      financialOperations.recordClientPayment({
        scheduleId: schedule.id,
        amount: "-5.00",
        occurredOn: "2026-12-01",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow(/lebih besar dari 0/);
    await expect(
      financialOperations.recordClientPayment({
        scheduleId: schedule.id,
        amount: "10.00",
        occurredOn: "01-12-2026",
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow(/YYYY-MM-DD/);
  });
});

describe("general operational expense (tanpa Job)", () => {
  it("mencatat biaya tanpa jobId; baris memakai job_id NULL", async () => {
    const key = randomUUID();
    const cashflow = await financialOperations.recordGeneralExpense({
      category: "OTHER",
      amount: "75.50",
      occurredOn: "2026-12-11",
      description: "Biaya operasional kantor",
      idempotencyKey: key,
    });
    expect(cashflow.jobId).toBeUndefined();
    expect(cashflow.direction).toBe("EXPENSE");

    const raw = await getDb()
      .select({ jobId: cashflowsTable.jobId })
      .from(cashflowsTable)
      .where(eq(cashflowsTable.id, cashflow.id))
      .limit(1);
    expect(raw[0]?.jobId).toBeNull();
  });
});

describe("idempotency (database-backed)", () => {
  it("request identik dengan kunci sama → replay, hanya satu baris kas", async () => {
    const { jobId } = await makeJob();
    const schedule = await financeService.createClientPaymentSchedule({
      jobId,
      term: "TERMIN_1",
      amount: "500.00",
    });
    const key = randomUUID();
    const payload = {
      scheduleId: schedule.id,
      amount: "200.00",
      occurredOn: "2026-12-12",
      description: "Termin 1",
      idempotencyKey: key,
    };
    const first = await financialOperations.recordClientPayment(payload);
    const second = await financialOperations.recordClientPayment(payload);
    expect(second.cashflowId).toBe(first.cashflowId);

    const rows = await getDb()
      .select({ id: cashflowsTable.id })
      .from(cashflowsTable)
      .where(eq(cashflowsTable.referenceId, schedule.id));
    expect(rows).toHaveLength(1);
  });

  it("kunci sama + payload berbeda → RepositoryConflictError (gagal eksplisit)", async () => {
    const { jobId } = await makeJob();
    const schedule = await financeService.createClientPaymentSchedule({
      jobId,
      term: "TERMIN_1",
      amount: "500.00",
    });
    const key = randomUUID();
    await financialOperations.recordClientPayment({
      scheduleId: schedule.id,
      amount: "200.00",
      occurredOn: "2026-12-12",
      idempotencyKey: key,
    });
    await expect(
      financialOperations.recordClientPayment({
        scheduleId: schedule.id,
        amount: "999.00",
        occurredOn: "2026-12-12",
        idempotencyKey: key,
      }),
    ).rejects.toBeInstanceOf(RepositoryConflictError);
  });

  it("request konkuren identik → tepat satu baris kas", async () => {
    const { jobId } = await makeJob();
    const schedule = await financeService.createClientPaymentSchedule({
      jobId,
      term: "TERMIN_1",
      amount: "500.00",
    });
    const key = randomUUID();
    const payload = {
      scheduleId: schedule.id,
      amount: "100.00",
      occurredOn: "2026-12-13",
      description: "Konkuren",
      idempotencyKey: key,
    };

    const results = await Promise.all(
      Array.from({ length: 6 }, () => financialOperations.recordClientPayment(payload)),
    );
    const ids = new Set(results.map((r) => r.cashflowId));
    expect(ids.size).toBe(1);

    const rows = await getDb()
      .select({ id: cashflowsTable.id })
      .from(cashflowsTable)
      .where(eq(cashflowsTable.referenceId, schedule.id));
    expect(rows).toHaveLength(1);
  });

  it("idempotencyKey kosong ditolak di batas service", async () => {
    const { jobId } = await makeJob();
    const schedule = await financeService.createClientPaymentSchedule({
      jobId,
      term: "TERMIN_1",
      amount: "10.00",
    });
    await expect(
      financialOperations.recordClientPayment({
        scheduleId: schedule.id,
        amount: "5.00",
        occurredOn: "2026-12-01",
        idempotencyKey: "  ",
      }),
    ).rejects.toThrow(/idempotencyKey wajib/);
  });
});

describe("transaction rollback", () => {
  it("error setelah insert kas → seluruh transaksi rollback (tanpa kas yatim)", async () => {
    const { jobId } = await makeJob();
    await expect(
      getDb().transaction(async (tx) => {
        await insertCashflow(tx, {
          jobId,
          occurredOn: "2026-12-14",
          direction: "EXPENSE",
          category: "OTHER",
          amount: "10.00",
          description: "rollback",
        });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const rows = await getDb()
      .select({ id: cashflowsTable.id })
      .from(cashflowsTable)
      .where(eq(cashflowsTable.jobId, jobId));
    expect(rows).toHaveLength(0);
  });
});

describe("financial totals & summary", () => {
  it("ringkasan job: obligasi, kas, dan net", async () => {
    const { jobId } = await makeJob();
    await financeService.createClientPaymentSchedule({ jobId, term: "TERMIN_1", amount: "1000.00" });
    await financeService.createVendorPaymentSchedule({ jobId, type: "DP", amount: "400.00" });
    await financialOperations.recordGeneralExpense({
      jobId,
      category: "EQUIPMENT",
      amount: "50.00",
      occurredOn: "2026-12-15",
      description: "Sewa lensa",
      idempotencyKey: randomUUID(),
    });

    const summary = await financeService.getJobFinancialSummary(jobId);
    expect(summary.clientObligation).toBe("1000.00");
    expect(summary.vendorObligation).toBe("400.00");
    expect(summary.expense).toBe("50.00");
    expect(summary.net).toBe("-50.00");
  });
});

describe("historical reconciliation boundaries", () => {
  it("kategori expense CREW ambigu tidak dikonversi menjadi kas (butuh rekonsiliasi)", () => {
    const result = legacyExpenseToCreateCashflowInput({
      id: "EX1",
      jobId: "J1",
      description: "crew",
      category: "CREW",
      amount: 100,
      date: "2026-01-01",
    });
    expect(result.status).toBe("RECONCILIATION_REQUIRED");
    expect(result.value).toBeUndefined();
  });

  it("status pembayaran lama yang tidak cocok dengan kas ditandai", () => {
    expect(reconcileStoredPaymentStatus("PAID", "UNPAID").status).toBe(
      "RECONCILIATION_REQUIRED",
    );
  });
});

describe("reference integrity", () => {
  it("sumPaidForReference mengembalikan 0.00 saat belum ada kas", async () => {
    const { assignmentId } = await makeCrewAssignment("100.00");
    expect(await sumPaidForReference(getDb(), "job_crew", assignmentId)).toBe("0.00");
  });
});
