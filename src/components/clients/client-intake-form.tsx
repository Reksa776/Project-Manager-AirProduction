"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import type { MasterActionResult } from "@/app/actions/master-actions";
import { Button, Card, Input } from "@/components/ui";

export function ClientIntakeForm({
  createAction,
}: {
  createAction: (values: Record<string, string>) => Promise<MasterActionResult>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const result = await createAction(
      Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])),
    );
    setBusy(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    form.reset();
    setMessage({ type: "success", text: "Thanks — your information has been sent. Our team will be in touch." });
    router.refresh();
  }

  return (
    <div className="w-full min-w-0">
      <Card className="overflow-hidden rounded-xl border border-[#e1e5eb] shadow-[0_2px_8px_rgba(20,35,55,0.04)]">
        <div className="h-1 bg-[#3978c5]" />
        <div className="min-w-0 px-4 py-5 sm:px-9 sm:py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#3978c5]">Air Production</p>
          <h1 className="mt-3 break-words text-xl font-semibold tracking-[-0.02em] text-[#17212f] sm:text-2xl">Client information</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#657184] sm:text-sm sm:leading-6">Tell us a little about you and your event. Our team will follow up using the details below.</p>
          <p className="mt-5 border-t border-[#edf0f4] pt-3 text-xs text-[#738096]"><span className="text-[#3978c5]">*</span> Required</p>
        </div>
      </Card>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="client-website">Leave this field empty</label>
          <input id="client-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <Card className="min-w-0 space-y-5 rounded-xl border border-[#e1e5eb] p-4 shadow-[0_2px_8px_rgba(20,35,55,0.04)] sm:space-y-6 sm:p-8">
          <div>
            <h2 className="text-sm font-semibold text-[#17212f]">Your details</h2>
            <p className="mt-1 text-xs leading-5 text-[#738096]">Contact information for the couple and primary contact.</p>
          </div>
          <Input label="Client name *" name="name" autoComplete="name" required maxLength={120} className="border-[#d9dfe8] focus:border-[#3978c5] focus:ring-[#3978c5]/10" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="CPW" name="cpw" maxLength={120} className="border-[#d9dfe8] focus:border-[#3978c5] focus:ring-[#3978c5]/10" />
            <Input label="CPP" name="cpp" maxLength={120} className="border-[#d9dfe8] focus:border-[#3978c5] focus:ring-[#3978c5]/10" />
          </div>
          <Input label="Mobile number" name="phone" type="tel" autoComplete="tel" maxLength={120} className="border-[#d9dfe8] focus:border-[#3978c5] focus:ring-[#3978c5]/10" />
        </Card>

        <Card className="min-w-0 space-y-5 rounded-xl border border-[#e1e5eb] p-4 shadow-[0_2px_8px_rgba(20,35,55,0.04)] sm:space-y-6 sm:p-8">
          <div>
            <h2 className="text-sm font-semibold text-[#17212f]">Event details</h2>
            <p className="mt-1 text-xs leading-5 text-[#738096]">Where should our team plan to meet you?</p>
          </div>
          <Input label="Event address *" name="address" autoComplete="street-address" required maxLength={500} className="border-[#d9dfe8] focus:border-[#3978c5] focus:ring-[#3978c5]/10" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="client-notes" className="text-[13px] font-medium text-[#596579]">Notes for our team</label>
            <textarea
              id="client-notes"
              name="notes"
              rows={3}
              maxLength={5000}
              placeholder="Anything else we should know?"
              className="w-full resize-y rounded-lg border border-[#d9dfe8] bg-white px-3 py-2.5 text-sm text-[#17212f] placeholder:text-[#9099a8] focus:border-[#3978c5] focus:outline-none focus:ring-2 focus:ring-[#3978c5]/10"
            />
          </div>
        </Card>

        {message ? (
          <div
            role={message.type === "error" ? "alert" : "status"}
            aria-live={message.type === "error" ? "assertive" : "polite"}
            className={message.type === "error"
              ? "flex items-start gap-3 rounded-lg border border-[#f0d2cf] bg-white px-4 py-3.5 text-sm text-[#9c3b32]"
              : "flex items-start gap-3 rounded-lg border border-[#cfe4d6] bg-[#f8fcf9] px-4 py-3.5 text-sm text-[#315d3e]"}
          >
            <span className={message.type === "error" ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#fbefee] text-xs font-semibold" : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e6f3e9] text-xs font-semibold"} aria-hidden="true">
              {message.type === "success" ? "✓" : "!"}
            </span>
            <span className="leading-5">{message.text}</span>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-col-reverse items-start gap-3 border-t border-[#e8ecf1] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="submit" disabled={busy} className="max-w-full rounded-lg bg-[#3978c5] px-5 text-white hover:bg-[#2f68ad]">
            {busy ? "Sending..." : "Submit information"}
          </Button>
          <span className="max-w-full break-words text-xs leading-5 text-[#738096] sm:text-right">Your details are shared with our team only.</span>
        </div>
      </form>
    </div>
  );
}
