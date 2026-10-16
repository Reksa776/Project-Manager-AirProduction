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
    <div className="space-y-3">
      <Card className="overflow-hidden border border-[#dadce0] shadow-sm">
      <div className="h-2 bg-[#4285f4]" />
      <div className="px-6 py-6 sm:px-8">
        <p className="text-xs font-medium text-[#1967d2]">AIR PRODUCTION · CLIENT INTAKE</p>
        <h1 className="mt-3 text-[30px] font-normal leading-tight tracking-tight text-[#202124]">Client Information Form</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#5f6368]">Share your information, CPW/CPP, phone number, and event address with our team.</p>
        <p className="mt-5 border-t border-[#dadce0] pt-3 text-xs text-[#5f6368]"><span className="text-[#d93025]">*</span> Indicates required question</p>
      </div>
      </Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor="client-website">Leave this field empty</label>
          <input id="client-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <section className="space-y-3">
          <Card className="border border-[#dadce0] p-6 shadow-sm sm:px-8">
            <Input label="Client Name *" name="name" autoComplete="name" required maxLength={120} className="max-w-md rounded-none border-0 border-b border-[#dadce0] bg-transparent px-0 focus:border-b-2 focus:border-[#4285f4] focus:ring-0" />
          </Card>
          <Card className="border border-[#dadce0] p-6 shadow-sm sm:px-8">
            <Input label="CPW" name="cpw" maxLength={120} className="max-w-md rounded-none border-0 border-b border-[#dadce0] bg-transparent px-0 focus:border-b-2 focus:border-[#4285f4] focus:ring-0" />
          </Card>
          <Card className="border border-[#dadce0] p-6 shadow-sm sm:px-8">
            <Input label="CPP" name="cpp" maxLength={120} className="max-w-md rounded-none border-0 border-b border-[#dadce0] bg-transparent px-0 focus:border-b-2 focus:border-[#4285f4] focus:ring-0" />
          </Card>
          <Card className="border border-[#dadce0] p-6 shadow-sm sm:px-8">
            <Input label="Mobile Number" name="phone" type="tel" autoComplete="tel" maxLength={120} className="max-w-md rounded-none border-0 border-b border-[#dadce0] bg-transparent px-0 focus:border-b-2 focus:border-[#4285f4] focus:ring-0" />
          </Card>
        </section>

        <section className="space-y-3">
          <Card className="border border-[#dadce0] p-6 shadow-sm sm:px-8">
            <p className="mb-5 text-sm font-medium text-[#202124]">Event Location</p>
            <Input label="Event Address *" name="address" autoComplete="street-address" required maxLength={500} className="max-w-md rounded-none border-0 border-b border-[#dadce0] bg-transparent px-0 focus:border-b-2 focus:border-[#4285f4] focus:ring-0" />
          </Card>
        </section>

        <section>
          <Card className="space-y-4 border border-[#dadce0] p-6 shadow-sm sm:px-8">
          <div>
            <h3 className="text-sm font-medium text-[#202124]">Additional Notes</h3>
            <p className="mt-1 text-xs text-[#5f6368]">Leave a note or request for our team.</p>
          </div>
          <textarea
            name="notes"
            rows={4}
            placeholder="Write a note for the Air Production team..."
            className="w-full resize-y border-0 border-b border-[#dadce0] bg-transparent px-0 py-2 text-sm text-[#202124] placeholder:text-[#80868b] focus:border-b-2 focus:border-[#4285f4] focus:outline-none"
          />
          </Card>
        </section>

        {message ? (
          <p
            role={message.type === "error" ? "alert" : "status"}
            className={message.type === "error"
              ? "rounded-lg border border-[#f4c7c3] bg-white px-4 py-3 text-sm text-[#b3261e]"
              : "rounded-lg border border-[#ceead6] bg-white px-4 py-3 text-sm text-[#137333]"}
          >
            {message.text}
          </p>
        ) : null}

        <div className="flex items-center justify-between py-2">
          <Button type="submit" disabled={busy} className="rounded-md bg-[#1a73e8] px-7 text-white hover:bg-[#1765cc]">
            {busy ? "Saving..." : "Save Client"}
          </Button>
          <span className="text-xs text-[#5f6368]">Page 1 of 1</span>
        </div>
      </form>
    </div>
  );
}
