import type {
  Client as LegacyClient,
  ClientPayment as LegacyClientPayment,
  Crew as LegacyCrew,
  Delivery as LegacyDelivery,
  Expense as LegacyExpense,
  Job as LegacyJob,
  JobCrew as LegacyJobCrew,
  Vendor as LegacyVendor,
  VendorPayment as LegacyVendorPayment,
} from "@/lib/types";

import {
  reconcileLegacyCrewRole,
  reconcileLegacyExpenseCategory,
  reconcileLegacyVenue,
  reconciliationRequired,
  ok,
  type Reconciled,
} from "./reconciliation";
import { MoneyError, parseAmount } from "./money";
import { validateJobCounterparty, validateJobNumber } from "./validation";
import type {
  CreateCashflowInput,
  CreateClientInput,
  CreateClientPaymentScheduleInput,
  CreateCrewInput,
  CreateDeliveryInput,
  CreateJobCrewAssignmentInput,
  CreateJobInput,
  CreateVendorInput,
  CreateVendorPaymentScheduleInput,
} from "./inputs";

/**
 * Adapter domain LAMA (Google Sheets, `src/lib/types.ts`) → input domain
 * KANONIK. Tidak ada cast paksa; perbedaan semantik diungkap lewat state
 * `RECONCILIATION_REQUIRED` (lihat `reconciliation.ts`).
 */

function amountFromLegacy(value: number, field: string): Reconciled<string> {
  try {
    return ok(parseAmount(value));
  } catch (error) {
    const message = error instanceof MoneyError ? error.message : `Nilai '${field}' tidak valid.`;
    return reconciliationRequired([{ code: "INVALID_AMOUNT", message, field }]);
  }
}

export function legacyClientToCreateInput(client: LegacyClient): Reconciled<CreateClientInput> {
  return ok({
    name: client.name,
    contactPerson: client.contactPerson,
    phone: client.phone,
    email: client.email,
    address: client.address,
    notes: client.notes,
  });
}

export function legacyVendorToCreateInput(vendor: LegacyVendor): Reconciled<CreateVendorInput> {
  return ok({
    name: vendor.name,
    contactPerson: vendor.contactPerson,
    phone: vendor.phone,
    email: vendor.email,
    notes: vendor.notes,
  });
}

/**
 * Crew lama memakai `role` (string bebas). Role harus sudah ada di `crew_roles`
 * (tidak dibuat implisit). `defaultPayment` diformat ke `Amount`.
 */
export function legacyCrewToCreateInput(
  crew: LegacyCrew,
  knownRoles: readonly { id: string; name: string }[],
): Reconciled<CreateCrewInput> {
  const role = reconcileLegacyCrewRole(crew.role, knownRoles);
  const amount = amountFromLegacy(crew.defaultPayment, "crew.defaultPayment");
  const issues = [...role.issues, ...amount.issues];
  if (role.status !== "OK" || amount.status !== "OK") {
    return reconciliationRequired(issues);
  }
  return ok({
    name: crew.name,
    crewRoleId: role.value!.crewRoleId,
    defaultPayment: amount.value!,
    phone: crew.phone,
    notes: crew.notes,
  });
}

export interface LegacyJobContext {
  /** Nama venue per `venueId` (dari arsip worksheet `venues`). */
  venueNameById?: ReadonlyMap<string, string>;
}

/**
 * Job lama → input kanonik.
 * - `venueId` tidak dipetakan ke kolom; namanya snapshotted ke `legacyVenueName`.
 * - XOR client/vendor divalidasi.
 * - `jobNumber` historis dipertahankan apa adanya.
 */
export function legacyJobToCreateInput(
  job: LegacyJob,
  context: LegacyJobContext = {},
): Reconciled<CreateJobInput> {
  const venue = reconcileLegacyVenue({
    venueId: job.venueId,
    venueName: job.venueId ? context.venueNameById?.get(job.venueId) : undefined,
  });
  const xor = validateJobCounterparty(job.clientId, job.vendorId);
  const number = validateJobNumber(job.jobNumber);

  const issues = [...venue.issues, ...xor.errors.map((m) => ({ code: "JOB_XOR", message: m })), ...number.errors.map((m) => ({ code: "JOB_NUMBER", message: m }))];
  if (venue.status !== "OK" || !xor.ok || !number.ok) {
    return reconciliationRequired(issues);
  }
  return ok({
    jobNumber: job.jobNumber,
    jobName: job.jobName,
    category: job.category,
    clientId: job.clientId,
    vendorId: job.vendorId,
    executionDate: job.executionDate,
    status: job.status,
    location: job.location,
    notes: job.notes,
    legacyVenueName: venue.value!.legacyVenueName,
  });
}

