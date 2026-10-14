/** Helper class name sederhana tanpa dependency tambahan. */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/**
 * Format nominal uang. Menerima `number` (legacy) maupun string desimal
 * kanonik (`Amount`, mis. "1500000.55") agar UI tidak perlu mengonversi dulu.
 */
export function formatCurrency(value: number | string): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return currencyFormatter.format(numeric);
}

/**
 * Normalisasi nominal dari input form menjadi `Amount` kanonik (2 desimal).
 * Menerima digit polos, mis. "1500000" atau "1500000.55". Pemisah ribuan
 * (spasi/koma) dilepas; titik yang lebih dari satu → invalid (tanpa menebak).
 * Mengembalikan `null` bila tidak valid sehingga pemanggil dapat menolaknya
 * eksplisit (tidak ada nilai karangan).
 */
export function parseAmountInput(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned).toFixed(2);
}

/** Apakah input jumlah (quantity) valid sebagai bilangan bulat non-negatif. */
export function parseQuantityInput(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[\s,]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Contoh keluaran: "08 Oktober 2026" */
export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return dateFormatter.format(date);
}

/** Contoh keluaran: "08 Okt 2026" */
export function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return shortDateFormatter.format(date);
}

/** Selisih hari dari hari ini ke tanggal target (negatif = sudah lewat). */
export function daysFromToday(value: string): number {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return 0;
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Label relatif sederhana untuk tenggat, contoh: "H-3" atau "Terlambat 2 hari". */
export function formatCountdown(value: string): string {
  const diff = daysFromToday(value);
  if (diff === 0) return "Hari ini";
  if (diff > 0) return `H-${diff}`;
  const late = Math.abs(diff);
  return `Terlambat ${late} hari`;
}
