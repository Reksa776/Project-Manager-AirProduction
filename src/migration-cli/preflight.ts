import mysql, { type RowDataPacket } from "mysql2/promise";

import { getMySqlSourceUrl } from "@/db/env";

/**
 * PREFLIGHT MySQL PRODUKSI — READ ONLY (P0D-2A §9).
 *
 * Jaminan:
 * - Hanya `SELECT` / `information_schema`. Setiap statement diverifikasi oleh
 *   `assertReadOnlyQuery` sebelum dijalankan; DDL/DML apa pun melempar error.
 * - Hanya boleh dijalankan terhadap `database-airprod`
 *   (`assertPreflightDatabaseAllowed`); database test/lain ditolak.
 * - Tidak menerapkan migration `0001` dan tidak menulis data.
 * - Tidak pernah mencetak kredensial atau connection string.
 */

export const PRODUCTION_DATABASE = "database-airprod";

/** Nama database dari connection string (tanpa mencetak URL). */
export function databaseNameFromUrl(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

/** Guard: preflight hanya untuk database produksi yang dituju. */
export function assertPreflightDatabaseAllowed(databaseName: string): void {
  if (databaseName !== PRODUCTION_DATABASE) {
    throw new Error(
      `STOP: preflight hanya boleh membaca '${PRODUCTION_DATABASE}', bukan '${databaseName}'.`,
    );
  }
}

const READ_ONLY_PREFIX = /^\s*(select|show)\b/i;
const READ_ONLY_SCHEMA = /information_schema/i;

/** Guard: statement apa pun selain SELECT/SHOW/information_schema ditolak. */
export function assertReadOnlyQuery(sql: string): void {
  if (!READ_ONLY_PREFIX.test(sql) && !READ_ONLY_SCHEMA.test(sql)) {
    throw new Error("STOP: preflight hanya mengizinkan query baca (SELECT/information_schema).");
  }
  if (/\b(insert|update|delete|alter|drop|create|truncate|replace|grant|revoke)\b/i.test(sql)) {
    throw new Error("STOP: query preflight memuat kata kunci penulisan (DDL/DML) — ditolak.");
  }
}

/** Guard identifier tabel (mencegah injeksi saat menyusun COUNT per tabel). */
export function assertSafeIdentifier(identifier: string): void {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error("STOP: identifier tabel tidak aman.");
  }
}

export interface TableRowCount {
  table: string;
  rowCount: number;
}

export interface ColumnInfo {
  table: string;
  column: string;
  nullable: "YES" | "NO";
  columnType: string;
  columnDefault: string | null;
}

export interface IndexInfo {
  table: string;
  index: string;
  column: string;
  unique: boolean;
}

export interface MigrationJournalRow {
  id: number;
  hash: string;
  createdAt: number;
}

export interface PreflightReport {
  database: string;
  tableCount: number;
  tables: TableRowCount[];
  journal: MigrationJournalRow[];
  cashflowsJobIdNullable: "YES" | "NO" | null;
  idempotencyColumnsPresent: { idempotencyKey: boolean; idempotencyFingerprint: boolean };
  uniqueIdempotencyIndexPresent: boolean;
  cashflowsForeignKeys: string[];
  defaults: { crewDefaultPayment: string | null; jobCrewsAgreedAmount: string | null };
  schemaDrift: string[];
  /** Tabrakan ID sumber dengan target; `null` = BLOCKED (snapshot belum ada). */
  plannedSourceCollisions: null;
}

export interface ChecklistItem {
  id: string;
  requirement: string;
  satisfied: boolean | null;
  evidence: string;
}

const MIGRATION_0001_TARGET_COLUMNS = ["idempotency_key", "idempotency_fingerprint"];

