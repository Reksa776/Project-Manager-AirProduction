import type {
  ClientPayment,
  Crew,
  Delivery,
  Expense,
  Job,
  JobCategory,
  JobCrew,
  JobStatus,
  VendorPayment,
  Venue,
} from "@/lib/types";

/**
 * View model yang dipakai UI.
 *
 * UI tidak membaca entity mentah secara langsung, melainkan memakai tipe
 * di file ini agar perubahan sumber data tidak membocorkan ke komponen.
 */

export type CounterpartyType = "CLIENT" | "VENDOR" | "UNKNOWN";

export interface Counterparty {
  type: CounterpartyType;
  id?: string;
  name: string;
}

export interface JobListItem {
  id: string;
  jobNumber: string;
  jobName: string;
  category: JobCategory;
  counterparty: Counterparty;
  venueName?: string;
  executionDate: string;
  status: JobStatus;
}

export interface JobCrewAssignment {
  assignment: JobCrew;
  crew: Crew | null;
}

export interface JobDetail {
  job: Job;
  counterparty: Counterparty;
  venue: Venue | null;
  assignments: JobCrewAssignment[];
  deliveries: Delivery[];
  clientPayments: ClientPayment[];
  vendorPayments: VendorPayment[];
  expenses: Expense[];
}

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
  venueName?: string;
  executionDate: string;
  status: JobStatus;
}

export interface IncomingEditingItem {
  deliveryId: string;
  deliveryName: string;
  jobNumber: string;
  jobName: string;
  deadline: string;
  status: Delivery["status"];
}

export interface DashboardData {
  summary: DashboardSummary;
  incomingWeddings: IncomingWeddingItem[];
  incomingEditing: IncomingEditingItem[];
}
