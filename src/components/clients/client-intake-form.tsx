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
    setMessage({ type: "success", text: "Terima kasih, data Anda berhasil dikirim. Tim kami akan segera menghubungi Anda." });
    router.refresh();
  }

  return (
    <div className="w-full min-w-0">
      <Card className="overflow-hidden rounded-xl border border-[#e1e5eb] shadow-[0_2px_8px_rgba(20,35,55,0.04)]">
        <div className="h-1 bg-[#3978c5]" />
        <div className="min-w-0 px-4 py-5 sm:px-9 sm:py-7">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#3978c5]">Air Production</p>
          <h1 className="mt-3 break-words text-xl font-semibold tracking-[-0.02em] text-[#17212f] sm:text-2xl">Data Klien</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#657184] sm:text-sm sm:leading-6">Isi informasi diri dan acara Anda. Tim kami akan menghubungi Anda melalui kontak yang dicantumkan.</p>
          <p className="mt-5 border-t border-[#edf0f4] pt-3 text-xs text-[#738096]"><span className="text-[#3978c5]">*</span> Wajib diisi</p>
        </div>
      </Card>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="client-website">Biarkan kolom ini kosong</label>
          <input id="client-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <Card className="min-w-0 space-y-5 rounded-xl border border-[#e1e5eb] p-4 shadow-[0_2px_8px_rgba(20,35,55,0.04)] sm:space-y-6 sm:p-8">
          <div>
            <h2 className="text-sm font-semibold text-[#17212f]">Informasi diri</h2>
            <p className="mt-1 text-xs leading-5 text-[#738096]">Informasi kontak calon pengantin.</p>
          </div>
          <Input label="Nama klien *" name="name" autoComplete="name" required maxLength={120} className="border-[#d9dfe8] focus:border-[#3978c5] focus:ring-[#3978c5]/10" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="CPW" name="cpw" maxLength={120} className="border-[#d9dfe8] focus:border-[#3978c5] focus:ring-[#3978c5]/10" />
            <Input label="CPP" name="cpp" maxLength={120} className="border-[#d9dfe8] focus:border-[#3978c5] focus:ring-[#3978c5]/10" />
          </div>
          <Input label="Nomor HP" name="phone" type="tel" autoComplete="tel" maxLength={120} className="border-[#d9dfe8] focus:border-[#3978c5] focus:ring-[#3978c5]/10" />
        </Card>

        <Card className="min-w-0 space-y-5 rounded-xl border border-[#e1e5eb] p-4 shadow-[0_2px_8px_rgba(20,35,55,0.04)] sm:space-y-6 sm:p-8">
          <div>
            <h2 className="text-sm font-semibold text-[#17212f]">Informasi acara</h2>
            <p className="mt-1 text-xs leading-5 text-[#738096]">Cantumkan lokasi acara agar tim kami dapat mempersiapkannya.</p>
          </div>
          <Input label="Alamat acara *" name="address" autoComplete="street-address" required maxLength={500} className="border-[#d9dfe8] focus:border-[#3978c5] focus:ring-[#3978c5]/10" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="client-notes" className="text-[13px] font-medium text-[#596579]">Catatan untuk tim kami</label>
            <textarea
              id="client-notes"
              name="notes"
              rows={3}
              maxLength={5000}
              placeholder="Ada hal lain yang perlu kami ketahui?"
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
            {busy ? "Mengirim..." : "Kirim data"}
          </Button>
          <span className="max-w-full break-words text-xs leading-5 text-[#738096] sm:text-right">Data Anda hanya dibagikan kepada tim kami.</span>
        </div>
      </form>
    </div>
  );
}
