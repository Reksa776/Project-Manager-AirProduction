import { describe, expect, expectTypeOf, it } from "vitest";

import {
  addAmounts,
  AMOUNT_SCALE,
  isCanonicalAmount,
  MoneyError,
  parseAmount,
  ROUNDING_POLICY,
  subtractAmounts,
  ZERO_AMOUNT,
} from "@/domain/money";
import {
  aggregateCashflows,
  derivePaymentStatus,
  deriveSettlement,
  paymentIdempotencyKey,
  validateCashflow,
} from "@/domain/finance";
import {
  reconcileLegacyCrewRole,
  reconcileLegacyExpenseCategory,
  reconcileLegacyVenue,
  reconcileStoredPaymentStatus,
} from "@/domain/reconciliation";
import {
  legacyClientPaymentToCreateInput,
  legacyClientToCreateInput,
  legacyCrewToCreateInput,
  legacyExpenseToCreateCashflowInput,
  legacyJobCrewToCreateInput,
  legacyJobToCreateInput,
} from "@/domain/legacy-compat";
import {
  validateJobCounterparty,
  validatePositiveAmount,
} from "@/domain/validation";
import { REPOSITORY_CONTRACT_VERSION } from "@/repositories/contract";
import type { MySqlRepositories } from "@/repositories/contract";
import type {
  Client as LegacyClient,
  ClientPayment as LegacyClientPayment,
  Crew as LegacyCrew,
  Expense as LegacyExpense,
  Job as LegacyJob,
  JobCrew as LegacyJobCrew,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Fixtures (domain lama)                                                      */
/* -------------------------------------------------------------------------- */

const legacyClient = (over: Partial<LegacyClient> = {}): LegacyClient => ({
  id: "C1",
  name: "Client Satu",
  ...over,
});

const legacyJob = (over: Partial<LegacyJob> = {}): LegacyJob => ({
  id: "J1",
  jobNumber: "1",
  jobName: "Job Satu",
  category: "WEDDING",
  clientId: "C1",
  executionDate: "2026-05-01",
  status: "NOT_STARTED",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const legacyCrew = (over: Partial<LegacyCrew> = {}): LegacyCrew => ({
  id: "CR1",
  name: "Budi",
  role: "Videographer",
  defaultPayment: 1500000,
  ...over,
});

const legacyJobCrew = (over: Partial<LegacyJobCrew> = {}): LegacyJobCrew => ({
  id: "JC1",
  jobId: "J1",
  crewId: "CR1",
  role: "Videographer",
  actualPayment: 750000,
  ...over,
});

const legacyClientPayment = (over: Partial<LegacyClientPayment> = {}): LegacyClientPayment => ({
  id: "CP1",
  jobId: "J1",
  term: "TERMIN_1",
  amount: 1000.5,
  status: "UNPAID",
  ...over,
});

const legacyExpense = (over: Partial<LegacyExpense> = {}): LegacyExpense => ({
  id: "EX1",
  jobId: "J1",
  description: "Sewa lensa",
  category: "EQUIPMENT",
  amount: 250000,
  date: "2026-05-02",
  ...over,
});

const ROLES = [
  { id: "role-video", name: "Videographer" },
  { id: "role-editor", name: "Editor" },
];

/* -------------------------------------------------------------------------- */
/* Money (decimal-safe)                                                        */
/* -------------------------------------------------------------------------- */

describe("money: decimal-safe", () => {
  it("mendokumentasikan kebijakan pembulatan", () => {
    expect(ROUNDING_POLICY).toMatch(/half-up/);
    expect(AMOUNT_SCALE).toBe(2);
    expect(isCanonicalAmount(parseAmount("1"))).toBe(true);
    expect(parseAmount("1")).toBe("1.00");
  });

  it("menghindari floating point (0.1 + 0.2)", () => {
    expect(parseAmount(0.1 + 0.2)).toBe("0.30");
    expect(addAmounts("0.10", "0.20")).toBe("0.30");
  });

  it("membulatkan half-up ke 2 desimal", () => {
    expect(parseAmount("1.005")).toBe("1.01");
    expect(parseAmount("1.004")).toBe("1.00");
    expect(parseAmount("2.675")).toBe("2.68");
  });

  it("aman untuk nilai besar (decimal 15,2)", () => {
    expect(addAmounts("9999999999999.99", "0.01")).toBe("10000000000000.00");
    expect(subtractAmounts("9999999999999.99", "0.01")).toBe("9999999999999.98");
  });

  it("menolak nilai uang tidak valid", () => {
    expect(() => parseAmount("abc")).toThrow(MoneyError);
    expect(() => parseAmount("")).toThrow(MoneyError);
    expect(() => parseAmount(Number.NaN)).toThrow(MoneyError);
    expect(() => parseAmount(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });
});

/* -------------------------------------------------------------------------- */
/* Payment status derivation & settlement                                      */
/* -------------------------------------------------------------------------- */

describe("finance: status & settlement", () => {
  it("UNPAID saat belum ada kas (termasuk nol)", () => {
    expect(derivePaymentStatus("1000.00", "0.00")).toBe("UNPAID");
    expect(deriveSettlement("1000.00", []).status).toBe("UNPAID");
    expect(deriveSettlement("1000.00", []).remainingAmount).toBe("1000.00");
  });

  it("PARTIAL saat kas < obligasi", () => {
    const s = deriveSettlement("1000.50", [{ amount: "400.25" }]);
    expect(s.status).toBe("PARTIAL");
    expect(s.paidAmount).toBe("400.25");
    expect(s.remainingAmount).toBe("600.25");
  });

  it("PAID saat kas >= obligasi", () => {
    const s = deriveSettlement("1000.00", [{ amount: "600.00" }, { amount: "400.00" }]);
    expect(s.status).toBe("PAID");
    expect(s.remainingAmount).toBe(ZERO_AMOUNT);
    expect(s.overpaid).toBe(false);
  });

  it("overpayment: status PAID, remaining 0, kelebihan dilaporkan", () => {
    const s = deriveSettlement("100.00", [{ amount: "150.00" }]);
    expect(s.status).toBe("PAID");
    expect(s.remainingAmount).toBe("0.00");
    expect(s.overpaid).toBe(true);
    expect(s.overpaidAmount).toBe("50.00");
  });

  it("agreed vs paid terpisah (crew): agreedAmount != paidAmount", () => {
    const s = deriveSettlement("750000.00", [{ amount: "250000.00" }]);
    expect(s.obligationAmount).toBe("750000.00");
    expect(s.paidAmount).toBe("250000.00");
    expect(s.remainingAmount).toBe("500000.00");
    expect(s.status).toBe("PARTIAL");
  });

  it("menolak kas negatif", () => {
    expect(() => deriveSettlement("100.00", [{ amount: "-10.00" }])).toThrow(/negatif/);
  });

  it("idempotency key deterministik & stabil terhadap format", () => {
    const a = paymentIdempotencyKey({
      referenceType: "client_payment",
      referenceId: "CP1",
      occurredOn: "2026-05-01",
      amount: "1000.5",
    });
    const b = paymentIdempotencyKey({
      referenceType: "client_payment",
      referenceId: "CP1",
      occurredOn: "2026-05-01",
      amount: "1000.50",
    });
    expect(a).toBe(b);
  });
});

/* -------------------------------------------------------------------------- */
/* Cashflow aggregate & invariants                                             */
/* -------------------------------------------------------------------------- */

describe("finance: cashflow invariant", () => {
  it("agregasi income/expense/net", () => {
    const agg = aggregateCashflows([
      { direction: "INCOME", amount: "500.00" },
      { direction: "EXPENSE", amount: "125.50" },
    ]);
    expect(agg.income).toBe("500.00");
    expect(agg.expense).toBe("125.50");
    expect(agg.net).toBe("374.50");
  });

  it("menolak pasangan direction/category yang salah", () => {
    expect(
      validateCashflow({ direction: "INCOME", category: "OTHER", amount: "10.00" }).ok,
    ).toBe(false);
    expect(
      validateCashflow({ direction: "EXPENSE", category: "CLIENT_PAYMENT", amount: "10.00" }).ok,
    ).toBe(false);
  });

  it("menolak amount <= 0 dan referensi setengah", () => {
    expect(validateCashflow({ direction: "INCOME", category: "CLIENT_PAYMENT", amount: "0.00" }).ok).toBe(false);
    expect(
      validateCashflow({
        direction: "INCOME",
        category: "CLIENT_PAYMENT",
        amount: "10.00",
        referenceType: "client_payment",
      }).ok,
    ).toBe(false);
  });

  it("menerima kombinasi valid", () => {
    expect(
      validateCashflow({
        direction: "EXPENSE",
        category: "CREW_PAYMENT",
        amount: "10.00",
        referenceType: "job_crew",
        referenceId: "JC1",
      }).ok,
    ).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Domain invariants                                                           */
/* -------------------------------------------------------------------------- */

describe("validation: domain invariants", () => {
  it("Job wajib client XOR vendor", () => {
    expect(validateJobCounterparty("C1", undefined).ok).toBe(true);
    expect(validateJobCounterparty(undefined, "V1").ok).toBe(true);
    expect(validateJobCounterparty(undefined, undefined).ok).toBe(false);
    expect(validateJobCounterparty("C1", "V1").ok).toBe(false);
  });

  it("nominal obligasi harus > 0 dan valid", () => {
    expect(validatePositiveAmount("100.00", "amount").ok).toBe(true);
    expect(validatePositiveAmount("0.00", "amount").ok).toBe(false);
    expect(validatePositiveAmount("-5.00", "amount").ok).toBe(false);
    expect(validatePositiveAmount("abc", "amount").ok).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Reconciliation (ambiguous historical data)                                  */
/* -------------------------------------------------------------------------- */

describe("reconciliation", () => {
  it("venue: nama tersedia → OK; id tanpa nama → butuh rekonsiliasi", () => {
    expect(reconcileLegacyVenue({ venueName: "Balai Kartini" }).value?.legacyVenueName).toBe(
      "Balai Kartini",
    );
    expect(reconcileLegacyVenue({ venueId: "V1" }).status).toBe("RECONCILIATION_REQUIRED");
    expect(reconcileLegacyVenue({}).status).toBe("OK");
  });

  it("status pembayaran lama vs turunan → mismatch ditandai", () => {
    expect(reconcileStoredPaymentStatus("UNPAID", "UNPAID").status).toBe("OK");
    expect(reconcileStoredPaymentStatus("PAID", "UNPAID").status).toBe(
      "RECONCILIATION_REQUIRED",
    );
    expect(reconcileStoredPaymentStatus("BOGUS", "UNPAID").status).toBe(
      "RECONCILIATION_REQUIRED",
    );
  });

  it("role crew: dikenal → OK; tidak dikenal/kosong → butuh rekonsiliasi", () => {
    expect(reconcileLegacyCrewRole("videographer", ROLES).value?.crewRoleId).toBe("role-video");
    expect(reconcileLegacyCrewRole("Unknown", ROLES).status).toBe("RECONCILIATION_REQUIRED");
    expect(reconcileLegacyCrewRole("  ", ROLES).status).toBe("RECONCILIATION_REQUIRED");
  });

  it("kategori expense lama CREW/VENDOR ambigu → butuh rekonsiliasi", () => {
    expect(reconcileLegacyExpenseCategory("CREW").status).toBe("RECONCILIATION_REQUIRED");
    expect(reconcileLegacyExpenseCategory("VENDOR").status).toBe("RECONCILIATION_REQUIRED");
    expect(reconcileLegacyExpenseCategory("TRANSPORT").value?.category).toBe("TRANSPORT");
    expect(reconcileLegacyExpenseCategory("WAT").status).toBe("RECONCILIATION_REQUIRED");
  });
});

/* -------------------------------------------------------------------------- */
/* Legacy → canonical adapters                                                 */
/* -------------------------------------------------------------------------- */

describe("legacy-compat adapters", () => {
  it("client legacy → input kanonik", () => {
    const r = legacyClientToCreateInput(legacyClient({ phone: "0812" }));
    expect(r.status).toBe("OK");
    expect(r.value?.name).toBe("Client Satu");
    expect(r.value?.phone).toBe("0812");
  });

  it("crew legacy: role harus ada; nominal diformat ke Amount", () => {
    const okResult = legacyCrewToCreateInput(legacyCrew(), ROLES);
    expect(okResult.value?.crewRoleId).toBe("role-video");
    expect(okResult.value?.defaultPayment).toBe("1500000.00");

    expect(legacyCrewToCreateInput(legacyCrew({ role: "X" }), ROLES).status).toBe(
      "RECONCILIATION_REQUIRED",
    );
  });

  it("job legacy: venueId tanpa arsip nama → rekonsiliasi; dengan arsip → legacyVenueName", () => {
    const withoutName = legacyJobToCreateInput(legacyJob({ venueId: "V1" }));
    expect(withoutName.status).toBe("RECONCILIATION_REQUIRED");

    const withName = legacyJobToCreateInput(legacyJob({ venueId: "V1" }), {
      venueNameById: new Map([["V1", "Balai Kartini"]]),
    });
    expect(withName.status).toBe("OK");
    expect(withName.value?.legacyVenueName).toBe("Balai Kartini");
    expect(withName.value).not.toHaveProperty("venueId");
  });

  it("jobCrew legacy: actualPayment → agreedAmount; paymentStatus lama ditandai", () => {
    const withStatus = legacyJobCrewToCreateInput(
      legacyJobCrew({ paymentStatus: "PAID" }),
      ROLES,
    );
    expect(withStatus.value?.agreedAmount).toBe("750000.00");
    expect(withStatus.issues.some((i) => i.code === "STORED_CREW_PAYMENT_STATUS")).toBe(true);

    const withoutStatus = legacyJobCrewToCreateInput(legacyJobCrew(), ROLES);
    expect(withoutStatus.status).toBe("OK");
    expect(withoutStatus.value?.crewRoleId).toBe("role-video");
  });

  it("client payment legacy → JADWAL tanpa status", () => {
    const r = legacyClientPaymentToCreateInput(legacyClientPayment());
    expect(r.status).toBe("OK");
    expect(r.value?.amount).toBe("1000.50");
    expect(r.value).not.toHaveProperty("status");
  });

  it("expense legacy → cashflow EXPENSE; CREW ambigu → rekonsiliasi", () => {
    const equipment = legacyExpenseToCreateCashflowInput(legacyExpense());
    expect(equipment.value?.direction).toBe("EXPENSE");
    expect(equipment.value?.category).toBe("EQUIPMENT");
    expect(equipment.value?.source).toBe("MIGRATION");
    expect(equipment.value?.amount).toBe("250000.00");

    expect(
      legacyExpenseToCreateCashflowInput(legacyExpense({ category: "CREW" })).status,
    ).toBe("RECONCILIATION_REQUIRED");
  });
});

/* -------------------------------------------------------------------------- */
/* Repository contract compatibility                                           */
/* -------------------------------------------------------------------------- */

describe("new repository contract", () => {
  it("versi kontrak = 2", () => {
    expect(REPOSITORY_CONTRACT_VERSION).toBe(2);
  });

  it("memuat entity kanonik dan TIDAK memuat venues/expenses", () => {
    const expectedKeys = [
      "jobs",
      "clients",
      "packages",
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
    ] as const;

    expectTypeOf<keyof MySqlRepositories>().toEqualTypeOf<(typeof expectedKeys)[number]>();
    expectTypeOf<MySqlRepositories>().not.toHaveProperty("venues");
    expectTypeOf<MySqlRepositories>().not.toHaveProperty("expenses");
    expect(expectedKeys).not.toContain("venues");
    expect(expectedKeys).not.toContain("expenses");
  });

  it("membedakan schedule (obligasi) dari cashflow (kas)", () => {
    expectTypeOf<MySqlRepositories>().toHaveProperty("clientPaymentSchedules");
    expectTypeOf<MySqlRepositories>().toHaveProperty("vendorPaymentSchedules");
    expectTypeOf<MySqlRepositories>().toHaveProperty("cashflows");
    expectTypeOf<MySqlRepositories>().toHaveProperty("jobCrewAssignments");
  });
});
