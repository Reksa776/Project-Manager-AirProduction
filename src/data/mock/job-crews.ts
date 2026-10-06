import type { JobCrew } from "@/lib/types";

/**
 * Mock data assignment Job - Crew.
 * `actualPayment` adalah payment aktual crew untuk Job tersebut,
 * berbeda dari `defaultPayment` di master Crew.
 */
export const jobCrews: JobCrew[] = [
  {
    id: "JC-001",
    jobId: "JOB-001",
    crewId: "CRW-001",
    role: "Photographer",
    actualPayment: 1_600_000,
  },
  {
    id: "JC-002",
    jobId: "JOB-001",
    crewId: "CRW-002",
    role: "Videographer",
    actualPayment: 1_900_000,
  },
  {
    id: "JC-003",
    jobId: "JOB-001",
    crewId: "CRW-005",
    role: "Drone Operator",
    actualPayment: 1_300_000,
  },
  {
    id: "JC-004",
    jobId: "JOB-001",
    crewId: "CRW-007",
    role: "Lighting",
    actualPayment: 950_000,
  },
  {
    id: "JC-005",
    jobId: "JOB-003",
    crewId: "CRW-004",
    role: "Photographer",
    actualPayment: 1_450_000,
  },
  {
    id: "JC-006",
    jobId: "JOB-003",
    crewId: "CRW-005",
    role: "Drone Operator",
    actualPayment: 1_250_000,
  },
  {
    id: "JC-007",
    jobId: "JOB-005",
    crewId: "CRW-002",
    role: "Videographer",
    actualPayment: 1_800_000,
    notes: "Termasuk sesi wawancara direksi.",
  },
  {
    id: "JC-008",
    jobId: "JOB-006",
    crewId: "CRW-001",
    role: "Photographer",
    actualPayment: 1_500_000,
  },
  {
    id: "JC-009",
    jobId: "JOB-006",
    crewId: "CRW-003",
    role: "Editor",
    actualPayment: 2_100_000,
  },
  {
    id: "JC-010",
    jobId: "JOB-007",
    crewId: "CRW-002",
    role: "Videographer",
    actualPayment: 2_000_000,
  },
];
