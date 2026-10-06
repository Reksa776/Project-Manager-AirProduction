import type { ClientPayment, Expense, VendorPayment } from "@/lib/types";

/**
 * Mock data finansial.
 * Hanya untuk visualisasi; belum ada kalkulasi bisnis final di Phase 1.
 *
 * Client Payment: Termin 1 = DP, Termin 2, Termin 3 = Pelunasan.
 * Vendor Payment: DP dan Pelunasan.
 */
export const clientPayments: ClientPayment[] = [
  {
    id: "CP-001",
    jobId: "JOB-001",
    term: "TERMIN_1",
    amount: 7_500_000,
    dueDate: "2026-09-10",
    paidDate: "2026-09-09",
    status: "PAID",
  },
  {
    id: "CP-002",
    jobId: "JOB-001",
    term: "TERMIN_2",
    amount: 7_500_000,
    dueDate: "2026-10-09",
    status: "PARTIAL",
  },
  {
    id: "CP-003",
    jobId: "JOB-001",
    term: "TERMIN_3",
    amount: 5_000_000,
    dueDate: "2026-10-24",
    status: "UNPAID",
  },
  {
    id: "CP-004",
    jobId: "JOB-002",
    term: "TERMIN_1",
    amount: 6_000_000,
    dueDate: "2026-10-05",
    paidDate: "2026-10-05",
    status: "PAID",
  },
  {
    id: "CP-005",
    jobId: "JOB-002",
    term: "TERMIN_2",
    amount: 6_000_000,
    dueDate: "2026-10-16",
    status: "UNPAID",
  },
  {
    id: "CP-006",
    jobId: "JOB-003",
    term: "TERMIN_1",
    amount: 3_000_000,
    dueDate: "2026-09-25",
    paidDate: "2026-09-24",
    status: "PAID",
  },
  {
    id: "CP-007",
    jobId: "JOB-005",
    term: "TERMIN_1",
    amount: 12_000_000,
    dueDate: "2026-10-01",
    paidDate: "2026-10-01",
    status: "PAID",
  },
];

export const vendorPayments: VendorPayment[] = [
  {
    id: "VP-001",
    jobId: "JOB-006",
    type: "DP",
    amount: 5_000_000,
    dueDate: "2026-09-15",
    paidDate: "2026-09-14",
    status: "PAID",
  },
  {
    id: "VP-002",
    jobId: "JOB-006",
    type: "PELUNASAN",
    amount: 5_000_000,
    dueDate: "2026-10-10",
    status: "UNPAID",
  },
  {
    id: "VP-003",
    jobId: "JOB-007",
    type: "DP",
    amount: 8_000_000,
    dueDate: "2026-09-05",
    paidDate: "2026-09-05",
    status: "PAID",
  },
  {
    id: "VP-004",
    jobId: "JOB-007",
    type: "PELUNASAN",
    amount: 8_000_000,
    dueDate: "2026-10-05",
    status: "PARTIAL",
  },
];

export const expenses: Expense[] = [
  {
    id: "EXP-001",
    jobId: "JOB-001",
    description: "Sewa lampu tambahan",
    category: "Peralatan",
    amount: 750_000,
    date: "2026-10-05",
  },
  {
    id: "EXP-002",
    jobId: "JOB-001",
    description: "Transport tim ke Grand Ballroom",
    category: "Transport",
    amount: 400_000,
    date: "2026-10-06",
  },
  {
    id: "EXP-003",
    jobId: "JOB-003",
    description: "Sewa drone cadangan",
    category: "Peralatan",
    amount: 600_000,
    date: "2026-10-04",
  },
  {
    id: "EXP-004",
    jobId: "JOB-005",
    description: "Konsumsi dan transport survei lokasi",
    category: "Operasional",
    amount: 350_000,
    date: "2026-10-02",
  },
  {
    id: "EXP-005",
    jobId: "JOB-006",
    description: "Penyimpanan hard disk arsip",
    category: "Penyimpanan",
    amount: 500_000,
    date: "2026-09-30",
  },
];
