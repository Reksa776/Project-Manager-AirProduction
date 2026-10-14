import { randomUUID } from "node:crypto";

import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { getDb, type Database } from "@/db";
import { cashflows } from "@/db/schema";
import { parseAmount, subtractAmounts, type Amount } from "@/domain/money";
import { validateCashflow } from "@/domain/finance";
import type { CreateCashflowInput } from "@/domain/inputs";
import type {
  Cashflow,
  CashflowCategory,
  CashflowDirection,
  CashflowReferenceType,
} from "@/domain/types";
import type { CanonicalCashflowRepository } from "@/repositories/contract";
import {
  RepositoryConflictError,
  RepositoryError,
} from "@/repositories/mysql/errors";
import {
  cashflowFingerprint,
  isDuplicateEntryError,
} from "@/repositories/mysql/finance/idempotency";
import {
  rowToCashflow,
  type CashflowRow,
} from "@/repositories/mysql/finance/mapping";
import type { Executor } from "@/repositories/mysql/finance/executor";

/**
 * Repository Cashflow kanonik (Contract v2).
 *
 * - `cashflows` = satu-satunya sumber kebenaran kas.
 * - Uang dibaca/tulis sebagai `Amount` (string desimal) — tanpa floating point.
 * - Tulis idempoten: `idempotency_key` UNIQUE + sidik jari payload. Request
 *   identik → mengembalikan baris yang sama; kunci sama + payload berbeda →
 *   `RepositoryConflictError`. Perlombaan (race) ditangani oleh unique index
 *   di database, bukan cek in-memory.
 */

export interface CashflowFilter {
  jobId?: string;
  referenceType?: CashflowReferenceType;
  referenceId?: string;
  direction?: CashflowDirection;
  category?: CashflowCategory;
  from?: string;
  to?: string;
}

export interface CashflowTotals {
  income: Amount;
  expense: Amount;
  net: Amount;
}

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

