"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  createInitialOwner,
  createLoginSession,
  hasAdminAccount,
  revokeCurrentSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

export interface AuthActionState {
  error?: string;
}

export async function loginAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!(await hasAdminAccount())) redirect("/setup");

  let session: Awaited<ReturnType<typeof createLoginSession>>;
  try {
    session = await createLoginSession(
      String(formData.get("email") ?? ""),
      String(formData.get("password") ?? ""),
    );
  } catch {
    return { error: "Email atau password salah." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.token, sessionCookieOptions());
  redirect("/dashboard");
}

export async function setupOwnerAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  let owner: Awaited<ReturnType<typeof createInitialOwner>>;
  try {
    owner = await createInitialOwner({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not create the Owner account.",
    };
  }

  let session: Awaited<ReturnType<typeof createLoginSession>>;
  try {
    session = await createLoginSession(owner.email, String(formData.get("password") ?? ""));
  } catch {
    return { error: "Account created, but sign-in failed. Please sign in." };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.token, sessionCookieOptions());
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await revokeCurrentSession();
  redirect("/login");
}
