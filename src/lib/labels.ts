import type {
  ClientPaymentTerm,
  DeliveryStatus,
  JobCategory,
  JobStatus,
  PaymentStatus,
  VendorPaymentType,
} from "@/lib/types";

/**
 * Seluruh label UI menggunakan Bahasa Indonesia.
 * Istilah teknis yang lebih jelas dalam bahasa Inggris (mis. "DP")
 * tetap dipertahankan.
 */

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  NOT_STARTED: "Belum Dikerjakan",
  IN_PROGRESS: "Sedang Dikerjakan",
  COMPLETED: "Sudah Dikerjakan",
};

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  NOT_STARTED: "Belum Dikerjakan",
  IN_PROGRESS: "Sedang Dikerjakan",
  COMPLETED: "Sudah Dikerjakan",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Belum Dibayar",
  PARTIAL: "Sebagian",
  PAID: "Sudah Dibayar",
};

export const JOB_CATEGORY_LABEL: Record<JobCategory, string> = {
  WEDDING: "Wedding",
  PREWEDDING: "Pre-Wedding",
  CORPORATE: "Corporate",
  EVENT: "Event",
  OTHER: "Lainnya",
};

export const CLIENT_PAYMENT_TERM_LABEL: Record<ClientPaymentTerm, string> = {
  TERMIN_1: "Termin 1 (DP)",
  TERMIN_2: "Termin 2",
  TERMIN_3: "Termin 3 (Pelunasan)",
};

export const VENDOR_PAYMENT_TYPE_LABEL: Record<VendorPaymentType, string> = {
  DP: "DP",
  PELUNASAN: "Pelunasan",
};
