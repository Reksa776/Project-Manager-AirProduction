import type { InferSelectModel } from "drizzle-orm";

import { parseAmount } from "@/domain/money";
import {
  CASHFLOW_REFERENCE_TYPES,
  CASHFLOW_SOURCES,
  type Cashflow,
  type CashflowReferenceType,
  type CashflowSource,
  type ClientPaymentSchedule,
  type ClientPaymentTerm,
  type JobCrewAssignment,
  type VendorPaymentSchedule,
  type VendorPaymentType,
} from "@/domain/types";
import {
  isCashflowCategory,
  isCashflowDirection,
  isClientPaymentTerm,
  isVendorPaymentType,
} from "@/domain/validation";
import { cashflows, clientPayments, jobCrews, vendorPayments } from "@/db/schema";
import { RepositoryError } from "@/repositories/mysql/errors";

/**
 * Mapping murni baris MySQL → domain kanonik (Amount = string desimal).
 * Nilai enum divalidasi terhadap allow-list domain; nilai tak dikenal → error
 * eksplisit (tidak ada casting buta).
 */

export type CashflowRow = InferSelectModel<typeof cashflows>;
export type ClientPaymentScheduleRow = InferSelectModel<typeof clientPayments>;
export type VendorPaymentScheduleRow = InferSelectModel<typeof vendorPayments>;
export type JobCrewAssignmentRow = InferSelectModel<typeof jobCrews>;

function opt(value: string | null | undefined): string | undefined {
  return value === null || value === undefined ? undefined : value;
}

export function rowToCashflow(row: CashflowRow): Cashflow {
  if (!isCashflowDirection(row.direction)) {
    throw new RepositoryError(`Direction cashflow tidak valid: '${row.direction}'.`);
  }
  if (!isCashflowCategory(row.category)) {
    throw new RepositoryError(`Kategori cashflow tidak valid: '${row.category}'.`);
  }
  let referenceType: CashflowReferenceType | undefined;
  if (row.referenceType !== null) {
    if (!(CASHFLOW_REFERENCE_TYPES as readonly string[]).includes(row.referenceType)) {
      throw new RepositoryError(
        `reference_type cashflow tidak valid: '${row.referenceType}'.`,
      );
    }
    referenceType = row.referenceType as CashflowReferenceType;
  }
  if (!(CASHFLOW_SOURCES as readonly string[]).includes(row.source)) {
    throw new RepositoryError(`Sumber cashflow tidak valid: '${row.source}'.`);
  }
  return {
    id: row.id,
    jobId: opt(row.jobId),
    occurredOn: row.occurredOn,
    direction: row.direction,
    category: row.category,
    amount: parseAmount(row.amount),
    description: row.description,
    referenceType,
    referenceId: opt(row.referenceId),
    source: row.source as CashflowSource,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToClientPaymentSchedule(row: ClientPaymentScheduleRow): ClientPaymentSchedule {
  if (!isClientPaymentTerm(row.term)) {
    throw new RepositoryError(`Term client payment tidak valid: '${row.term}'.`);
  }
  return {
    id: row.id,
    jobId: row.jobId,
    term: row.term as ClientPaymentTerm,
    amount: parseAmount(row.amount),
    dueDate: opt(row.dueDate),
    paidDate: opt(row.paidDate),
    notes: opt(row.notes),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToVendorPaymentSchedule(row: VendorPaymentScheduleRow): VendorPaymentSchedule {
  if (!isVendorPaymentType(row.type)) {
    throw new RepositoryError(`Tipe vendor payment tidak valid: '${row.type}'.`);
  }
  return {
    id: row.id,
    jobId: row.jobId,
    type: row.type as VendorPaymentType,
    amount: parseAmount(row.amount),
    dueDate: opt(row.dueDate),
    paidDate: opt(row.paidDate),
    notes: opt(row.notes),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function rowToJobCrewAssignment(row: JobCrewAssignmentRow): JobCrewAssignment {
  return {
    id: row.id,
    jobId: row.jobId,
    crewId: row.crewId,
    crewRoleId: row.crewRoleId ?? null,
    agreedAmount: parseAmount(row.agreedAmount),
    notes: opt(row.notes),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
