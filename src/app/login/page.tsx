import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthenticatedAdmin, hasAdminAccount } from "@/lib/auth";

export const metadata = { title: "Login · Air Production" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await hasAdminAccount())) redirect("/setup");
  if (await getAuthenticatedAdmin()) redirect("/dashboard");

  return (
    <AuthCard
      eyebrow="Area internal"
      title="Welcome back"
      description="Sign in to manage Air Production events, teams, clients, and finances."
    >
      <LoginForm />
    </AuthCard>
  );
}