/** Preflight baca-sajar terhadap database produksi. */
export async function runProductionPreflight(): Promise<PreflightReport> {
  const url = getMySqlSourceUrl();
  const database = databaseNameFromUrl(url);
  assertPreflightDatabaseAllowed(database);

  const conn = await mysql.createConnection({ uri: url });
  try {
    const query = async <T extends RowDataPacket[]>(sql: string, params: unknown[] = []): Promise<T> => {
      assertReadOnlyQuery(sql);
      const [rows] = await conn.query<T>(sql, params);
      return rows;
    };

    const tableRows = await query<RowDataPacket[]>(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME",
      [database],
    );
    const tables: TableRowCount[] = [];
    for (const row of tableRows) {
      const name = String(row.name);
      assertSafeIdentifier(name);
      const [counted] = await query<RowDataPacket[]>(
        `SELECT COUNT(*) AS rowCount FROM \`${name}\``,
      );
      tables.push({ table: name, rowCount: Number(counted?.rowCount ?? 0) });
    }

    const columns = await query<RowDataPacket[]>(
      "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, IS_NULLABLE AS nullable, COLUMN_TYPE AS columnType, COLUMN_DEFAULT AS columnDefault FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION",
      [database],
    );
    const columnsInfo: ColumnInfo[] = columns.map((row) => ({
      table: String(row.tableName),
      column: String(row.columnName),
      nullable: String(row.nullable) === "NO" ? "NO" : "YES",
      columnType: String(row.columnType),
      columnDefault: row.columnDefault === null ? null : String(row.columnDefault),
    }));

    const indexes = await query<RowDataPacket[]>(
      "SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName, COLUMN_NAME AS columnName, NON_UNIQUE AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX",
      [database],
    );
    const indexInfo: IndexInfo[] = indexes.map((row) => ({
      table: String(row.tableName),
      index: String(row.indexName),
      column: String(row.columnName),
      unique: Number(row.nonUnique) === 0,
    }));

    const fks = await query<RowDataPacket[]>(
      "SELECT CONSTRAINT_NAME AS name, COLUMN_NAME AS columnName, REFERENCED_TABLE_NAME AS referencedTable, REFERENCED_COLUMN_NAME AS referencedColumn FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cashflows' AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY CONSTRAINT_NAME",
      [database],
    );

    let journal: MigrationJournalRow[] = [];
    if (tables.some((table) => table.table === "__drizzle_migrations")) {
      const journalRows = await query<RowDataPacket[]>(
        "SELECT id, hash, created_at FROM `__drizzle_migrations` ORDER BY id",
      );
      journal = journalRows.map((row) => ({
        id: Number(row.id),
        hash: String(row.hash),
        createdAt: Number(row.created_at),
      }));
    }

    const cashflowsJobId = columnsInfo.find(
      (column) => column.table === "cashflows" && column.column === "job_id",
    );
    const idempotencyColumnsPresent = {
      idempotencyKey: columnsInfo.some(
        (column) => column.table === "cashflows" && column.column === MIGRATION_0001_TARGET_COLUMNS[0],
      ),
      idempotencyFingerprint: columnsInfo.some(
        (column) => column.table === "cashflows" && column.column === MIGRATION_0001_TARGET_COLUMNS[1],
      ),
    };
    const uniqueIdempotencyIndexPresent = indexInfo.some(
      (index) =>
        index.table === "cashflows" &&
        index.unique &&
        index.column === MIGRATION_0001_TARGET_COLUMNS[0],
    );

    const schemaDrift: string[] = [];
    if (cashflowsJobId === undefined) schemaDrift.push("Kolom cashflows.job_id tidak ditemukan.");
    if (cashflowsJobId !== undefined && cashflowsJobId.nullable !== "NO") {
      schemaDrift.push("cashflows.job_id sudah nullable — migration 0001 mungkin SUDAH diterapkan.");
    }
    if (idempotencyColumnsPresent.idempotencyKey || idempotencyColumnsPresent.idempotencyFingerprint) {
      schemaDrift.push("Kolom idempotensi sudah ada — migration 0001 mungkin SUDAH diterapkan.");
    }
    if (journal.length > 1) {
      schemaDrift.push(`Journal memuat ${journal.length} migration (diharapkan 1: 0000).`);
    }

    return {
      database,
      tableCount: tables.length,
      tables,
      journal,
      cashflowsJobIdNullable: cashflowsJobId?.nullable ?? null,
      idempotencyColumnsPresent,
      uniqueIdempotencyIndexPresent,
      cashflowsForeignKeys: fks.map(
        (row) =>
          `${String(row.name)}: ${String(row.columnName)} → ${String(row.referencedTable)}.${String(row.referencedColumn)}`,
      ),
      defaults: {
        crewDefaultPayment:
          columnsInfo.find((column) => column.table === "crew" && column.column === "default_payment")
            ?.columnDefault ?? null,
        jobCrewsAgreedAmount:
          columnsInfo.find(
            (column) => column.table === "job_crews" && column.column === "agreed_amount",
          )?.columnDefault ?? null,
      },
      schemaDrift,
      plannedSourceCollisions: null,
    };
  } finally {
    await conn.end();
  }
}

