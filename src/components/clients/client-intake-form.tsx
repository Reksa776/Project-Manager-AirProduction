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
    setMessage({ type: "success", text: "Client information saved." });
    router.refresh();
  }

  return (
    <Card className="overflow-hidden border-t-4 border-t-brand">
      <div className="border-b border-line px-5 py-5 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Client intake</p>
        <h2 className="mt-1 text-xl font-semibold text-ink">Client Information Form</h2>
        <p className="mt-1 text-sm text-ink-muted">Share your information and event address, then leave a note for our team.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-7 px-5 py-6 sm:px-7">
        <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="client-website">Leave this field empty</label>
          <input id="client-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">Client Information</h3>
            <p className="mt-1 text-xs text-ink-muted">Required details are marked with an asterisk.</p>
          </div>
          <Input label="Client Name *" name="name" autoComplete="name" required maxLength={120} />
        </section>

        <section className="space-y-4 border-t border-line pt-6">
          <div>
            <h3 className="text-sm font-semibold text-ink">Event Location</h3>
            <p className="mt-1 text-xs text-ink-muted">Tell us where the event will take place.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input label="Event Address *" name="address" autoComplete="street-address" required maxLength={500} />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-line pt-6">
          <div>
            <h3 className="text-sm font-semibold text-ink">Additional Notes</h3>
            <p className="mt-1 text-xs text-ink-muted">Leave a note or request for our team.</p>
          </div>
          <textarea
            name="notes"
            rows={4}
            placeholder="Write a note for the Air Production team..."
            className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-ink-muted focus:outline-none focus:ring-2 focus:ring-ink/5"
          />
        </section>

        {message ? (
          <p
            role={message.type === "error" ? "alert" : "status"}
            className={message.type === "error"
              ? "rounded-lg border border-[#e8b4ad] bg-[#fdf3f2] px-3 py-2 text-sm text-[#a1352b]"
              : "rounded-lg border border-[#b8dfc5] bg-[#f1faf4] px-3 py-2 text-sm text-[#216e3a]"}
          >
            {message.text}
          </p>
        ) : null}

        <div className="flex justify-end border-t border-line pt-5">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save Client"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
