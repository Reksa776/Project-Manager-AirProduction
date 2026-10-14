import type { Admin, SessionRecord } from "@/domain/types";
import type { MySqlRepositories } from "@/repositories/contract";

/**
 * Service Admin & Session KANONIK — PERSISTENCE SAJA.
 *
 * Contract v2 menjadikan kedua repository ini read-only, jadi service ini hanya
 * membaca. Login/logout, verifikasi password, cookie, dan otorisasi adalah
 * P1A/P1B: tidak ada autentikasi yang diimplementasikan (atau disimulasikan) di
 * sini, sesuai pembatasan scope P0C-3.
 */

export interface CanonicalAdminSessionService {
  listAdmins(): Promise<Admin[]>;
  getAdmin(id: string): Promise<Admin | null>;
  listSessions(): Promise<SessionRecord[]>;
  getSession(id: string): Promise<SessionRecord | null>;
  /** Lookup sesi berdasarkan hash token (tanpa memverifikasi masa berlaku). */
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
}

export function createAdminSessionService(
  repositories: MySqlRepositories,
): CanonicalAdminSessionService {
  const { admins, sessions } = repositories;

  return {
    listAdmins: () => admins.getAll(),
    getAdmin: (id) => admins.getById(id),
    listSessions: () => sessions.getAll(),
    getSession: (id) => sessions.getById(id),
    findSessionByTokenHash: (tokenHash) => sessions.getByTokenHash(tokenHash),
  };
}
