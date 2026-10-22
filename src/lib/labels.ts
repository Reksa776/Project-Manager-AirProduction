import type {
  CashflowCategory,
  CashflowDirection,
  ClientPaymentTerm,
  DeliveryStatus,
  JobCategory,
  JobStatus,
  PaymentStatus,
  VendorPaymentType,
} from "@/domain/types";

/**
 * All UI labels use English.
 * Istilah teknis yang lebih jelas dalam bahasa Inggris (mis. "DP")
 * tetap dipertahankan.
 *
 * P0E-1B: label kini memakai tipe domain KANONIK (`@/domain/types`), bukan
 * domain legacy `@/lib/types`. `EXPENSE_CATEGORIES` legacy dihapus dan diganti
 * kategori pengeluaran kanonik (cashflow direction=EXPENSE).
 */

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partially Paid",
  PAID: "Paid",
};

export const JOB_CATEGORY_LABEL: Record<JobCategory, string> = {
  WEDDING: "Wedding",
  PREWEDDING: "Pre-Wedding",
  CORPORATE: "Corporate",
  EVENT: "Event",
  OTHER: "Other",
};

export const CLIENT_PAYMENT_TERM_LABEL: Record<ClientPaymentTerm, string> = {
  TERMIN_1: "Installment 1 (Deposit)",
  TERMIN_2: "Installment 2",
  TERMIN_3: "Installment 3 (Final Payment)",
};

export const VENDOR_PAYMENT_TYPE_LABEL: Record<VendorPaymentType, string> = {
  DP: "DP",
  PELUNASAN: "Final Payment",
};

export const CASHFLOW_DIRECTION_LABEL: Record<CashflowDirection, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
};

export const CASHFLOW_CATEGORY_LABEL: Record<CashflowCategory, string> = {
  CLIENT_PAYMENT: "Client Payment",
  VENDOR_PAYMENT: "Vendor Payment",
  CREW_PAYMENT: "Crew Payment",
  TRANSPORT: "Transport (legacy)",
  EQUIPMENT: "Peralatan",
  OTHER: "Lainnya (legacy)",
  INTERNET: "Beban — Internet",
  ELECTRICITY: "Beban — Listrik",
  SALARY: "Beban — Gaji",
  RENT: "Beban — Sewa",
  SUPPLIES: "Perlengkapan",
};

/**
 * Kategori biaya operasional umum (tanpa Job diperbolehkan). Selaras dengan
 * Kategori beban dan pembelian operasional yang dapat dicatat.
 */
export const GENERAL_EXPENSE_CATEGORIES = [
  "INTERNET",
  "ELECTRICITY",
  "SALARY",
  "RENT",
  "EQUIPMENT",
  "SUPPLIES",
] as const;

/** Label client type kanonik (dipakai form client). */
export const CLIENT_TYPE_LABEL = {
  INDIVIDU: "Individual",
  PERUSAHAAN: "Company",
  AGENCY: "Agency",
  LAINNYA: "Other",
} as const;
