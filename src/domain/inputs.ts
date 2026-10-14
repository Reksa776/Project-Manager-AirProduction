import type { Amount } from "./money";
import type {
  CashflowCategory,
  CashflowDirection,
  CashflowReferenceType,
  CashflowSource,
  ClientPaymentTerm,
  ClientType,
  DeliveryStatus,
  JobCategory,
  JobStatus,
  VendorPaymentType,
} from "./types";

/**
 * Input kanonik untuk operasi write (P0C-1 mendefinisikan bentuknya;
 * implementasi live = P0C-2). Timestamp & ID dihasilkan oleh DB/repository.
 */

export interface CreateClientInput {
  name: string;
  companyName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  clientType?: ClientType;
  notes?: string;
}

export interface CreatePackageInput {
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateVendorInput {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface CreateCrewRoleInput {
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateCrewInput {
  name: string;
  crewRoleId: string;
  defaultPayment: Amount;
  phone?: string;
  notes?: string;
}

export interface CreateJobInput {
  jobNumber?: string;
  jobName: string;
  category: JobCategory;
  clientId?: string;
  vendorId?: string;
  packageId?: string;
  executionDate: string;
  status: JobStatus;
  location?: string;
  notes?: string;
  /** Snapshot histori; venue bukan entity aktif. */
  legacyVenueName?: string;
}

export interface CreateDeliveryInput {
  jobId: string;
  name: string;
  deliveryType?: string;
  quantity?: number;
  deadline: string;
  status: DeliveryStatus;
  deliveredAt?: string;
  notes?: string;
}

export interface CreateJobCrewAssignmentInput {
  jobId: string;
  crewId: string;
  /** null = mengikuti role master crew. */
  crewRoleId: string | null;
  agreedAmount: Amount;
  notes?: string;
}

export interface CreateClientPaymentScheduleInput {
  jobId: string;
  term: ClientPaymentTerm;
  amount: Amount;
  dueDate?: string;
  paidDate?: string;
  notes?: string;
}

export interface CreateVendorPaymentScheduleInput {
  jobId: string;
  type: VendorPaymentType;
  amount: Amount;
  dueDate?: string;
  paidDate?: string;
  notes?: string;
}

export interface CreateCashflowInput {
  /** Kosong = biaya operasional tanpa Job (P0C-2: `job_id` nullable). */
  jobId?: string;
  occurredOn: string;
  direction: CashflowDirection;
  category: CashflowCategory;
  amount: Amount;
  description: string;
  referenceType?: CashflowReferenceType;
  referenceId?: string;
  source?: CashflowSource;
  /** Kunci idempotensi aplikatif (tidak ada kolom DB-nya saat ini). */
  idempotencyKey?: string;
}

export interface CreateAdminInput {
  name: string;
  email: string;
  passwordHash: string;
}
