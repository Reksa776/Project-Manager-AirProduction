import type { Client, Job, Vendor } from "@/domain/types";

/**
 * Helper komposisi bersama (domain kanonik saja).
 * Tidak ada impor ke kontrak legacy, Google Sheets, maupun `@/lib/types`.
 */

export function buildLookup<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/**
 * Counterparty sebuah Job secara kanonik.
 * Selaras dengan invariant XOR: Job wajib memiliki Client ATAU Vendor, dan
 * `CanonicalJobRepository` menolak job yang melanggar aturan ini — sehingga
 * `null` di sini berarti data rusak dan dilaporkan eksplisit (bukan ditebak).
 */
export function resolveCounterparty(
  job: Job,
  clients: Map<string, Client>,
  vendors: Map<string, Vendor>,
): { type: "CLIENT" | "VENDOR"; id: string; name: string } | null {
  if (job.clientId) {
    return {
      type: "CLIENT",
      id: job.clientId,
      name: clients.get(job.clientId)?.name ?? "Client tidak dikenal",
    };
  }
  if (job.vendorId) {
    const vendor = vendors.get(job.vendorId);
    return {
      type: "VENDOR",
      id: job.vendorId,
      name: vendor?.name ?? "Vendor tidak dikenal",
    };
  }
  return null;
}
