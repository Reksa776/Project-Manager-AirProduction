import type { Crew } from "@/lib/types";

/**
 * Mock data Crew.
 * `defaultPayment` adalah payment default yang tersimpan di master Crew.
 */
export const crew: Crew[] = [
  {
    id: "CRW-001",
    name: "Bagas Prasetya",
    role: "Photographer",
    defaultPayment: 1_500_000,
    phone: "0812-4455-6601",
  },
  {
    id: "CRW-002",
    name: "Dinda Larasati",
    role: "Videographer",
    defaultPayment: 1_750_000,
    phone: "0812-4455-6602",
  },
  {
    id: "CRW-003",
    name: "Rangga Wibowo",
    role: "Editor",
    defaultPayment: 2_000_000,
    phone: "0812-4455-6603",
  },
  {
    id: "CRW-004",
    name: "Sinta Maharani",
    role: "Photographer",
    defaultPayment: 1_400_000,
    phone: "0812-4455-6604",
  },
  {
    id: "CRW-005",
    name: "Yusuf Ramadhan",
    role: "Drone Operator",
    defaultPayment: 1_250_000,
    phone: "0812-4455-6605",
  },
  {
    id: "CRW-006",
    name: "Melati Anggraini",
    role: "Editor",
    defaultPayment: 1_600_000,
    phone: "0812-4455-6606",
  },
  {
    id: "CRW-007",
    name: "Hendra Gunawan",
    role: "Lighting",
    defaultPayment: 900_000,
    phone: "0812-4455-6607",
  },
];
