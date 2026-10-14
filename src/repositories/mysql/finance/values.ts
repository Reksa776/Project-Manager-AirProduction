import { parseAmount, toMinorUnits, type Amount } from "@/domain/money";
import { RepositoryError } from "@/repositories/mysql/errors";

/** Normalisasi jumlah uang yang wajib > 0 (mis. nominal jadwal/kas). */
export function requirePositiveAmount(value: string, field: string): Amount {
  let parsed: Amount;
  try {
    parsed = parseAmount(value);
  } catch {
    throw new RepositoryError(`Nilai '${field}' bukan angka uang yang valid: ${String(value)}.`);
  }
  if (toMinorUnits(parsed) <= BigInt(0)) {
    throw new RepositoryError(`Nilai '${field}' harus lebih besar dari 0 (didapat ${parsed}).`);
  }
  return parsed;
}

/** Normalisasi jumlah uang yang boleh 0 (mis. kesepakatan crew). */
export function requireNonNegativeAmount(value: string, field: string): Amount {
  let parsed: Amount;
  try {
    parsed = parseAmount(value);
  } catch {
    throw new RepositoryError(`Nilai '${field}' bukan angka uang yang valid: ${String(value)}.`);
  }
  if (toMinorUnits(parsed) < BigInt(0)) {
    throw new RepositoryError(`Nilai '${field}' tidak boleh negatif (didapat ${parsed}).`);
  }
  return parsed;
}
