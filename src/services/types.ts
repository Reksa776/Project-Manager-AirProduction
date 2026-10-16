import type { Amount } from "@/domain/money";
import type {
  Cashflow,
  ClientPaymentSchedule,
  Crew,
  CrewRole,
  Delivery,
  Job,
  JobCrewAssignment,
  VendorPaymentSchedule,
} from "@/domain/types";
import type {
  DeliveryStatus,
  JobCategory,
  JobStatus,
  PaymentStatus,
} from "@/domain/types";

/**
 * VIEW MODEL UI (P0E-1B).
 *
 * UI TIDAK membaca entity kanonik mentah secara langsung; tipe di sini adalah
 * hasil komposisi service kanonik (Contract v2) menjadi bentuk yang siap
 * ditampilkan. Tidak ada field yang mengarang konsep lama:
 * - TIDAK ADA `venue` (venue dihapus; hanya `legacyVenueName` sebagai snapshot).
 * - TIDAK ADA `expense` (pengeluaran = Cashflow kanonik).
 * - TIDAK ADA status pembayaran tersimpan (status selalu DITURUNKAN dari kas).
 * Semua uang memakai `Amount` (string desimal) — bukan number.
 */

export type CounterpartyType = "CLIENT" | "VENDOR";

export interface Counterparty {
  type: CounterpartyType;
  id: string;
  name: string;
}

export interface JobListItem {
  id: string;
  jobNumber: string;
  jobName: string;
  category: JobCategory;
  counterparty: Counterparty;
  packageId?: string;
  /** Snapshot histori nama venue (venue bukan entity aktif). */
  legacyVenueName?: string;
  executionDate: string;
  status: JobStatus;
  location?: string;
  notes?: string;
}

/** Assignment crew + role teresolusi + settlement yang DITURUNKAN dari kas. */
export interface CrewAssignmentView {
  assignment: JobCrewAssignment;
  crew: Crew | null;
  /** Role efektif: override job bila ada, jika tidak role master crew. */
  roleName: string;
  agreedAmount: Amount;
  paidAmount: Amount;
  remainingAmount: Amount;
  status: PaymentStatus;
}

/** Jadwal tagihan client (obligasi) + status turunan dari kas. */
export interface ClientScheduleView extends ClientPaymentSchedule {
  paidAmount: Amount;
  status: PaymentStatus;
}

/** Jadwal tagihan vendor (obligasi) + status turunan dari kas. */
export interface VendorScheduleView extends VendorPaymentSchedule {
  paidAmount: Amount;
  status: PaymentStatus;
}

export interface JobFinancialTotals {
  income: Amount;
  expense: Amount;
  net: Amount;
  clientObligation: Amount;
  vendorObligation: Amount;
  crewAgreed: Amount;
  clientPaid: Amount;
  vendorPaid: Amount;
  crewPaid: Amount;
}

export interface JobDetail {
  job: Job;
  counterparty: Counterparty;
  crewAssignments: CrewAssignmentView[];
  deliveries: Delivery[];
  clientSchedules: ClientScheduleView[];
  vendorSchedules: VendorScheduleView[];
  /** Kas aktual (satu-satunya sumber kebenaran uang), termasuk biaya umum tanpa job. */
  cashflows: Cashflow[];
  totals: JobFinancialTotals;
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export interface DashboardSummary {
  totalJobs: number;
  notStarted: number;
  inProgress: number;
  completed: number;
}

export interface IncomingWeddingItem {
  jobNumber: string;
  jobName: string;
  counterpartyName: string;
  legacyVenueName?: string;
  executionDate: string;
  status: JobStatus;
}

export interface ProjectMonitoringItem {
  deliveryId: string;
  deliveryName: string;
  jobNumber: string;
  jobName: string;
  deadline: string;
  status: DeliveryStatus;
}

/** @deprecated Kept as an alias for existing consumers of the dashboard data. */
export type IncomingEditingItem = ProjectMonitoringItem;

export interface DashboardData {
  summary: DashboardSummary;
  incomingWeddings: IncomingWeddingItem[];
  projectMonitoring: ProjectMonitoringItem[];
  /** @deprecated Use projectMonitoring. */
  incomingEditing: ProjectMonitoringItem[];
}

/* -------------------------------------------------------------------------- */
/* Finance overview (cash flow oriented)                                      */
/* -------------------------------------------------------------------------- */

export interface CashflowRowView {
  id: string;
  occurredOn: string;
  direction: Cashflow["direction"];
  category: Cashflow["category"];
  description: string;
  amount: Amount;
  /** Label job (nomor — nama) atau "-" untuk biaya operasional tanpa job. */
  jobLabel: string;
}

export interface FinanceOverview {
  clientSchedules: ClientScheduleView[];
  vendorSchedules: VendorScheduleView[];
  cashflows: CashflowRowView[];
  totals: { income: Amount; expense: Amount; net: Amount };
}

/** Baris crew directory: crew + role kanonik (untuk form & tabel). */
export interface CrewDirectoryRow {
  crew: Crew;
  role: CrewRole | null;
}

export type { DeliveryStatus, JobCategory, JobStatus, PaymentStatus };
