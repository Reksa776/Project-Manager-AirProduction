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
    <main className="min-h-screen bg-[#f0ebf8] px-4 py-8 text-[#202124] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-[640px] space-y-3">
        <Card className="overflow-hidden border border-[#dadce0] shadow-sm">
          <div className="h-2 bg-[#4285f4]" />
          <div className="flex items-center gap-3 px-6 py-4 sm:px-8">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8f0fe] text-sm font-semibold text-[#1967d2]">AP</span>
          <div>
            <p className="text-sm font-semibold text-[#202124]">Air Production</p>
            <p className="text-xs text-[#5f6368]">Wedding &amp; Event Organizer</p>
          </div>
          </div>
        </Card>
        <ClientIntakeForm createAction={submitPublicClientForm} />
        <p className="px-3 text-center text-xs text-[#5f6368]">
          Your information will be used by the Air Production team to follow up on your event.
        </p>
        <div className="text-center">
          <Link href="/login" className="text-xs text-[#5f6368] hover:text-[#1967d2]">Team sign in</Link>
        </div>
      </div>
    </main>
  );
}
