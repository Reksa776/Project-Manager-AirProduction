import type { Admin } from "@/lib/types";

/**
 * Mock data Admin untuk Topbar.
 * Belum ada authentication sungguhan pada Phase 1.
 */
export const admins: Admin[] = [
  {
    id: "ADM-001",
    name: "Admin Produksi",
    email: "admin@airproduction.id",
  },
];

/** Admin yang sedang aktif (mock). */
export const currentAdmin: Admin = admins[0];
