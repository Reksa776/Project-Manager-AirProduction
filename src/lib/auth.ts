import "server-only";

import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { admins, sessions } from "@/db/schema";

export const SESSION_COOKIE = "airprod_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export interface AuthenticatedAdmin {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "STAFF";
}

function toMysqlDate(date: Date): string {
  return date.toISOString().slice(0, 23).replace("T", " ");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const derived = scryptSync(password, salt, 64, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  }).toString("base64url");
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived}`;
}

function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, nRaw, rRaw, pRaw, salt, expectedRaw] = encoded.split("$");
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (
    algorithm !== "scrypt" || !salt || !expectedRaw ||
    !Number.isInteger(n) || n < 16_384 || n > 131_072 ||
    !Number.isInteger(r) || r < 1 || r > 16 ||
    !Number.isInteger(p) || p < 1 || p > 4
  ) return false;

  try {
    const expected = Buffer.from(expectedRaw, "base64url");
    const actual = scryptSync(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: 128 * 1024 * 1024,
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function hasAdminAccount(): Promise<boolean> {
  const rows = await getDb().select({ id: admins.id }).from(admins).limit(1);
  return rows.length > 0;
}

export async function createInitialOwner(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ id: string; name: string; email: string }> {
  if (input.name.trim().length < 2 || input.name.trim().length > 120) {
    throw new Error("Nama harus berisi 2–120 karakter.");
  }
  const email = input.email.trim().toLowerCase();
  if (email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Alamat email tidak valid.");
  }
  if (input.password.length < 8 || input.password.length > 128) {
    throw new Error("Password harus berisi 8–128 karakter.");
  }

  const db = getDb();
  return db.transaction(async (tx) => {
    // PostgreSQL transaction-scoped advisory lock; GET_LOCK/RELEASE_LOCK are MySQL-only.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('airprod_admin_setup'))`);
    const existing = await tx.select({ id: admins.id }).from(admins).limit(1);
    if (existing.length) throw new Error("Akun Owner sudah dibuat. Silakan login.");

    const id = randomUUID();
    const name = input.name.trim();
    await tx.insert(admins).values({
      id,
      name,
      email,
      passwordHash: hashPassword(input.password),
      role: "OWNER",
      isActive: true,
    });
    return { id, name, email };
  });
}

export async function createLoginSession(emailInput: string, password: string): Promise<{
  admin: AuthenticatedAdmin;
  token: string;
}> {
  const email = emailInput.trim().toLowerCase();
  const rows = await getDb().select().from(admins).where(eq(admins.email, email)).limit(1);
  const admin = rows[0];
  if (!admin || !admin.isActive || !verifyPassword(password, admin.passwordHash)) {
    throw new Error("Email atau password salah.");
  }

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_SECONDS * 1000);
  await getDb().transaction(async (tx) => {
    await tx.insert(sessions).values({
      id: randomUUID(),
      adminId: admin.id,
      tokenHash: hashToken(token),
      expiresAt: toMysqlDate(expiresAt),
    });
    await tx.update(admins).set({ lastLoginAt: toMysqlDate(now) }).where(eq(admins.id, admin.id));
  });

  return {
    admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role as AuthenticatedAdmin["role"] },
    token,
  };
}

export async function getAuthenticatedAdmin(): Promise<AuthenticatedAdmin | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const now = toMysqlDate(new Date());
  const rows = await getDb()
    .select({
      id: admins.id,
      name: admins.name,
      email: admins.email,
      role: admins.role,
      isActive: admins.isActive,
    })
    .from(sessions)
    .innerJoin(admins, eq(sessions.adminId, admins.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, now)))
    .limit(1);
  const admin = rows[0];
  if (!admin?.isActive) return null;
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role as AuthenticatedAdmin["role"],
  };
}

export async function requireAuthenticatedAdmin(): Promise<AuthenticatedAdmin> {
  const admin = await getAuthenticatedAdmin();
  if (admin) return admin;
  redirect((await hasAdminAccount()) ? "/login" : "/setup");
}

export async function assertAuthenticatedAdmin(): Promise<AuthenticatedAdmin> {
  const admin = await getAuthenticatedAdmin();
  if (!admin) throw new Error("Sesi login berakhir. Silakan login kembali.");
  return admin;
}

export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  try {
    if (token) {
      await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
    }
  } finally {
    cookieStore.delete(SESSION_COOKIE);
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}
