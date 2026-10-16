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
    <main className="min-h-screen w-full bg-[#f6f8fb] px-3 py-6 text-[#17212f] sm:px-6 sm:py-12">
      <div className="mx-auto w-full min-w-0 max-w-[680px]">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#e5e9ef] pb-3 sm:mb-5 sm:justify-between sm:pb-4">
          <p className="text-[13px] font-semibold tracking-[-0.01em] text-[#26364a] sm:text-sm">Air Production</p>
          <p className="ml-auto text-right text-[11px] text-[#778397] sm:ml-0 sm:text-xs">Wedding &amp; Event Organizer</p>
          </div>
        <ClientIntakeForm createAction={submitPublicClientForm} />
        <p className="mt-5 px-2 text-center text-[11px] leading-5 text-[#778397] sm:px-3 sm:text-xs">
          Your information will be used by the Air Production team to follow up on your event.
        </p>
        <div className="mt-3 text-center">
          <Link href="/login" className="text-xs text-[#778397] underline decoration-[#c7d0dc] underline-offset-4 hover:text-[#3978c5]">Team sign in</Link>
        </div>
      </div>
    </main>
  );
}
