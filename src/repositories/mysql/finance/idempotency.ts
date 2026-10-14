import { createHash } from "node:crypto";

import { parseAmount } from "@/domain/money";

/**
 * Sidik jari (SHA-256) payload kas yang kanonik.
 *
 * Dipakai bersama `cashflows.idempotency_key` (UNIQUE) untuk:
 * - replay request identik → mengembalikan baris yang sama (tidak ganda);
 * - kunci sama + payload berbeda → gagal eksplisit (konflik).
 *
 * Nilai uang dinormalisasi lewat `parseAmount` sehingga "1000.5" dan "1000.50"
 * menghasilkan sidik jari yang sama.
 */
export function cashflowFingerprint(input: {
  jobId?: string;
  occurredOn: string;
  direction: string;
  category: string;
  amount: string;
  referenceType?: string;
  referenceId?: string;
  description: string;
  source?: string;
}): string {
  const canonical = JSON.stringify([
    input.jobId ?? null,
    input.occurredOn,
    input.direction,
    input.category,
    parseAmount(input.amount),
    input.referenceType ?? null,
    input.referenceId ?? null,
    input.description,
    input.source ?? "MANUAL",
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Deteksi error duplicate key PostgreSQL (SQLSTATE 23505). Drizzle
 * membungkus error driver sebagai `DrizzleQueryError` sehingga rantai `cause`
 * ditelusuri.
 */
export function isDuplicateEntryError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const candidate = current as {
      code?: string;
      errno?: number;
      message?: string;
      cause?: unknown;
    };
    if (candidate.code === "23505") return true;
    if (typeof candidate.message === "string" && /duplicate key/i.test(candidate.message)) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}
