import Link from "next/link";

import { ClientIntakeForm } from "@/components/clients/client-intake-form";
import { Card } from "@/components/ui";
import { submitPublicClientForm } from "@/app/actions/public-client-actions";

export const metadata = {
  title: "Client Information Form · Air Production",
  description: "Share your information and event details with Air Production.",
};

export const dynamic = "force-dynamic";

export default async function PublicClientFormPage() {
  return (
    <main className="min-h-screen bg-app px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-5">
        <Card className="flex items-center gap-3 px-5 py-4 sm:px-7">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-sm font-semibold text-brand">AP</span>
          <div>
            <p className="text-sm font-semibold text-ink">Air Production</p>
            <p className="text-xs text-ink-muted">Wedding &amp; Event Organizer</p>
          </div>
        </Card>
        <ClientIntakeForm createAction={submitPublicClientForm} />
        <p className="text-center text-xs text-ink-muted">
          Your information will be used by the Air Production team to follow up on your event.
        </p>
        <div className="text-center">
          <Link href="/login" className="text-xs text-ink-muted hover:text-ink">Team sign in</Link>
        </div>
      </div>
    </main>
  );
}