/**
 * Assignment crew lama → input kanonik.
 * - `actualPayment` → `agreedAmount` (kesepakatan; BUKAN kas aktual).
 * - `role` → `crewRoleId` (harus ada di crew_roles).
 * - `paymentStatus` lama TIDAK dapat dipetakan (status baru derivatif) →
 *   selalu memicu rekonsiliasi (tidak ditebak).
 */
export function legacyJobCrewToCreateInput(
  assignment: LegacyJobCrew,
  knownRoles: readonly { id: string; name: string }[],
): Reconciled<CreateJobCrewAssignmentInput> {
  const role = reconcileLegacyCrewRole(assignment.role, knownRoles);
  const agreed = amountFromLegacy(assignment.actualPayment, "jobCrew.actualPayment");
  const issues = [...role.issues, ...agreed.issues];

  if (assignment.paymentStatus !== undefined) {
    issues.push({
      code: "STORED_CREW_PAYMENT_STATUS",
      message:
        "paymentStatus crew lama tidak dipetakan: status baru harus diturunkan dari cashflow, bukan disalin.",
      field: "paymentStatus",
    });
  }

  if (role.status !== "OK" || agreed.status !== "OK") {
    return reconciliationRequired(issues);
  }
  return {
    status: issues.length === 0 ? "OK" : "RECONCILIATION_REQUIRED",
    value: {
      jobId: assignment.jobId,
      crewId: assignment.crewId,
      crewRoleId: role.value!.crewRoleId,
      agreedAmount: agreed.value!,
      notes: assignment.notes,
    },
    issues,
  };
}

export function legacyDeliveryToCreateInput(
  delivery: LegacyDelivery,
): Reconciled<CreateDeliveryInput> {
  return ok({
    jobId: delivery.jobId,
    name: delivery.name,
    deliveryType: delivery.deliveryType,
    quantity: delivery.quantity,
    deadline: delivery.deadline,
    status: delivery.status,
    deliveredAt: delivery.deliveredAt,
    notes: delivery.notes,
  });
}

/**
 * Client payment lama → JADWAL kanonik (tanpa `status`).
 * Status lama sengaja TIDAK dibawa (harus diturunkan dari cashflow).
 */
export function legacyClientPaymentToCreateInput(
  payment: LegacyClientPayment,
): Reconciled<CreateClientPaymentScheduleInput> {
  const amount = amountFromLegacy(payment.amount, "clientPayment.amount");
  if (amount.status !== "OK") return reconciliationRequired(amount.issues);
  return ok({
    jobId: payment.jobId,
    term: payment.term,
    amount: amount.value!,
    dueDate: payment.dueDate,
    paidDate: payment.paidDate,
    notes: payment.notes,
  });
}

export function legacyVendorPaymentToCreateInput(
  payment: LegacyVendorPayment,
): Reconciled<CreateVendorPaymentScheduleInput> {
  const amount = amountFromLegacy(payment.amount, "vendorPayment.amount");
  if (amount.status !== "OK") return reconciliationRequired(amount.issues);
  return ok({
    jobId: payment.jobId,
    type: payment.type,
    amount: amount.value!,
    dueDate: payment.dueDate,
    paidDate: payment.paidDate,
    notes: payment.notes,
  });
}

/**
 * Expense lama → input cashflow (EXPENSE). Kategori CREW/VENDOR ambigu →
 * rekonsiliasi (R3). Expense selalu punya jobId di domain lama.
 */
export function legacyExpenseToCreateCashflowInput(
  expense: LegacyExpense,
): Reconciled<CreateCashflowInput> {
  const category = reconcileLegacyExpenseCategory(expense.category);
  const amount = amountFromLegacy(expense.amount, "expense.amount");
  const issues = [...category.issues, ...amount.issues];
  if (category.status !== "OK" || amount.status !== "OK") {
    return reconciliationRequired(issues);
  }
  return ok({
    jobId: expense.jobId,
    occurredOn: expense.date,
    direction: "EXPENSE",
    category: category.value!.category,
    amount: amount.value!,
    description: expense.description,
    source: "MIGRATION",
  });
}
