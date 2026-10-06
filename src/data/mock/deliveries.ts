import type { Delivery } from "@/lib/types";

/**
 * Mock data Delivery.
 * Delivery memiliki status sendiri dan tidak boleh disamakan dengan status Job.
 */
export const deliveries: Delivery[] = [
  {
    id: "DLV-001",
    jobId: "JOB-001",
    name: "Highlight Video",
    deadline: "2026-10-08",
    status: "IN_PROGRESS",
    notes: "Revisi color grading tahap akhir.",
  },
  {
    id: "DLV-002",
    jobId: "JOB-001",
    name: "Full Video",
    deadline: "2026-10-20",
    status: "NOT_STARTED",
  },
  {
    id: "DLV-003",
    jobId: "JOB-001",
    name: "Foto Editing (500 file)",
    deadline: "2026-10-15",
    status: "IN_PROGRESS",
  },
  {
    id: "DLV-004",
    jobId: "JOB-003",
    name: "Cinematic Prewedding",
    deadline: "2026-10-12",
    status: "IN_PROGRESS",
    notes: "Menunggu pilihan lagu dari client.",
  },
  {
    id: "DLV-005",
    jobId: "JOB-005",
    name: "Company Profile Cut 3 Menit",
    deadline: "2026-10-16",
    status: "NOT_STARTED",
  },
  {
    id: "DLV-006",
    jobId: "JOB-006",
    name: "Highlight Video",
    deadline: "2026-10-01",
    status: "COMPLETED",
    deliveredAt: "2026-09-30",
  },
  {
    id: "DLV-007",
    jobId: "JOB-007",
    name: "Full Video Sinematik",
    deadline: "2026-09-30",
    status: "COMPLETED",
    deliveredAt: "2026-09-29",
  },
  {
    id: "DLV-008",
    jobId: "JOB-004",
    name: "Highlight Video",
    deadline: "2026-11-02",
    status: "NOT_STARTED",
  },
  {
    id: "DLV-009",
    jobId: "JOB-008",
    name: "Dokumentasi Foto",
    deadline: "2026-10-18",
    status: "NOT_STARTED",
  },
];
