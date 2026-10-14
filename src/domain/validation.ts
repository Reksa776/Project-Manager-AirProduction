import { MoneyError, parseAmount, toMinorUnits, type Amount } from "./money";
import {
  ADMIN_ROLES,
  CASHFLOW_CATEGORIES,
  CASHFLOW_DIRECTIONS,
  CLIENT_PAYMENT_TERMS,
  CLIENT_TYPES,
  DELIVERY_STATUSES,
  JOB_CATEGORIES,
  JOB_STATUSES,
  PAYMENT_STATUSES,
  VENDOR_PAYMENT_TYPES,
  type AdminRole,
  type CashflowCategory,
  type CashflowDirection,
  type ClientPaymentTerm,
  type ClientType,
  type DeliveryStatus,
  type JobCategory,
  type JobStatus,
  type PaymentStatus,
  type VendorPaymentType,
} from "./types";

export interface DomainValidationResult {
  ok: boolean;
  errors: string[];
}

/* ------------------------------- type guards ------------------------------- */

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}
export function isDeliveryStatus(value: string): value is DeliveryStatus {
  return (DELIVERY_STATUSES as readonly string[]).includes(value);
}
export function isJobCategory(value: string): value is JobCategory {
  return (JOB_CATEGORIES as readonly string[]).includes(value);
}
export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}
export function isCashflowDirection(value: string): value is CashflowDirection {
  return (CASHFLOW_DIRECTIONS as readonly string[]).includes(value);
}
export function isCashflowCategory(value: string): value is CashflowCategory {
  return (CASHFLOW_CATEGORIES as readonly string[]).includes(value);
}
export function isClientPaymentTerm(value: string): value is ClientPaymentTerm {
  return (CLIENT_PAYMENT_TERMS as readonly string[]).includes(value);
}
export function isVendorPaymentType(value: string): value is VendorPaymentType {
  return (VENDOR_PAYMENT_TYPES as readonly string[]).includes(value);
}
export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}
export function isClientType(value: string): value is ClientType {
  return (CLIENT_TYPES as readonly string[]).includes(value);
}

/* ------------------------------ invariants --------------------------------- */

/**
 * Invariant Job: wajib memiliki clientId XOR vendorId
 * (selaras dengan CHECK `chk_jobs_client_vendor_xor`).
 */
export function validateJobCounterparty(
  clientId: string | undefined,
  vendorId: string | undefined,
): DomainValidationResult {
  const errors: string[] = [];
  const hasClient = clientId !== undefined && clientId !== "";
  const hasVendor = vendorId !== undefined && vendorId !== "";
  if (hasClient === hasVendor) {
    errors.push("Job wajib memiliki clientId ATAU vendorId (tidak keduanya, tidak kosong).");
  }
  return { ok: errors.length === 0, errors };
}

/** Job number wajib diisi (nilai historis dipertahankan apa adanya). */
export function validateJobNumber(jobNumber: string): DomainValidationResult {
  const errors: string[] = [];
  if (jobNumber.trim() === "") errors.push("jobNumber wajib diisi.");
  if (jobNumber.length > 32) errors.push("jobNumber melebihi 32 karakter.");
  return { ok: errors.length === 0, errors };
}

/** Nominal obligasi (schedule) harus > 0 dan valid. */
export function validatePositiveAmount(amount: Amount, field: string): DomainValidationResult {
  const errors: string[] = [];
  try {
    const parsed = parseAmount(amount);
    if (toMinorUnits(parsed) <= BigInt(0)) {
      errors.push(`Nilai '${field}' harus lebih besar dari 0.`);
    }
  } catch (error) {
    const message = error instanceof MoneyError ? error.message : `Nilai '${field}' tidak valid.`;
    errors.push(message);
  }
  return { ok: errors.length === 0, errors };
}
