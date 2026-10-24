import Link from "next/link";

export const metadata = { title: "Data Terkirim · Air Production" };

export default function ClientFormSubmittedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-4 py-10 text-[#17212f]">
      <section className="w-full max-w-lg rounded-2xl border border-[#e1e5eb] bg-white p-7 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f3ec] text-xl text-[#2c7546]" aria-hidden="true">✓</div>
        <h1 className="mt-5 text-xl font-semibold">Data sudah terkirim</h1>
        <p className="mt-2 text-sm leading-6 text-[#657184]">Terima kasih. Informasi pengantin dan acara sudah diterima dan job acara telah dibuat untuk tim Air Production.</p>
        <Link href="/client-form" className="mt-6 inline-flex h-10 items-center rounded-lg bg-[#3978c5] px-4 text-sm font-medium text-white hover:bg-[#2f68ad]">Kembali ke formulir</Link>
      </section>
    </main>
  );
}
