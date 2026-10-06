/**
 * Domain types untuk Air Production DB.
 *
 * Struktur tipe ini merepresentasikan bentuk data final yang nantinya
 * bersumber dari Google Sheets. Pada Phase 1 sumber data masih mock,
 * namun tipe domain sudah dikunci di sini agar UI tidak perlu berubah
 * ketika repository Google Sheets diimplementasikan.
 */

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/** Status pekerjaan. Hanya tiga nilai ini yang valid. */
export const JOB_STATUS = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

/**
 * Status delivery. Terpisah dari status Job dan tidak boleh disamakan.
 */
export const DELIVERY_STATUS = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;

export type DeliveryStatus =
  (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS];

/* -------------------------------------------------------------------------- */
/* Master                                                                     */
/* -------------------------------------------------------------------------- */

export interface Client {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface Venue {
  id: string;
  name: string;
  address?: string;
  city?: string;
  capacity?: number;
  notes?: string;
}

export interface Crew {
  id: string;
  name: string;
  role: string;
  /** Default payment yang tersimpan di master Crew. */
  defaultPayment: number;
  phone?: string;
}

export interface Admin {
  id: string;
  name: string;
  email: string;
}

/* -------------------------------------------------------------------------- */
/* Job                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Kategori pekerjaan. Digunakan untuk memisahkan pekerjaan Wedding
 * (mis. pada section "Incoming Wedding") dari pekerjaan lain.
 */
export const JOB_CATEGORY = {
  WEDDING: "WEDDING",
  PREWEDDING: "PREWEDDING",
  CORPORATE: "CORPORATE",
  EVENT: "EVENT",
  OTHER: "OTHER",
} as const;

export type JobCategory =
  (typeof JOB_CATEGORY)[keyof typeof JOB_CATEGORY];

/**
 * Job adalah entity pusat.
 *
 * Aturan: sebuah Job wajib memiliki `clientId` ATAU `vendorId`, tetapi
 * tidak boleh memiliki keduanya sekaligus.
 */
export interface Job {
  id: string;
  jobNumber: string;
  jobName: string;
  category: JobCategory;
  /** Terisi bila pekerjaan berasal dari Client. */
  clientId?: string;
  /** Terisi bila pekerjaan berasal dari Vendor. */
  vendorId?: string;
  venueId?: string;
  executionDate: string;
  status: JobStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Job - Crew assignment                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Assignment Crew pada sebuah Job.
 * Payment aktual Crew untuk suatu Job disimpan di sini, bukan di master Crew.
 */
export interface JobCrew {
  id: string;
  jobId: string;
  crewId: string;
  role: string;
  /** Payment aktual untuk assignment ini. */
  actualPayment: number;
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/* Delivery                                                                   */
/* -------------------------------------------------------------------------- */

export interface Delivery {
  id: string;
  jobId: string;
  name: string;
  deadline: string;
  status: DeliveryStatus;
  deliveredAt?: string;
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/* Finance                                                                    */
/* -------------------------------------------------------------------------- */

/** Termin pembayaran Client. Termin 1 = DP, Termin 2, Termin 3 = Pelunasan. */
export const CLIENT_PAYMENT_TERM = {
  TERMIN_1: "TERMIN_1",
  TERMIN_2: "TERMIN_2",
  TERMIN_3: "TERMIN_3",
} as const;

export type ClientPaymentTerm =
  (typeof CLIENT_PAYMENT_TERM)[keyof typeof CLIENT_PAYMENT_TERM];

export const PAYMENT_STATUS = {
  UNPAID: "UNPAID",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export interface ClientPayment {
  id: string;
  jobId: string;
  term: ClientPaymentTerm;
  amount: number;
  dueDate?: string;
  paidDate?: string;
  status: PaymentStatus;
}

/** Jenis pembayaran ke Vendor. */
export const VENDOR_PAYMENT_TYPE = {
  DP: "DP",
  PELUNASAN: "PELUNASAN",
} as const;

export type VendorPaymentType =
  (typeof VENDOR_PAYMENT_TYPE)[keyof typeof VENDOR_PAYMENT_TYPE];

export interface VendorPayment {
  id: string;
  jobId: string;
  type: VendorPaymentType;
  amount: number;
  dueDate?: string;
  paidDate?: string;
  status: PaymentStatus;
}

export interface Expense {
  id: string;
  jobId: string;
  description: string;
  category: string;
  amount: number;
  date: string;
}
