import type { Client } from "@/lib/types";

/**
 * Mock data Client.
 * Hanya untuk visualisasi Phase 1 dan akan digantikan repository
 * Google Sheets pada phase berikutnya.
 */
export const clients: Client[] = [
  {
    id: "CLI-001",
    name: "Andrea & Lola",
    contactPerson: "Andrea Wijaya",
    phone: "0812-1100-2301",
    email: "andrea.lola@mail.com",
    notes: "Wedding di Grand Ballroom, minta hasil cinematic.",
  },
  {
    id: "CLI-002",
    name: "Hasna & Dio",
    contactPerson: "Hasna Pramudita",
    phone: "0813-2244-7788",
    email: "hasna.dio@mail.com",
    notes: "Sudah DP termin 1.",
  },
  {
    id: "CLI-003",
    name: "Rani & Bimo",
    contactPerson: "Rani Kusuma",
    phone: "0857-8899-1122",
    email: "rani.bimo@mail.com",
    notes: "Sesi prewedding di The Glass House.",
  },
  {
    id: "CLI-004",
    name: "Nadia & Yoga",
    contactPerson: "Nadia Safira",
    phone: "0821-3344-5566",
    email: "nadia.yoga@mail.com",
  },
  {
    id: "CLI-005",
    name: "PT Sinar Abadi",
    contactPerson: "Bagus Setiawan",
    phone: "021-5566-7788",
    email: "bagus@sinarabadi.co.id",
    notes: "Dokumentasi company profile.",
  },
  {
    id: "CLI-006",
    name: "Keluarga Hartono",
    contactPerson: "Yohana Hartono",
    phone: "0819-7788-9900",
    email: "yohana.h@mail.com",
    notes: "Acara syukuran keluarga.",
  },
];
