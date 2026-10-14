import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { SetupOwnerForm } from "@/components/auth/setup-owner-form";
import { getAuthenticatedAdmin, hasAdminAccount } from "@/lib/auth";

export const metadata = { title: "Setup Owner · Air Production" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAdminAccount()) {
    if (await getAuthenticatedAdmin()) redirect("/dashboard");
    redirect("/login");
  }

  return (
    <AuthCard
      eyebrow="Setup pertama"
      title="Create Owner account"
      description="This account is the primary workspace administrator. Setup is only available before the first account is created."
    >
      <SetupOwnerForm />
    </AuthCard>
  );
}