function buildWhere(filter: CashflowFilter): SQL | undefined {
  const conditions: SQL[] = [];
  if (hasValue(filter.jobId)) conditions.push(eq(cashflows.jobId, filter.jobId));
  if (hasValue(filter.referenceType)) {
    conditions.push(eq(cashflows.referenceType, filter.referenceType));
  }
  if (hasValue(filter.referenceId)) {
    conditions.push(eq(cashflows.referenceId, filter.referenceId));
  }
  if (hasValue(filter.direction)) conditions.push(eq(cashflows.direction, filter.direction));
  if (hasValue(filter.category)) conditions.push(eq(cashflows.category, filter.category));
  if (hasValue(filter.from)) conditions.push(gte(cashflows.occurredOn, filter.from));
  if (hasValue(filter.to)) conditions.push(lte(cashflows.occurredOn, filter.to));
  if (conditions.length === 0) return undefined;
  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

function normalizeReference(
  type: string | undefined,
  id: string | undefined,
): { referenceType: CashflowReferenceType | null; referenceId: string | null } {
  const hasType = hasValue(type);
  const hasId = hasValue(id);
  if (hasType !== hasId) {
    throw new RepositoryError(
      "referenceType dan referenceId harus diisi bersama-sama atau kosong bersama-sama.",
    );
  }
  return {
    referenceType: hasType ? (type as CashflowReferenceType) : null,
    referenceId: hasId ? (id as string) : null,
  };
}

async function findRowByIdempotencyKey(
  executor: Executor,
  key: string,
): Promise<CashflowRow | null> {
  const rows = await executor
    .select()
    .from(cashflows)
    .where(eq(cashflows.idempotencyKey, key))
    .limit(1);
  return rows[0] ?? null;
}

async function findRowById(executor: Executor, id: string): Promise<CashflowRow | null> {
  const rows = await executor.select().from(cashflows).where(eq(cashflows.id, id)).limit(1);
  return rows[0] ?? null;
}

function resolveIdempotentReplay(existing: CashflowRow, fingerprint: string): Cashflow {
  if (existing.idempotencyFingerprint !== fingerprint) {
    throw new RepositoryConflictError(
      `Idempotency key '${existing.idempotencyKey}' sudah dipakai dengan payload yang berbeda; request ditolak untuk mencegah transaksi ganda/kontradiktif.`,
    );
  }
  return rowToCashflow(existing);
}

/**
 * Insert kas idempoten ke dalam `executor` (pool atau transaksi yang sudah ada).
 * Dipakai langsung oleh service agar satu operasi pembayaran = satu transaksi.
 */
export async function insertCashflow(
  executor: Executor,
  data: CreateCashflowInput,
): Promise<Cashflow> {
  const validation = validateCashflow({
    direction: data.direction,
    category: data.category,
    amount: data.amount,
    referenceType: data.referenceType,
    referenceId: data.referenceId,
  });
  if (!validation.ok) {
    throw new RepositoryError(`Cashflow tidak valid: ${validation.errors.join(" ")}`);
  }

  const amount = parseAmount(data.amount);
  const description = data.description.trim();
  if (description === "") {
    throw new RepositoryError("Deskripsi cashflow wajib diisi.");
  }
  const jobId = hasValue(data.jobId) ? data.jobId : null;
  const { referenceType, referenceId } = normalizeReference(
    data.referenceType,
    data.referenceId,
  );
  const source = data.source ?? "MANUAL";
  const key = hasValue(data.idempotencyKey) ? data.idempotencyKey.trim() : null;
  const fingerprint = key
    ? cashflowFingerprint({
        jobId: jobId ?? undefined,
        occurredOn: data.occurredOn,
        direction: data.direction,
        category: data.category,
        amount,
        referenceType: referenceType ?? undefined,
        referenceId: referenceId ?? undefined,
        description,
        source,
      })
    : null;

  // TIDAK ada pre-check SELECT: di dalam transaksi REPEATABLE READ, pre-read
  // akan membekukan snapshot sebelum pemenang balapan commit sehingga re-read
  // tidak melihat baris pemenang. Sebagai gantinya, andalkan UNIQUE index:
  // insert → duplikat (jika ada) → baca ulang SETELAH commit pemenang.
  const id = randomUUID();
  try {
    await executor.insert(cashflows).values({
      id,
      jobId,
      occurredOn: data.occurredOn,
      direction: data.direction,
      category: data.category,
      amount,
      description,
      referenceType,
      referenceId,
      source,
      idempotencyKey: key,
      idempotencyFingerprint: fingerprint,
    });
  } catch (error) {
    // Perlombaan: dua request dengan kunci sama. Yang kalah mendapat duplicate
    // entry → baca ulang baris pemenang dan tentukan replay vs konflik.
    if (key && isDuplicateEntryError(error)) {
      const existing = await findRowByIdempotencyKey(executor, key);
      if (existing) return resolveIdempotentReplay(existing, fingerprint!);
    }
    throw error;
  }

  const row = await findRowById(executor, id);
  if (!row) throw new RepositoryError("Gagal membaca ulang cashflow yang baru dibuat.");
  return rowToCashflow(row);
}

/** Total kas terbayar untuk sebuah referensi (client/vendor/job_crew). */
export async function sumPaidForReference(
  executor: Executor,
  referenceType: CashflowReferenceType,
  referenceId: string,
): Promise<Amount> {
  const rows = await executor
    .select({
      total: sql<string>`cast(coalesce(sum(${cashflows.amount}), 0) as char)`,
    })
    .from(cashflows)
    .where(
      and(eq(cashflows.referenceType, referenceType), eq(cashflows.referenceId, referenceId)),
    );
  return parseAmount(rows[0]?.total ?? "0.00");
}

async function queryCashflows(db: Database, filter: CashflowFilter): Promise<Cashflow[]> {
  const rows = await db
    .select()
    .from(cashflows)
    .where(buildWhere(filter))
    .orderBy(cashflows.occurredOn, cashflows.createdAt);
  return rows.map(rowToCashflow);
}

async function totalCashflows(db: Database, filter: CashflowFilter): Promise<CashflowTotals> {
  const rows = await db
    .select({
      income: sql<string>`cast(coalesce(sum(case when ${cashflows.direction} = 'INCOME' then ${cashflows.amount} else 0 end), 0) as char)`,
      expense: sql<string>`cast(coalesce(sum(case when ${cashflows.direction} = 'EXPENSE' then ${cashflows.amount} else 0 end), 0) as char)`,
    })
    .from(cashflows)
    .where(buildWhere(filter));
  const income = parseAmount(rows[0]?.income ?? "0.00");
  const expense = parseAmount(rows[0]?.expense ?? "0.00");
  return { income, expense, net: subtractAmounts(income, expense) };
}

export interface MySqlCashflowRepository extends CanonicalCashflowRepository {
  query(filter: CashflowFilter): Promise<Cashflow[]>;
  totals(filter: CashflowFilter): Promise<CashflowTotals>;
}

/**
 * Factory repository cashflow dengan resolusi koneksi eksplisit.
 *
 * `resolveDb` dipanggil per operasi (bukan saat import) sehingga:
 * - modul ini TIDAK membuka koneksi saat di-import;
 * - factory kanonik (P0C-3) dapat menyuntikkan koneksi yang sama ke seluruh
 *   repository tanpa mengubah singleton lama.
 */
export function createCashflowRepository(
  resolveDb: () => Database,
): MySqlCashflowRepository {
  return {
    getAll: () => queryCashflows(resolveDb(), {}),
    getById: async (id) => {
      const row = await findRowById(resolveDb(), id);
      return row ? rowToCashflow(row) : null;
    },
    getByJobId: (jobId) => queryCashflows(resolveDb(), { jobId }),
    create: (data) => insertCashflow(resolveDb(), data),
    query: (filter) => queryCashflows(resolveDb(), filter),
    totals: (filter) => totalCashflows(resolveDb(), filter),
  };
}

/** Singleton lama (resolusi koneksi lazy lewat `getDb()`, bukan saat import). */
export const mysqlCashflows: MySqlCashflowRepository = createCashflowRepository(getDb);