/**
 * Checklist kesiapan eksekusi P0D-2B. `satisfied: null` berarti tidak dapat
 * diverifikasi secara baca-sajar (mis. backup/restore rehearsal, jendela
 * pemeliharaan, persetujuan tertulis) — TIDAK dianggap terpenuhi.
 */
export function buildP0D2BReadinessChecklist(report: PreflightReport): ChecklistItem[] {
  return [
    {
      id: "P0D2B-1",
      requirement: "Journal produksi hanya memuat 0000 (0001 belum diterapkan).",
      satisfied: report.journal.length === 1,
      evidence: `journal rows: ${report.journal.length}`,
    },
    {
      id: "P0D2B-2",
      requirement: "Baseline: cashflows.job_id masih NOT NULL.",
      satisfied: report.cashflowsJobIdNullable === "NO",
      evidence: `IS_NULLABLE=${report.cashflowsJobIdNullable ?? "tidak ditemukan"}`,
    },
    {
      id: "P0D2B-3",
      requirement: "Baseline: kolom idempotensi belum ada.",
      satisfied:
        !report.idempotencyColumnsPresent.idempotencyKey &&
        !report.idempotencyColumnsPresent.idempotencyFingerprint,
      evidence: `idempotency_key=${report.idempotencyColumnsPresent.idempotencyKey}, idempotency_fingerprint=${report.idempotencyColumnsPresent.idempotencyFingerprint}`,
    },
    {
      id: "P0D2B-4",
      requirement: "Baseline: belum ada UNIQUE index idempotensi pada cashflows.",
      satisfied: !report.uniqueIdempotencyIndexPresent,
      evidence: `unique idempotency index: ${report.uniqueIdempotencyIndexPresent}`,
    },
    {
      id: "P0D2B-5",
      requirement: "Tidak ada schema drift yang tak terduga.",
      satisfied: report.schemaDrift.length === 0,
      evidence: report.schemaDrift.length === 0 ? "tidak ada drift" : report.schemaDrift.join(" | "),
    },
    {
      id: "P0D2B-6",
      requirement: "Baseline jumlah baris per tabel direkam (untuk verifikasi pasca-migrasi).",
      satisfied: report.tables.length > 0,
      evidence: `${report.tables.length} tabel dihitung`,
    },
    {
      id: "P0D2B-7",
      requirement: "Dump logis backup + rehearsal restore telah dilakukan.",
      satisfied: null,
      evidence: "Tidak dapat diverifikasi secara baca-sajar — memerlukan tindakan operator.",
    },
    {
      id: "P0D2B-8",
      requirement: "Jendela pemeliharaan & operator ditetapkan.",
      satisfied: null,
      evidence: "Tidak dapat diverifikasi secara baca-sajar — menunggu keputusan owner.",
    },
    {
      id: "P0D2B-9",
      requirement: "Persetujuan tertulis untuk roll-out 0001 (dan eksekusi impor) diberikan.",
      satisfied: null,
      evidence: "Belum diminta dan belum diberikan.",
    },
    {
      id: "P0D2B-10",
      requirement: "Dry-run dari snapshot NYATA dihasilkan dan direview.",
      satisfied: null,
      evidence:
        "BLOCKED: snapshot nyata belum tersedia (kredensial read-only tidak ada). Tidak ada dry-run nyata yang diklaim.",
    },
    {
      id: "P0D2B-11",
      requirement: "Keputusan D1–D12 disetujui atau barisnya dikecualikan.",
      satisfied: null,
      evidence: "Lihat docs/MIGRATION-DECISION-REGISTER.md — semua keputusan belum disetujui.",
    },
    {
      id: "P0D2B-12",
      requirement: "Tabrakan ID sumber dengan target diperiksa.",
      satisfied: null,
      evidence:
        "BLOCKED: memerlukan snapshot nyata; `plannedSourceCollisions` bernilai null (tidak ditebak).",
    },
  ];
}
