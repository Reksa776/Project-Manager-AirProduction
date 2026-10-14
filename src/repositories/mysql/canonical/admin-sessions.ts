import { eq } from "drizzle-orm";

import type { Database } from "@/db";
import { admins, sessions } from "@/db/schema";
import type { Admin, SessionRecord } from "@/domain/types";
import type {
  CanonicalAdminRepository,
  CanonicalSessionRepository,
} from "@/repositories/contract";
import {
  rowToCanonicalAdmin,
  rowToSessionRecord,
} from "@/repositories/mysql/canonical/mapping";

/**
 * Repository Admin & Session KANONIK (Contract v2).
 *
 * Contract v2 mendefinisikan keduanya sebagai READ-ONLY:
 * - `CanonicalAdminRepository = ReadRepository<Admin>`
 * - `CanonicalSessionRepository = ReadRepository<SessionRecord> + getByTokenHash`
 *
 * Karena itu tidak ada operasi tulis di sini. Assertion/authorization, hashing
 * token, pembuatan sesi login, dan logout adalah P1A/P1B — bukan P0C-3. Menambah
 * tulis di sini akan menciptakan jalur autentikasi kedua yang belum diotorisasi.
 */

async function getAdminById(db: Database, id: string): Promise<Admin | null> {
  const rows = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
  return rows[0] ? rowToCanonicalAdmin(rows[0]) : null;
}

export function createAdminRepository(resolveDb: () => Database): CanonicalAdminRepository {
  return {
    getAll: async () => (await resolveDb().select().from(admins)).map(rowToCanonicalAdmin),
    getById: (id) => getAdminById(resolveDb(), id),
  };
}

async function getSessionById(db: Database, id: string): Promise<SessionRecord | null> {
  const rows = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return rows[0] ? rowToSessionRecord(rows[0]) : null;
}

async function getSessionByTokenHash(
  db: Database,
  tokenHash: string,
): Promise<SessionRecord | null> {
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  return rows[0] ? rowToSessionRecord(rows[0]) : null;
}

export function createSessionRepository(
  resolveDb: () => Database,
): CanonicalSessionRepository {
  return {
    getAll: async () => (await resolveDb().select().from(sessions)).map(rowToSessionRecord),
    getById: (id) => getSessionById(resolveDb(), id),
    getByTokenHash: (tokenHash) => getSessionByTokenHash(resolveDb(), tokenHash),
  };
}
