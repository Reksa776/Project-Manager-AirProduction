import type { Client, Job, Vendor } from "@/lib/types";
import type { Counterparty } from "@/services/types";

export function buildLookup<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/**
 * Menentukan counterparty sebuah Job berdasarkan aturan:
 * Job wajib memiliki Client ATAU Vendor (tidak keduanya).
 */
export function resolveCounterparty(
  job: Job,
  clients: Map<string, Client>,
  vendors: Map<string, Vendor>,
): Counterparty {
  if (job.clientId) {
    return {
      type: "CLIENT",
      id: job.clientId,
      name: clients.get(job.clientId)?.name ?? "Client tidak dikenal",
    };
  }
  if (job.vendorId) {
    return {
      type: "VENDOR",
      id: job.vendorId,
      name: vendors.get(job.vendorId)?.name ?? "Vendor tidak dikenal",
    };
  }
  // Tidak seharusnya terjadi bila business rule dipatuhi.
  return { type: "UNKNOWN", name: "Tanpa Client/Vendor" };
}
