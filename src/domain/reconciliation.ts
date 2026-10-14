import {
  isCashflowCategory,
  isPaymentStatus,
  type DomainValidationResult,
} from "./validation";
import type { CashflowCategory, PaymentStatus } from "./types";

/**
 * State rekonsiliasi untuk data historis yang tidak dapat dipetakan dengan
 * pasti tanpa menebak. Prinsip: **jangan menebak** — tandai
 * `RECONCILIATION_REQUIRED` dengan alasan eksplisit.
 */

export type ReconciliationStatus = "OK" | "RECONCILIATION_REQUIRED";

export interface ReconciliationIssue {
  code: string;
  message: string;
  field?: string;
}

export interface Reconciled<T> {
  status: ReconciliationStatus;
  /** Terisi bila status OK. */
  value?: T;
  issues: ReconciliationIssue[];
}

export function ok<T>(value: T, issues: ReconciliationIssue[] = []): Reconciled<T> {
  return { status: "OK", value, issues };
}

export function reconciliationRequired<T>(
  issues: ReconciliationIssue[],
): Reconciled<T> {
  return { status: "RECONCILIATION_REQUIRED", issues };
}

/* -------------------------------------------------------------------------- */
/* Adapter rekonsiliasi spesifik                                               */
/* -------------------------------------------------------------------------- */

/**
 * Status pembayaran lama (disimpan) vs status baru (dihitung dari cashflow).
 * Bila berbeda → butuh rekonsiliasi manual (jangan override diam-diam).
 */
export function reconcileStoredPaymentStatus(
  storedStatus: string,
  derivedStatus: PaymentStatus,
): Reconciled<{ derivedStatus: PaymentStatus }> {
  if (!isPaymentStatus(storedStatus)) {
    return reconciliationRequired([
      {
        code: "UNKNOWN_STORED_STATUS",
        message: `Status pembayaran lama '${storedStatus}' tidak dikenal.`,
        field: "status",
      },
    ]);
  }
  if (storedStatus !== derivedStatus) {
    return reconciliationRequired([
      {
        code: "STATUS_MISMATCH",
        message: `Status lama '${storedStatus}' berbeda dari status turunan '${derivedStatus}' (dari cashflow).`,
        field: "status",
      },
    ]);
  }
  return ok({ derivedStatus });
}

/** Role crew lama (string bebas) → id `crew_roles` (lookup, tanpa membuat baru). */
export function reconcileLegacyCrewRole(
  roleName: string,
  knownRoles: readonly { id: string; name: string }[],
): Reconciled<{ crewRoleId: string }> {
  const trimmed = roleName.trim();
  if (trimmed === "") {
    return reconciliationRequired([
      { code: "EMPTY_ROLE", message: "Role crew lama kosong.", field: "role" },
    ]);
  }
  const match = knownRoles.find(
    (role) => role.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (!match) {
    return reconciliationRequired([
      {
        code: "UNKNOWN_ROLE",
        message: `Role crew lama '${trimmed}' tidak ada di crew_roles; perlu dibuat/dipetakan manual.`,
        field: "role",
      },
    ]);
  }
  return ok({ crewRoleId: match.id });
}

const LEGACY_CREW_EXPENSE_CATEGORY = "CREW";
const LEGACY_VENDOR_EXPENSE_CATEGORY = "VENDOR";

/**
 * Kategori expense lama → kategori cashflow.
 * CREW/VENDOR ambigu (berisiko double-count dengan job_crews/vendor_payments
 * pada data lama) → wajib rekonsiliasi (R3).
 */
export function reconcileLegacyExpenseCategory(
  category: string,
): Reconciled<{ category: CashflowCategory }> {
  const normalized = category.trim().toUpperCase();
  if (normalized === LEGACY_CREW_EXPENSE_CATEGORY || normalized === LEGACY_VENDOR_EXPENSE_CATEGORY) {
    return reconciliationRequired([
      {
        code: "AMBIGUOUS_EXPENSE_CATEGORY",
        message: `Expense lama kategori '${normalized}' bisa tumpang tindih dengan pencatatan crew/vendor; perlu rekonsiliasi.`,
        field: "category",
      },
    ]);
  }
  if (!isCashflowCategory(normalized)) {
    return reconciliationRequired([
      {
        code: "UNMAPPABLE_EXPENSE_CATEGORY",
        message: `Kategori expense lama '${category}' tidak dapat dipetakan ke kategori cashflow.`,
        field: "category",
      },
    ]);
  }
  return ok({ category: normalized });
}

/**
 * Venue lama: venueId tanpa nama tidak dapat dipetakan ke `legacy_venue_name`
 * tanpa arsip worksheet `venues` (R2/venue archive).
 */
export function reconcileLegacyVenue(input: {
  venueId?: string;
  venueName?: string;
}): Reconciled<{ legacyVenueName?: string }> {
  const hasId = input.venueId !== undefined && input.venueId !== "";
  const hasName = input.venueName !== undefined && input.venueName.trim() !== "";
  if (hasName) {
    return ok({ legacyVenueName: input.venueName!.trim() });
  }
  if (hasId) {
    return reconciliationRequired([
      {
        code: "VENUE_NAME_MISSING",
        message: `Job menunjuk venue '${input.venueId}' tetapi nama venue tidak tersedia; perlu arsip venues untuk snapshot legacy_venue_name.`,
        field: "venueId",
      },
    ]);
  }
  return ok({ legacyVenueName: undefined });
}

/** Gabungkan hasil validasi domain ke bentuk Reconciled. */
export function fromValidation<T>(
  validation: DomainValidationResult,
  value: T,
): Reconciled<T> {
  if (validation.ok) return ok(value);
  return reconciliationRequired(
    validation.errors.map((message) => ({ code: "DOMAIN_VALIDATION", message })),
  );
}
