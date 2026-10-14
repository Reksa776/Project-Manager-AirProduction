/**
 * Representasi uang untuk domain kanonik (P0C-1).
 *
 * KEPUTUSAN:
 * - Uang direpresentasikan sebagai **string desimal** (`Amount`), bukan
 *   `number`, agar tidak ada IEEE-754 floating point error. Format kanonik:
 *   `[-]<digit+>.<2 digit>` (mis. `"1500000.55"`, `"0.00"`, `"-250.00"`).
 * - Seluruh aritmetika dilakukan pada **minor units** (sen) memakai `BigInt`,
 *   sehingga aman untuk nilai besar (kolom DB `decimal(15,2)`).
 * - KEBIJAKAN PEMBULATAN: **half-up (menjauh dari nol) ke 2 desimal**.
 *   Input dengan lebih dari 2 desimal dibulatkan sekali saat parsing.
 * - `BigInt` dipakai tanpa literal (`BigInt(10)`) agar tetap kompatibel
 *   dengan target TypeScript repo ini (ES2017) tanpa mengubah `tsconfig`.
 */

/** String desimal kanonik; selalu 2 angka desimal. */
export type Amount = string;

/** Kebijakan pembulatan yang berlaku di seluruh domain. */
export const ROUNDING_POLICY = "half-up (away from zero) to 2 decimal places" as const;

/** Skala desimal kanonik untuk uang. */
export const AMOUNT_SCALE = 2 as const;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

const AMOUNT_PATTERN = /^[+-]?\d+(\.\d+)?$/;

const ZERO = BigInt(0);
const TWO = BigInt(2);
const TEN = BigInt(10);
const HUNDRED = BigInt(100);

function pad2(value: bigint): string {
  return value.toString().padStart(2, "0");
}

/**
 * Parse input (string/number) menjadi minor units (sen) sebagai `BigInt`.
 * Melempar `MoneyError` untuk nilai non-numerik / tidak hingga.
 */
export function toMinorUnits(input: string | number): bigint {
  let raw: string;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      throw new MoneyError(`Nilai uang tidak valid: ${String(input)}.`);
    }
    raw = input.toString();
  } else {
    raw = input.trim();
  }

  if (raw === "" || !AMOUNT_PATTERN.test(raw)) {
    throw new MoneyError(`Nilai uang tidak valid: '${String(input)}'.`);
  }

  const negative = raw.startsWith("-");
  const body = raw.replace(/^[+-]/, "");
  const [intPart, fracPart = ""] = body.split(".");
  const digits = `${intPart}${fracPart}`;
  let value = digits === "" ? ZERO : BigInt(digits);
  const scale = fracPart.length;

  if (scale > AMOUNT_SCALE) {
    const divisor = TEN ** BigInt(scale - AMOUNT_SCALE);
    const remainder = value % divisor;
    value /= divisor;
    if (remainder * TWO >= divisor) {
      value += BigInt(1); // half-up
    }
  } else if (scale < AMOUNT_SCALE) {
    value *= TEN ** BigInt(AMOUNT_SCALE - scale);
  }

  return negative ? -value : value;
}

/** Format minor units menjadi `Amount` kanonik (2 desimal). */
export function fromMinorUnits(minor: bigint): Amount {
  const negative = minor < ZERO;
  const abs = negative ? -minor : minor;
  const intPart = abs / HUNDRED;
  const frac = abs % HUNDRED;
  return `${negative ? "-" : ""}${intPart.toString()}.${pad2(frac)}`;
}

/** Validasi + normalisasi nilai menjadi `Amount` kanonik. */
export function parseAmount(input: string | number): Amount {
  return fromMinorUnits(toMinorUnits(input));
}

/** Apakah string adalah `Amount` kanonik (2 desimal). */
export function isCanonicalAmount(value: string): boolean {
  return /^[+-]?\d+\.\d{2}$/.test(value);
}

export function addAmounts(...amounts: readonly Amount[]): Amount {
  let total = ZERO;
  for (const amount of amounts) total += toMinorUnits(amount);
  return fromMinorUnits(total);
}

export function subtractAmounts(a: Amount, b: Amount): Amount {
  return fromMinorUnits(toMinorUnits(a) - toMinorUnits(b));
}

export function sumAmounts(amounts: readonly Amount[]): Amount {
  let total = ZERO;
  for (const amount of amounts) total += toMinorUnits(amount);
  return fromMinorUnits(total);
}

/** -1 | 0 | 1 */
export function compareAmounts(a: Amount, b: Amount): -1 | 0 | 1 {
  const left = toMinorUnits(a);
  const right = toMinorUnits(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function isZeroAmount(a: Amount): boolean {
  return toMinorUnits(a) === ZERO;
}

export function isNegativeAmount(a: Amount): boolean {
  return toMinorUnits(a) < ZERO;
}

/** Nilai positif wajib (mis. untuk nominal cashflow/schedule). */
export function assertPositiveAmount(amount: Amount, field: string): Amount {
  if (toMinorUnits(amount) <= ZERO) {
    throw new MoneyError(`Nilai '${field}' harus lebih besar dari 0 (didapat ${amount}).`);
  }
  return amount;
}

export const ZERO_AMOUNT: Amount = "0.00";
