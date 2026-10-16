import Link from "next/link";

import { ClientIntakeForm } from "@/components/clients/client-intake-form";
import { submitPublicClientForm } from "@/app/actions/public-client-actions";

export const metadata = {
  title: "Client Information Form · Air Production",
  description: "Share your information and event details with Air Production.",
};

export const dynamic = "force-dynamic";

export default async function PublicClientFormPage() {
  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 py-8 text-[#17212f] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-[680px]">
        <div className="mb-5 flex items-center justify-between border-b border-[#e5e9ef] pb-4">
          <p className="text-sm font-semibold tracking-[-0.01em] text-[#26364a]">Air Production</p>
          <p className="text-xs text-[#778397]">Wedding &amp; Event Organizer</p>
          </div>
        <ClientIntakeForm createAction={submitPublicClientForm} />
        <p className="mt-5 px-3 text-center text-xs leading-5 text-[#778397]">
          Your information will be used by the Air Production team to follow up on your event.
        </p>
        <div className="mt-3 text-center">
          <Link href="/login" className="text-xs text-[#778397] underline decoration-[#c7d0dc] underline-offset-4 hover:text-[#3978c5]">Team sign in</Link>
        </div>
      </div>
    </main>
  );
}
