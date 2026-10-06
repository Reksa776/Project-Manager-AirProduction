import type { Vendor } from "@/lib/types";

/**
 * Mock data Vendor.
 * Vendor adalah pihak yang memberi pekerjaan kepada Air Production.
 */
export const vendors: Vendor[] = [
  {
    id: "VND-001",
    name: "Lumina Pictures",
    contactPerson: "Fajar Nugroho",
    phone: "0811-2233-4455",
    email: "produksi@luminapictures.id",
    notes: "Vendor tetap untuk kebutuhan sinematik.",
  },
  {
    id: "VND-002",
    name: "Kirana Wedding Organizer",
    contactPerson: "Ratih Puspita",
    phone: "0812-6677-8899",
    email: "hello@kiranawedding.id",
    notes: "Bekerja sama untuk paket dokumentasi wedding.",
  },
  {
    id: "VND-003",
    name: "Aria Event Organizer",
    contactPerson: "Dimas Anggara",
    phone: "0856-1122-3344",
    email: "project@ariaeo.co.id",
  },
  {
    id: "VND-004",
    name: "Nusantara Live",
    contactPerson: "Sekar Ayu",
    phone: "0877-5566-7788",
    email: "ops@nusantaralive.com",
    notes: "Dokumentasi event musik.",
  },
];
